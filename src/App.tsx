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
import { useVault } from './lib/vaultSync'
import { TabBar, type Tab } from './components/TabBar'
import { Dashboard } from './screens/Dashboard'
import { HabitsScreen } from './screens/HabitsScreen'
import { HealthScreen } from './screens/HealthScreen'
import { BodyScreen } from './screens/BodyScreen'
import { Wallet } from './screens/Wallet'
const GraphScreen = lazy(() =>
  import('./screens/GraphScreen').then((m) => ({ default: m.GraphScreen })),
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

  // Auto write-back: any state change flows into the vault's daily note (PC, when linked)
  useEffect(() => {
    if (vault.status !== 'ready') return
    const t = setTimeout(() => void vault.writeNow(stores, today), 1500)
    return () => clearTimeout(t)
  }, [stores, today, vault.status, vault.writeNow]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (habitId: string) => {
    setTicks((prev) => {
      const day = { ...(prev[today] ?? {}) }
      if (day[habitId]) delete day[habitId]
      else day[habitId] = new Date().toISOString()
      return { ...prev, [today]: day }
    })
  }

  const setMetric = (key: keyof DayMetrics, value: string) =>
    setMetrics((prev) => ({ ...prev, [today]: { ...(prev[today] ?? {}), [key]: value } }))

  const setHealthField = (key: keyof DayHealth, value: string) =>
    setHealth((prev) => ({ ...prev, [today]: { ...(prev[today] ?? {}), [key]: value } }))

  const logWorkout = (type: string) =>
    setWorkouts((prev) => ({ ...prev, [today]: { type, at: new Date().toISOString() } }))

  const clearWorkout = () =>
    setWorkouts((prev) => {
      const next = { ...prev }
      delete next[today]
      return next
    })

  const setSkill = (id: string, status: SkillStatus) =>
    setSkills((prev) => ({ ...prev, [id]: status }))

  const spend = (hours: number, xp: number) =>
    setSpends((prev) => [
      ...prev,
      { id: crypto.randomUUID(), at: new Date().toISOString(), hours, xp },
    ])

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
          LifeOS · HUD
        </h1>
        <span className="text-xs text-zinc-500">{dateLabel}</span>
      </header>

      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {tab === 'dashboard' && (
          <Dashboard
            stores={stores}
            spends={spends}
            today={today}
            vault={vault}
            onGoWallet={() => setTab('wallet')}
          />
        )}
        {tab === 'habits' && (
          <HabitsScreen
            ticks={ticks}
            today={today}
            onToggle={toggle}
            metrics={metrics[today]}
            onMetric={setMetric}
          />
        )}
        {tab === 'health' && <HealthScreen health={health[today]} onChange={setHealthField} />}
        {tab === 'body' && (
          <BodyScreen
            workout={workouts[today]}
            onLogWorkout={logWorkout}
            onClearWorkout={clearWorkout}
            skills={skills}
            onSkill={setSkill}
          />
        )}
        {tab === 'wallet' && <Wallet stores={stores} spends={spends} onSpend={spend} />}
        {tab === 'graph' && (
          <Suspense
            fallback={<div className="py-16 text-center text-xs text-zinc-600">weaving the web…</div>}
          >
            <GraphScreen />
          </Suspense>
        )}
      </motion.main>

      <footer className="mt-8 text-center text-[10px] uppercase tracking-widest text-zinc-700">
        Phase 1–2 · v0.3 · local + vault write-back — Supabase sync pending
      </footer>

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
