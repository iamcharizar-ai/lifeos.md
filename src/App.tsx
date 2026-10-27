import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { loadTicks, saveTicks, type Ticks } from './lib/store'
import { useToday } from './lib/day'
import { nextGymDay } from './arbor-core/schedule.ts'
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
import { ensureMonths, seedLegacyMonths, setSleepScores } from './lib/monthSnapshot'
import { useCloudSync } from './lib/cloudSync'
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
import { useHealthCheck } from './lib/healthCheck'
import { listAdds } from './game-core/events.ts'
import { SLEEP_DONE, SLEEP_HABIT, V13_START } from './game-core/rules.ts'
import { DAY_START_EVENT, clockOf } from './game-core/day.ts'
import { Moments } from './components/PartnerStrip'

export default function App() {
  const [tab, setTab] = useState<Tab>('daily')
  const [ticks, setTicks] = useState<Ticks>(() => loadTicks())
  const [metrics, setMetrics] = useState<MetricsMap>(() => loadMetrics())
  const [health, setHealth] = useState<HealthMap>(() => loadHealth())
  const [workouts, setWorkouts] = useState<WorkoutMap>(() => loadWorkouts())
  // the waking day: after midnight it stays yesterday until the band reads the night (lib/day.ts)
  const { today, calendar, startsAt } = useToday()
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
  const sleepLink = useGameLink()
  useEffect(() => {
    if (cloud.status === 'connecting') return
    setSleepScores(Object.fromEntries(Object.entries(sleepLink.body).flatMap(([d, b]) => (typeof b.sleepScore === 'number' ? [[d, b.sleepScore]] : []))))
    for (const snap of [...seedLegacyMonths(), ...ensureMonths(habits, ticks, today)])
      cloud.emit('month', { ym: snap.ym, snapshot: JSON.stringify(snap) }, `${snap.ym}-01`)
  }, [habits, ticks, today, cloud, sleepLink])

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

  // Sleep comes back as a pillar the band fills (version 13): first row, never ticked by hand. Only once: a Sleep habit
  // the user closes again after that is left closed.
  useEffect(() => {
    if (!settled) return
    const cfg = getConfig()
    if (cfg.deleted.includes(SLEEP_HABIT)) return
    const h = cfg.habits.find((x) => x.id === SLEEP_HABIT)
    if (h && (isActiveOn(h, today) || h.spans.some((sp) => sp.to === null || sp.to > V13_START))) return
    const sleep = { id: SLEEP_HABIT, name: 'Sleep', emoji: '🌙', tier: 'pillar' as Tier, domain: 'sleep' as const }
    const rest = cfg.habits.filter((x) => x.id !== SLEEP_HABIT)
    const revived = h ? { ...h, ...sleep, spans: [...h.spans, { from: today, to: null }] } : { ...sleep, spans: [{ from: today, to: null }] }
    emitConfig(commitConfig({ ...cfg, habits: [revived, ...rest], at: new Date().toISOString(), source: 'app' }))
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
  // while Sleep waits for today's reading, ask whether Google has the night (and fetch it if it does)
  const sleepCheck = useHealthCheck(sleepState(link, today) === 'waiting')
  const game = useGame(habits, ticks, arbor, shed, link, today)

  // Record today's habit list, with each habit's tier and domain. From rules
  // version 17 the latest list of a day stands, so adding, removing or changing
  // a habit here is what the game counts at once; before it, the first list
  // stood and a later one could only add habits. It is written again only when
  // it differs from the one standing, and never the same list twice from this
  // device: two devices with different libraries would otherwise overwrite each
  // other's list for ever.
  useEffect(() => {
    if (!settled || habits.length === 0) return
    const list = habits.filter((h) => isActiveOn(h, today)).map((h) => ({ id: h.id, tier: h.tier, tag: domainOf(h) }))
    if (list.length === 0) return
    const stands = link.lists[today]
    if (!listAdds(stands, list, today)) return
    const payload = { habits: JSON.stringify(list) }
    const sentKey = `lifeos.listsent.${today}`
    try { if (localStorage.getItem(sentKey) === payload.habits) return; localStorage.setItem(sentKey, payload.habits) } catch { /* private mode: it may be sent once more */ }
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
    // filled by the band's reading of the night; with no reading yet it can be reported by hand (version 14: a core habit, no Bells), and the reading replaces it
    if (habitId === SLEEP_HABIT && sleepMeasured(link, SLEEP_HABIT, today)) return
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
    // a tick is felt on a phone: a short double tap in, a single soft one out
    try {
      navigator.vibrate?.(wasTicked ? 8 : [14, 40, 22])
    } catch {
      /* no vibration here */
    }
  }

  // After midnight, before the band has read the night: the new day can be started by hand (one `day_start` for the date)
  const startDay = () => {
    const ev = { type: DAY_START_EVENT, day: calendar, at: new Date().toISOString(), payload: {} }
    applyGameEvents([ev])
    cloud.emit('day_start', {}, calendar)
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

  const syncLabel =
    (cloud.status === 'live' ? 'Cloud sync live' : cloud.status === 'connecting' ? 'Connecting to the cloud…' : cloud.status === 'error' ? 'Sync error: saved on this device' : 'Cloud sync off: saved on this device') +
    (cloud.pending > 0 ? ` · ${cloud.pending} waiting to send` : '')

  return (
    <div
      className={`safe-x safe-top mx-auto pb-28 ${
        tab === 'monthly'
          ? 'max-w-md sm:max-w-2xl lg:max-w-[1600px]'
          : 'max-w-md sm:max-w-2xl lg:max-w-4xl'
      }`}
    >
      <header className="app-head">
        <h1 className="app-logo">LifeOS</h1>
        <div className="app-date">
          <b>{new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}</b>
          <span>{new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        <span
          className={`sync-dot is-${cloud.status}`}
          role="img"
          aria-label={syncLabel}
          title={syncLabel}
        />
      </header>

      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        {tab === 'daily' && today !== calendar && (
          <div className="wake-banner neo-card" role="status">
            <span className="wake-moon" aria-hidden>🌙</span>
            <span className="min-w-0 flex-1">
              <b className="block">Still {new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}</b>
              <small className="block">Your day ends when you wake: it rolls over once the band reads the night, or at {clockOf(startsAt)}, two hours before you usually wake. Ticks now still count for {new Date(today + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}.</small>
            </span>
            <button type="button" className="wake-start" onClick={startDay}>Start my day</button>
          </div>
        )}
        {tab === 'daily' && (
          <HabitsScreen
            habits={habits}
            live={live}
            shelf={shelf}
            ticks={ticks}
            today={today}
            game={game}
            actions={actions}
            linked={{ workout: workouts[today], gymNext: nextGymDay(workouts, today).name, arbor, plan, onSkill, guitar: { shed, session, onLog: onGuitar }, sleep: { state: sleepState(link, today), night: link.nights[today], check: sleepCheck } }}
            weekly={weekly}
          />
        )}
        {tab === 'monthly' && (
          <MonthView habits={habits} ticks={ticks} today={today} initialYm={monthFocus ?? undefined} nights={link.nights} />
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
