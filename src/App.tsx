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
  type WorkoutMap,
} from './lib/ledger'
import { domainOf, habitIdFor, isActiveOn, isLive, type Habit, type Tier } from './config/habits'
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
import { VITALS_URL, useCloudSync } from './lib/cloudSync'
import { TabBar, type Tab } from './components/TabBar'
import { HabitsScreen, type HabitActions } from './screens/HabitsScreen'
import { MonthView } from './components/MonthView'
import type { WeeklyCtx } from './components/WeeklyPanels'
import { REVIEW_ID, reviewDay, reviewsToShow } from './lib/monthReview'
import { commitSundayTasks, isSunday, useSundayTasks, type SundayTask } from './lib/sundayTasks'
import { ARBOR_HABIT, applyArborEvents, isLocked, planToday, useArbor } from './lib/arborLink'
import { practicedOn } from './arbor-core/model.ts'
import { GUITAR_HABIT, applyShedEvents, sessionToday, useShed } from './lib/guitarLink'
import { tempoFor } from './woodshed-core/coach.ts'
import { ITEM_BY_ID } from './woodshed-core/course.ts'
import { statsOf, type Feel } from './woodshed-core/model.ts'
import { SKILL_BY_ID } from './arbor-core/skills.ts'
import { useGame } from './lib/game'
import { applyGameEvents, sleepMeasured, sleepState, useGameLink } from './lib/gameLink'
import { listAdds } from './game-core/events.ts'
import { SLEEP_DONE, SLEEP_HABIT, V4_START } from './game-core/rules.ts'
import { Moments } from './components/PartnerStrip'

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

  const stores = useMemo(
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
    const cfg = configWithLinkedHabit({ id: ARBOR_HABIT, name: 'Arbor skills', emoji: '🌳', tier: 'pillar' }, 1, today)
    if (cfg) emitConfig(commitConfig(cfg))
  }, [settled, today, emitConfig])

  // Introduce the Woodshed block once (third row; drag it wherever it belongs).
  useEffect(() => {
    if (!settled) return
    const cfg = configWithLinkedHabit({ id: GUITAR_HABIT, name: 'Woodshed', emoji: '🎸', tier: 'pillar' }, 2, today)
    if (cfg) emitConfig(commitConfig(cfg))
  }, [settled, today, emitConfig])

  // The game's tiers arrived after these habits did: lift the three pillars
  // once, so LeetCode, Gym and Woodshed carry the day's XP. Only ever runs on a
  // library that has no pillar yet, so later edits by hand are never undone.
  useEffect(() => {
    if (!settled || getConfig().habits.some((h) => h.tier === 'pillar')) return
    const lift: Record<string, Tier> = { 'leetcode-coding': 'pillar', gym: 'pillar', [GUITAR_HABIT]: 'pillar', [ARBOR_HABIT]: 'pillar', 'log-diary-plan-english-shadow': 'standard' }
    const habits = getConfig().habits.map((h) => (lift[h.id] ? { ...h, tier: lift[h.id] } : h))
    if (!habits.some((h) => h.tier === 'pillar')) return
    emitConfig(commitConfig({ ...getConfig(), habits, at: new Date().toISOString(), source: 'app' }))
  }, [settled, emitConfig])

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

  // ── Guitar: today's Woodshed session ──
  const shed = useShed()
  const { plan: session, frozen: sessionFrozen } = useMemo(() => sessionToday(shed, today), [shed, today])

  /** Apply one of our own Woodshed events locally, then send it to the ledger. */
  const emitGuitar = useCallback(
    (type: 'guitar' | 'guitar_plan', payload: Record<string, string | number | boolean | null>) => {
      applyShedEvents([{ device: 'local', at: new Date().toISOString(), day: today, type, payload }])
      cloud.emit(type, payload, today)
    },
    [cloud, today],
  )

  // Freeze today's session once we know no other device already did, so it is
  // the same list here and in Woodshed all day.
  useEffect(() => {
    if (!settled || sessionFrozen || session.length === 0) return
    emitGuitar('guitar_plan', { items: JSON.stringify(session) })
  }, [settled, sessionFrozen, session, emitGuitar])

  // The Guitar habit ticks itself when the whole session is logged. It only
  // un-ticks when a log was taken back, so a tick made by hand before the
  // session existed is left alone.
  useEffect(() => {
    if (!settled || session.length === 0) return
    const logs = session.map((id) => shed.logs[id]?.[today])
    const all = logs.every((l) => l?.done)
    const undone = logs.some((l) => l && !l.done)
    const ticked = Boolean(ticks[today]?.[GUITAR_HABIT])
    if (all === ticked || (!all && !undone)) return
    const at = new Date().toISOString()
    setTicks((prev) => {
      const day = { ...(prev[today] ?? {}) }
      if (all) day[GUITAR_HABIT] = at
      else delete day[GUITAR_HABIT]
      return { ...prev, [today]: day }
    })
    if (all) cloud.emit('tick', { habitId: GUITAR_HABIT, at })
    else cloud.emit('untick', { habitId: GUITAR_HABIT })
  }, [settled, session, shed, ticks, today, cloud])

  const onGuitar = (itemId: string, feel: Feel | null) => {
    const item = ITEM_BY_ID.get(itemId)
    if (!item) return
    if (feel === null) return emitGuitar('guitar', { itemId, done: false })
    // logged from here, it is taken to have been practised at today's tempo
    const bpm = tempoFor(item, statsOf(item, shed))
    emitGuitar('guitar', { itemId, done: true, feel, ...(bpm ? { bpm } : {}) })
  }

  const link = useGameLink()
  const game = useGame(habits, ticks, arbor, shed, link, today)

  // Record today's habit list, with each habit's tier and domain, so editing
  // or deleting a habit cannot change what a day was. From rules version 4 the
  // first list of a day stands and a later one can only add habits, so it is
  // written again only when it would add one (a reorder, a removal or a tier
  // change would not count, and waits for tomorrow's list).
  useEffect(() => {
    if (!settled || habits.length === 0) return
    const list = habits.filter((h) => isActiveOn(h, today)).map((h) => ({ id: h.id, tier: h.tier, tag: domainOf(h) }))
    if (list.length === 0) return
    const stands = link.lists[today]
    if (today >= V4_START ? !listAdds(stands, list) : JSON.stringify(list.map(({ id, tier }) => ({ id, tier }))) === JSON.stringify(stands ?? null)) return
    const payload = { habits: JSON.stringify(list) }
    applyGameEvents([{ type: 'day_list', day: today, at: new Date().toISOString(), payload }])
    cloud.emit('day_list', payload, today)
  }, [settled, link.lists, habits, today, cloud])

  // Once the band reports sleep, the Sleep habit follows last night's score
  // (done at SLEEP_DONE or more) instead of a hand tick.
  useEffect(() => {
    if (!settled || !sleepMeasured(link, SLEEP_HABIT, today)) return
    const good = (link.body[today]?.sleepScore ?? 0) >= SLEEP_DONE
    if (good === Boolean(ticks[today]?.[SLEEP_HABIT])) return
    const at = new Date().toISOString()
    setTicks((prev) => {
      const day = { ...(prev[today] ?? {}) }
      if (good) day[SLEEP_HABIT] = at
      else delete day[SLEEP_HABIT]
      return { ...prev, [today]: day }
    })
    if (good) cloud.emit('tick', { habitId: SLEEP_HABIT, at })
    else cloud.emit('untick', { habitId: SLEEP_HABIT })
  }, [settled, link, ticks, today, cloud])

  const toggle = (habitId: string) => {
    if (isLocked(habitId)) return // fed by Strong / Arbor — not ticked by hand
    if (sleepMeasured(link, habitId, today)) return // filled by the band's sleep score
    if (habitId === GUITAR_HABIT && session.length > 0) return // ticks itself when the session is logged
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

  // ── not-every-day blocks: month-end review + Sunday reset ──
  const sundayTasks = useSundayTasks()
  const reviews = useMemo(() => reviewsToShow(ticks, today), [ticks, today])
  // Month the review's "Graph" button asked Monthly to open on (null = running month)
  const [monthFocus, setMonthFocus] = useState<string | null>(null)

  // A review is filed under the first day of the month it closes, not today —
  // so ticking it from the 1st of the next month still lands on the right month.
  const toggleReview = (ym: string) => {
    const day = reviewDay(ym)
    const wasDone = Boolean(ticks[day]?.[REVIEW_ID])
    const at = new Date().toISOString()
    setTicks((prev) => {
      const d = { ...(prev[day] ?? {}) }
      if (wasDone) delete d[REVIEW_ID]
      else d[REVIEW_ID] = at
      return { ...prev, [day]: d }
    })
    if (wasDone) cloud.emit('untick', { habitId: REVIEW_ID }, day)
    else cloud.emit('tick', { habitId: REVIEW_ID, at }, day)
  }

  const saveSundayTasks = (tasks: SundayTask[]) => {
    const next = commitSundayTasks(tasks)
    cloud.emit('sunday', { tasks: JSON.stringify(next.tasks) })
  }

  const weekly: WeeklyCtx = {
    reviews,
    onToggleReview: toggleReview,
    onOpenMonth: (ym) => {
      setMonthFocus(ym)
      setTab('monthly')
    },
    sunday: { tasks: sundayTasks, isSunday: isSunday(today), onChange: saveSundayTasks },
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
      // deleted ids stay reserved: reusing one would be dropped again by any device that remembers it
      const id = habitIdFor(name, [...habits.map((h) => h.id), ...getConfig().deleted])
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
            game={game}
            actions={actions}
            linked={{ workout: workouts[today], arbor, plan, onSkill, guitar: { shed, session, onLog: onGuitar }, sleep: { state: sleepState(link, today), night: link.nights[today] } }}
            weekly={weekly}
          />
        )}
        {tab === 'monthly' && (
          <MonthView habits={habits} ticks={ticks} today={today} initialYm={monthFocus ?? undefined} />
        )}
      </motion.main>

      <Moments game={game} today={today} ready={settled} />

      <footer className="hud-label mt-8 border-none text-center !text-[10px] !text-neo-gray-dark">
        v2.1 · habit tracker ·{' '}
        {cloud.status === 'live' && '☁️ cloud sync live'}
        {cloud.status === 'connecting' && '☁️ connecting…'}
        {cloud.status === 'error' && '☁️ sync error'}
        {cloud.status === 'off' && 'cloud sync off (local storage active)'}
        {cloud.pending > 0 && ` · ${cloud.pending} queued`}
        {' · '}
        <a href={VITALS_URL} target="_blank" rel="noreferrer" className="underline">Vitals</a>
      </footer>

      <TabBar
        tab={tab}
        onChange={(t) => {
          setMonthFocus(null)
          setTab(t)
        }}
      />
    </div>
  )
}
