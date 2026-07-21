import { useEffect, useMemo, useState } from 'react'
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
  type HealthMap,
  type MetricsMap,
  type Spend,
  type Stores,
  type WorkoutMap,
} from './lib/ledger'
import { loadSkills, saveSkills, type SkillState } from './config/skills'
import type { Tier } from './config/habits'
import { applyConfig, configWithTier, saveHabits, useHabits } from './lib/habitConfig'
import { useCloudSync } from './lib/cloudSync'
import { TabBar, type Tab } from './components/TabBar'
import { HabitsScreen } from './screens/HabitsScreen'

export default function App() {
  const [tab, setTab] = useState<Tab>('daily')
  const [ticks, setTicks] = useState<Ticks>(() => loadTicks())
  const [metrics, setMetrics] = useState<MetricsMap>(() => loadMetrics())
  const [health, setHealth] = useState<HealthMap>(() => loadHealth())
  const [workouts, setWorkouts] = useState<WorkoutMap>(() => loadWorkouts())
  const [spends, setSpends] = useState<Spend[]>(() => loadSpends())
  const [skills, setSkills] = useState<SkillState>(() => loadSkills())
  const today = dateISO()
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

  // Phone↔PC sync via Supabase event ledger
  const cloud = useCloudSync(
    { stores, spends, skills },
    { setTicks, setMetrics, setHealth, setWorkouts, setSpends, setSkills },
  )

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

  const cycleTier = (habitId: string) => {
    const order: Tier[] = ['core', 'standard', 'basic']
    const h = habits.find((x) => x.id === habitId)
    if (!h) return
    const next = order[(order.indexOf(h.tier) + 1) % order.length]
    const cfg = configWithTier(habitId, next)
    if (cfg && applyConfig(cfg)) cloud.emit('config', { habits: JSON.stringify(cfg.habits) })
  }

  const handleSaveHabits = (newHabits: typeof habits) => {
    const cfg = saveHabits(newHabits)
    cloud.emit('config', { habits: JSON.stringify(cfg.habits) })
  }

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="safe-x safe-top mx-auto max-w-md pb-28 sm:max-w-2xl lg:max-w-4xl">
      <header className="mb-6 flex items-baseline justify-between border-b-4 border-black pb-2">
        <h1 className="font-display text-xl font-bold uppercase tracking-widest text-black">
          LifeOS<span className="text-neo-blue ml-1.5">// TRACKER</span>
        </h1>
        <span className="num text-sm font-bold text-black">{dateLabel}</span>
      </header>

      <motion.main
        key={tab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <HabitsScreen
          tab={tab}
          habits={habits}
          ticks={ticks}
          today={today}
          stores={stores}
          onToggle={toggle}
          onCycleTier={cycleTier}
          onSaveHabits={handleSaveHabits}
        />
      </motion.main>

      <footer className="hud-label mt-8 text-center !text-[10px] !text-neo-gray-dark border-none">
        v2.0 · cloud sync habit tracker ·{' '}
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

