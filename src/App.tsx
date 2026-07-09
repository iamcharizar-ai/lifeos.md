import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { dateISO, loadTicks, saveTicks, type Ticks } from './lib/store'
import {
  loadHealth,
  loadMetrics,
  loadSpends,
  loadWorkouts,
  saveHealth,
  saveMetrics,
  saveSpends,
  saveWorkouts,
  type DayHealth,
  type DayMetrics,
  type HealthMap,
  type MetricsMap,
  type Spend,
  type Stores,
  type WorkoutMap,
} from './lib/ledger'
import { loadSkills, saveSkills, type SkillState, type SkillStatus } from './config/skills'
import { WATER_TARGET_ML } from './config/foods'
import type { Tier } from './config/habits'
import { applyConfig, configFromTemplate, configWithTier, useHabits } from './lib/habitConfig'
import { useCloudSync } from './lib/cloudSync'
import { useVault } from './lib/vaultSync'
import type { WorkoutSummary } from './lib/workout'
import { TabBar, type Tab } from './components/TabBar'
import { Dashboard } from './screens/Dashboard'
import { HabitsScreen } from './screens/HabitsScreen'
import { HealthScreen } from './screens/HealthScreen'
import { TrainScreen } from './screens/TrainScreen'
import { Wallet } from './screens/Wallet'
const GraphScreen = lazy(() =>
  import('./screens/GraphScreen').then((m) => ({ default: m.GraphScreen })),
)
// BodyScreen pulls in force-graph for the constellation — lazy like Graph
const BodyScreen = lazy(() =>
  import('./screens/BodyScreen').then((m) => ({ default: m.BodyScreen })),
)

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [ticks, setTicks] = useState<Ticks>(() => loadTicks())
  const [metrics, setMetrics] = useState<MetricsMap>(() => loadMetrics())
  const [health, setHealth] = useState<HealthMap>(() => loadHealth())
  const [workouts, setWorkouts] = useState<WorkoutMap>(() => loadWorkouts())
  const [spends, setSpends] = useState<Spend[]>(() => loadSpends())
  const [skills, setSkills] = useState<SkillState>(() => loadSkills())
  const today = dateISO()
  const vault = useVault()
  const habits = useHabits()

  useEffect(() => saveTicks(ticks), [ticks])
  useEffect(() => saveMetrics(metrics), [metrics])
  useEffect(() => saveHealth(health), [health])
  useEffect(() => saveWorkouts(workouts), [workouts])
  useEffect(() => saveSpends(spends), [spends])
  useEffect(() => saveSkills(skills), [skills])

  const stores = useMemo<Stores>(
    () => ({ ticks, metrics, health, workouts }),
    [ticks, metrics, health, workouts],
  )

  // Phone↔PC sync via Supabase event ledger — inert until .env.local has keys
  const cloud = useCloudSync(
    { stores, spends, skills },
    { setTicks, setMetrics, setHealth, setWorkouts, setSpends, setSkills },
  )

  // Auto write-back: any state change flows into the vault's daily note (PC, when linked)
  useEffect(() => {
    if (vault.status !== 'ready') return
    const t = setTimeout(() => void vault.writeNow(stores, today), 1500)
    return () => clearTimeout(t)
  }, [stores, habits, today, vault.status, vault.writeNow]) // eslint-disable-line react-hooks/exhaustive-deps

  // Habit-list authority: poll the vault's daily template (PC, when linked) and
  // broadcast edits as a config event — the phone picks the new list up live.
  useEffect(() => {
    if (vault.status !== 'ready') return
    let stopped = false
    const check = async () => {
      const text = await vault.readTemplateText()
      if (stopped || !text) return
      const cfg = configFromTemplate(text)
      if (cfg && applyConfig(cfg))
        cloud.emit('config', { habits: JSON.stringify(cfg.habits) }, cfg.at.slice(0, 10))
    }
    void check()
    const t = setInterval(() => void check(), 20_000)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => {
      stopped = true
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [vault.status, vault.readTemplateText, cloud.emit]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const setMetric = (key: keyof DayMetrics, value: string) => {
    setMetrics((prev) => ({ ...prev, [today]: { ...(prev[today] ?? {}), [key]: value } }))
    cloud.emitField('metric', key, value)
  }

  const setHealthField = (key: keyof DayHealth, value: string) => {
    setHealth((prev) => ({ ...prev, [today]: { ...(prev[today] ?? {}), [key]: value } }))
    cloud.emitField('health', key, value)
  }

  // Finish Workout: the only moment a session touches the ledger — one event,
  // summary JSON in the payload; vault write-back follows via the effect above.
  const finishWorkout = (summary: WorkoutSummary) => {
    setWorkouts((prev) => ({
      ...prev,
      [today]: { type: summary.name, at: summary.finishedAt, session: summary },
    }))
    cloud.emit('workout', {
      type: summary.name,
      at: summary.finishedAt,
      session: JSON.stringify(summary),
    })
  }

  const clearWorkout = () => {
    setWorkouts((prev) => {
      const next = { ...prev }
      delete next[today]
      return next
    })
    cloud.emit('workout_clear', {})
  }

  const cycleTier = (habitId: string) => {
    const order: Tier[] = ['core', 'standard', 'basic']
    const h = habits.find((x) => x.id === habitId)
    if (!h) return
    const next = order[(order.indexOf(h.tier) + 1) % order.length]
    const cfg = configWithTier(habitId, next)
    if (cfg && applyConfig(cfg)) cloud.emit('config', { habits: JSON.stringify(cfg.habits) })
  }

  const setSkill = (id: string, status: SkillStatus) => {
    setSkills((prev) => ({ ...prev, [id]: status }))
    cloud.emit('skill', { skillId: id, status })
  }

  const spend = (hours: number, xp: number) => {
    const sp = { id: crypto.randomUUID(), at: new Date().toISOString(), hours, xp }
    setSpends((prev) => [...prev, sp])
    cloud.emit('spend', { id: sp.id, at: sp.at, hours, xp })
  }

  // Thirst ping: red dot on the Health tab when no water has landed for 2h+
  // during waking hours (or none at all by 9am). Re-evaluated every minute.
  const [minuteTick, setMinuteTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMinuteTick((x) => x + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  const thirsty = useMemo(() => {
    void minuteTick
    const h = health[today]
    const waterMl = parseFloat(h?.water ?? '0') || 0
    if (waterMl >= WATER_TARGET_ML) return false
    const hour = new Date().getHours()
    if (hour < 8 || hour >= 22) return false
    if (!h?.waterAt) return hour >= 9
    return Date.now() - new Date(h.waterAt).getTime() > 2 * 60 * 60 * 1000
  }, [health, today, minuteTick])

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="safe-x safe-top mx-auto max-w-md pb-28 sm:max-w-2xl lg:max-w-4xl">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="font-display text-sm font-bold uppercase tracking-[0.3em] text-bone">
          LifeOS<span className="text-ember">//</span>HUD
        </h1>
        <span className="num text-xs text-ash">{dateLabel}</span>
      </header>

      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        {tab === 'dashboard' && (
          <Dashboard
            habits={habits}
            stores={stores}
            spends={spends}
            today={today}
            vault={vault}
            onGoWallet={() => setTab('wallet')}
          />
        )}
        {tab === 'habits' && (
          <HabitsScreen
            habits={habits}
            ticks={ticks}
            today={today}
            onToggle={toggle}
            onCycleTier={cycleTier}
          />
        )}
        {tab === 'health' && (
          <HealthScreen
            health={health[today]}
            onChange={setHealthField}
            metrics={metrics[today]}
            onMetric={setMetric}
          />
        )}
        {tab === 'body' && (
          <Suspense
            fallback={<div className="py-16 text-center text-xs text-dim">charting the constellation…</div>}
          >
            <BodyScreen skills={skills} onSkill={setSkill} />
          </Suspense>
        )}
        {tab === 'train' && (
          <TrainScreen
            workout={workouts[today]}
            onFinishWorkout={finishWorkout}
            onClearWorkout={clearWorkout}
          />
        )}
        {tab === 'wallet' && (
          <Wallet stores={stores} spends={spends} today={today} onSpend={spend} />
        )}
        {tab === 'graph' && (
          <Suspense
            fallback={<div className="py-16 text-center text-xs text-dim">weaving the web…</div>}
          >
            <GraphScreen />
          </Suspense>
        )}
      </motion.main>

      <footer className="hud-label mt-8 text-center !text-[9px] !text-dim">
        Phase 1–4 · v1.0 · forge-terminal ·{' '}
        {cloud.status === 'live' && '☁️ cloud sync live'}
        {cloud.status === 'connecting' && '☁️ connecting…'}
        {cloud.status === 'error' && '☁️ sync error'}
        {cloud.status === 'off' && 'cloud sync off (no keys)'}
        {cloud.pending > 0 && ` · ${cloud.pending} queued`}
      </footer>

      <TabBar tab={tab} onChange={setTab} alerts={{ health: thirsty }} />
    </div>
  )
}
