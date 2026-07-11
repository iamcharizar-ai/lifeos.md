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
  type HealthMap,
  type MetricsMap,
  type Spend,
  type Stores,
  type WorkoutMap,
} from './lib/ledger'
import { loadSkills, saveSkills, type SkillState } from './config/skills'
import type { Tier } from './config/habits'
import { applyConfig, configFromTemplate, configWithTier, useHabits } from './lib/habitConfig'
import { useCloudSync } from './lib/cloudSync'
import { useVault } from './lib/vaultSync'
import { TabBar, type Tab } from './components/TabBar'
import { Dashboard } from './screens/Dashboard'
import { HabitsScreen } from './screens/HabitsScreen'
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

  const cycleTier = (habitId: string) => {
    const order: Tier[] = ['core', 'standard', 'basic']
    const h = habits.find((x) => x.id === habitId)
    if (!h) return
    const next = order[(order.indexOf(h.tier) + 1) % order.length]
    const cfg = configWithTier(habitId, next)
    if (cfg && applyConfig(cfg)) cloud.emit('config', { habits: JSON.stringify(cfg.habits) })
  }

  const spend = (hours: number, xp: number) => {
    const sp = { id: crypto.randomUUID(), at: new Date().toISOString(), hours, xp }
    setSpends((prev) => [...prev, sp])
    cloud.emit('spend', { id: sp.id, at: sp.at, hours, xp })
  }

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
        v1.2 · forge-terminal · health+train → pipeline · body → arbor ·{' '}
        {cloud.status === 'live' && '☁️ cloud sync live'}
        {cloud.status === 'connecting' && '☁️ connecting…'}
        {cloud.status === 'error' && '☁️ sync error'}
        {cloud.status === 'off' && 'cloud sync off (no keys)'}
        {cloud.pending > 0 && ` · ${cloud.pending} queued`}
      </footer>

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}
