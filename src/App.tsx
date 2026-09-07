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

  const toggle = (habitId: string) => {
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
