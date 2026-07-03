import { motion } from 'framer-motion'
import type { Habit } from '../config/habits'
import { streakFor } from '../lib/store'
import { DAILY_CAP } from '../lib/xp'
import {
  dayEarned,
  levelInfo,
  lifetimeEarned,
  totalSpent,
  xpSeries,
  type Spend,
  type Stores,
} from '../lib/ledger'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ProgressRing } from '../components/ProgressRing'
import { VaultCard } from '../components/VaultCard'
import type { useVault } from '../lib/vaultSync'

export function Dashboard({
  habits,
  stores,
  spends,
  today,
  vault,
  onGoWallet,
}: {
  habits: Habit[]
  stores: Stores
  spends: Spend[]
  today: string
  vault: ReturnType<typeof useVault>
  onGoWallet: () => void
}) {
  const todayXp = dayEarned(stores, today)
  const doneCount = habits.filter((h) => stores.ticks[today]?.[h.id]).length
  const lifetime = lifetimeEarned(stores)
  const balance = lifetime - totalSpent(spends)
  const lvl = levelInfo(lifetime)
  const series = xpSeries(stores, 7)
  const maxXp = Math.max(...series.map((s) => s.xp), 1)
  const streaks = habits.map((h) => ({ h, s: streakFor(stores.ticks, h.id, today) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Today hero */}
      <div className="plate flex items-end justify-between p-5">
        <div>
          <div className="hud-label">Today</div>
          <div className="num mt-1 font-display text-4xl font-bold tracking-tight text-bone">
            <AnimatedNumber value={todayXp} />
            <span className="ml-1.5 font-sans text-base font-medium text-gold">XP</span>
          </div>
          <div className="num mt-1 text-[11px] text-dim">cap {DAILY_CAP}</div>
        </div>
        <ProgressRing pct={doneCount / habits.length} label={`${doneCount}/${habits.length}`} />
      </div>

      {/* Wallet + level */}
      <motion.button
        onClick={onGoWallet}
        whileTap={{ scale: 0.97 }}
        className="plate block w-full p-5 text-left"
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="hud-label">Wallet</div>
            <div className="num mt-1 font-display text-3xl font-bold text-gold">
              <AnimatedNumber value={balance} />
              <span className="ml-1.5 font-sans text-sm font-medium text-ash">XP spendable</span>
            </div>
          </div>
          <div className="chip border border-gold-dim bg-gold/10 px-3 py-1 font-display text-xs font-bold text-gold">
            LVL {lvl.level}
          </div>
        </div>
        <div className="chip mt-3 h-1.5 overflow-hidden bg-plate2">
          <motion.div
            className="h-full bg-gradient-to-r from-ember to-gold"
            animate={{ width: `${Math.round(lvl.pct * 100)}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
        <div className="num mt-1.5 flex justify-between text-[10px] text-dim">
          <span>{lifetime.toLocaleString('en-IN')} lifetime XP</span>
          <span>next lvl at {lvl.next.toLocaleString('en-IN')}</span>
        </div>
      </motion.button>

      {/* 7-day chart */}
      <div className="plate p-5">
        <div className="hud-label mb-3">Last 7 days</div>
        <div className="flex h-24 items-end gap-2">
          {series.map((d, i) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((d.xp / maxXp) * 100, 3)}%` }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 20 }}
                className={`chip w-full ${
                  d.date === today ? 'bg-gold' : d.xp > 0 ? 'bg-line2' : 'bg-plate2'
                }`}
              />
              <span
                className={`num text-[10px] font-semibold ${
                  d.date === today ? 'text-gold' : 'text-dim'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Streaks */}
      <div className="plate p-5">
        <div className="hud-label mb-3">Streaks</div>
        {streaks.length === 0 ? (
          <div className="text-sm text-dim">No streaks yet — 3 days in a row starts the fire. 🔥</div>
        ) : (
          <div className="space-y-2">
            {streaks.map(({ h, s }) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <span>{h.emoji}</span>
                <span className="flex-1 text-bone">{h.name}</span>
                <span className="num font-bold text-ember">🔥 {s}d</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <VaultCard vault={vault} />
    </div>
  )
}
