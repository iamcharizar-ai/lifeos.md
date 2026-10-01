import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { dateISO, loadTicks, saveTicks, type Ticks } from './lib/store'
import {
  loadHealth,
  loadMetrics,
  loadWorkouts,
  saveHealth,
  saveMetrics,
  saveWorkouts,
  type HealthMap,
  type MetricsMap,
  type Stores,
  type WorkoutMap,
} from './lib/ledger'
import { habitIdFor, isLive, type Habit, type Tier } from './config/habits'
import {
  commitConfig,
  configWithEdit,
  configWithLinkedHabit,
  configWithLive,
  configWithNewHabit,
  configWithOrder,
  configWithoutHabit,
  configWithoutHabits,
  getConfig,
  useHabits,
  type HabitConfig,
} from './lib/habitConfig'
import { ensureMonths } from './lib/monthSnapshot'
import { useCloudSync } from './lib/cloudSync'
import { TabBar, type Tab } from './components/TabBar'
import { HabitsScreen, type HabitActions } from './screens/HabitsScreen'
import { MonthView } from './components/MonthView'
import { ARBOR_HABIT, applyArborEvents, isLocked, planToday, useArbor } from './lib/arborLink'
import { practicedOn } from './arbor-core/model.ts'
import { SKILL_BY_ID } from './arbor-core/skills.ts'

export default function App() {
  const [tab, setTab] = useState<Tab>('daily')
  const [ticks, setTicks] = useState<Ticks>(() => loadTicks())
  const [metrics, setMetrics] = useState<MetricsMap>(() => loadMetrics())
  const [health, setHealth] = useState<HealthMap>(() => loadHealth())
  const [workouts, setWorkouts] = useState<WorkoutMap>(() => loadWorkouts())
  const today = dateISO()
  // `habits` is the whole library, in one canonical order; the checklist is its
  // live slice and the shelf is the rest — same order, two sections.
  const habits = useHabits()
  const live = useMemo(() => habits.filter(isLive), [habits])
  const shelf = useMemo(() => habits.filter((h) => !isLive(h)), [habits])

  useEffect(() => saveTicks(ticks), [ticks])
  useEffect(() => saveMetrics(metrics), [metrics])
  useEffect(() => saveHealth(health), [health])
  useEffect(() => saveWorkouts(workouts), [workouts])

  const stores = useMemo<Stores>(
    () => ({ ticks, metrics, health, workouts }),
    [ticks, metrics, health, workouts],
  )

  // Phone↔PC sync via Supabase event ledger
  const cloud = useCloudSync({ stores }, { setTicks, setMetrics, setHealth, setWorkouts })

  // Keep the running month's draft current and seal every month behind it.
  // Runs after each change so the draft is always one boot away from being the
  // sealed record — that is what lets habits be deleted without losing history.
  //
  // Held back until the ledger has finished replaying: a fresh device that
  // sealed first would stamp empty months over real history. (An earlier seal
  // from a peer still wins on merge, but not sealing garbage is cheaper.)
  useEffect(() => {
    if (cloud.status === 'connecting') return
    for (const snap of ensureMonths(habits, ticks, today))
      cloud.emit('month', { ym: snap.ym, snapshot: JSON.stringify(snap) }, `${snap.ym}-01`)
  }, [habits, ticks, today, cloud])

  // A drag fires onReorder on every frame it crosses a neighbour. Committing
  // locally each time is what makes the rows shove each other around; the cloud
  // only needs where they landed, so that half is coalesced.
  const emitTimer = useRef<number | undefined>(undefined)
  const emitConfig = useCallback(
    (cfg: HabitConfig) =>
      cloud.emit('config', {
        habits: JSON.stringify(cfg.habits),
        deleted: JSON.stringify(cfg.deleted),
      }),
    [cloud],
  )
  useEffect(() => () => window.clearTimeout(emitTimer.current), [])

  const pushConfig = (cfg: HabitConfig | null, coalesce = false) => {
    if (!cfg) return
    const next = commitConfig(cfg)
    window.clearTimeout(emitTimer.current)
    if (!coalesce) return emitConfig(next)
    emitTimer.current = window.setTimeout(() => emitConfig(getConfig()), 500)
  }

  // ── linked habits (Arbor block, Strong-fed Gym) ──
  const arbor = useArbor()
  const { plan, frozen } = useMemo(() => planToday(arbor, today), [arbor, today])
  // True once the ledger has replayed successfully (or there is no ledger). It
  // stays true if realtime later drops: everything gated on it only needs the
  // history to have been folded once, and must never act on a half-loaded state.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (cloud.status === 'live' || cloud.status === 'off') setSettled(true)
  }, [cloud.status])

  /** Apply one of our own Arbor events locally, then send it to the ledger. */
  const emitArbor = useCallback(
    (type: 'skill' | 'plan', payload: Record<string, string | number | boolean | null>) => {
      applyArborEvents([{ device: 'local', at: new Date().toISOString(), day: today, type, payload }])
      cloud.emit(type, payload, today)
    },
    [cloud, today],
  )

  // Freeze today's plan once we know no other device already did, so the phone,
  // the desktop and Strong all show the same skills all day.
  useEffect(() => {
    if (!settled || frozen || plan.morning.length + plan.gym.length === 0) return
    emitArbor('plan', { morning: JSON.stringify(plan.morning), gym: JSON.stringify(plan.gym) })
  }, [settled, frozen, plan, emitArbor])

  // Introduce the Arbor block once (second row; drag it wherever it belongs).
  useEffect(() => {
    if (!settled) return
    const cfg = configWithLinkedHabit({ id: ARBOR_HABIT, name: 'Arbor skills', emoji: '🌳', tier: 'core' }, 1, today)
    if (cfg) emitConfig(commitConfig(cfg))
  }, [settled, today, emitConfig])

  // The Arbor habit ticks itself when every planned skill is practised.
  useEffect(() => {
    if (!settled || plan.morning.length === 0) return
    const all = plan.morning.every((id) => practicedOn(arbor, today, id))
    const ticked = Boolean(ticks[today]?.[ARBOR_HABIT])
    if (all === ticked) return
    const at = new Date().toISOString()
    setTicks((prev) => {
      const day = { ...(prev[today] ?? {}) }
      if (all) day[ARBOR_HABIT] = at
      else delete day[ARBOR_HABIT]
      return { ...prev, [today]: day }
    })
    if (all) cloud.emit('tick', { habitId: ARBOR_HABIT, at })
    else cloud.emit('untick', { habitId: ARBOR_HABIT })
  }, [settled, plan, arbor, ticks, today, cloud])

  const onSkill = (skillId: string, done: boolean, value?: number) => {
    const skill = SKILL_BY_ID.get(skillId)
    if (!skill) return
    const payload: Record<string, string | number | boolean | null> = { skillId, done }
    if (done && typeof value === 'number' && Number.isFinite(value)) {
      payload.value = value
      payload.kind = skill.unit ? 'cur' : 'lvl'
    }
    emitArbor('skill', payload)
  }

  const toggle = (habitId: string) => {
    if (isLocked(habitId)) return // fed by Strong / Arbor — not ticked by hand
    const wasTicked = Boolean(ticks[today]?.[habitId])
    const at = new Date().toISOString()
    setTicks((prev) => {
      const day = { ...(prev[today] ?? {}) }
      if (day[habitId]) delete day[habitId]
      else day[habitId] = at
      return { ...prev, [today]: day }
    })
    if (wasTicked) cloud.emit('untick', { habitId })
    else cloud.emit('tick', { habitId, at })
  }

  const actions: HabitActions = {
    onToggle: toggle,
    onToggleLive: (habitId, isOn) => pushConfig(configWithLive(habitId, isOn, today)),
    onEdit: (habitId, patch) => pushConfig(configWithEdit(habitId, patch)),
    onDelete: (habitId) => pushConfig(configWithoutHabit(habitId)),
    onDeleteMany: (ids) => pushConfig(configWithoutHabits(ids)),
    onReorder: (orderedIds) => pushConfig(configWithOrder(orderedIds), true),
    onAdd: ({ name, emoji, tier }: { name: string; emoji: string; tier: Tier }) => {
      const clash = habits.find((h) => h.name.toLowerCase() === name.toLowerCase())
      if (clash) return `"${clash.name}" is already in the library.`
      const id = habitIdFor(
        name,
        habits.map((h) => h.id),
      )
      const habit: Omit<Habit, 'spans'> = { id, name, emoji, tier }
      pushConfig(configWithNewHabit(habit, today))
      return null
    },
  }

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      className={`safe-x safe-top mx-auto pb-28 ${
        tab === 'monthly'
          ? 'max-w-md sm:max-w-2xl lg:max-w-[1600px]'
          : 'max-w-md sm:max-w-2xl lg:max-w-4xl'
      }`}
    >
      <header className="mb-6 flex items-baseline justify-between border-b-4 border-black pb-2">
        <h1 className="font-display text-xl font-bold uppercase tracking-widest text-black">
          LifeOS<span className="ml-1.5 text-neo-blue">// TRACKER</span>
        </h1>
        <span className="num text-sm font-bold text-black">{dateLabel}</span>
      </header>

      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        {tab === 'daily' && (
          <HabitsScreen
            habits={habits}
            live={live}
            shelf={shelf}
            ticks={ticks}
            today={today}
            stores={stores}
            actions={actions}
            linked={{ workout: workouts[today], arbor, plan, onSkill }}
          />
        )}
        {tab === 'monthly' && <MonthView habits={habits} ticks={ticks} today={today} />}
      </motion.main>

      <footer className="hud-label mt-8 border-none text-center !text-[10px] !text-neo-gray-dark">
        v2.1 · habit tracker ·{' '}
        {cloud.status === 'live' && '☁️ cloud sync live'}
        {cloud.status === 'connecting' && '☁️ connecting…'}
        {cloud.status === 'error' && '☁️ sync error'}
        {cloud.status === 'off' && 'cloud sync off (local storage active)'}
        {cloud.pending > 0 && ` · ${cloud.pending} queued`}
      </footer>

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
