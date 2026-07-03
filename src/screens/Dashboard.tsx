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
      <div className="flex items-end justify-between rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Today
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums tracking-tight">
            <AnimatedNumber value={todayXp} />
            <span className="ml-1.5 text-base font-medium text-zinc-500">XP</span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">cap {DAILY_CAP}</div>
        </div>
        <ProgressRing pct={doneCount / habits.length} label={`${doneCount}/${habits.length}`} />
      </div>

      {/* Wallet + level */}
      <motion.button
        onClick={onGoWallet}
        whileTap={{ scale: 0.97 }}
        className="block w-full rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-left"
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Wallet
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-cyan-300">
              <AnimatedNumber value={balance} />
              <span className="ml-1.5 text-sm font-medium text-zinc-500">XP spendable</span>
            </div>
          </div>
          <div className="rounded-full bg-violet-400/15 px-3 py-1 text-xs font-bold text-violet-300">
            LVL {lvl.level}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
            animate={{ width: `${Math.round(lvl.pct * 100)}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-zinc-600">
          <span>{lifetime.toLocaleString('en-IN')} lifetime XP</span>
          <span>next lvl at {lvl.next.toLocaleString('en-IN')}</span>
        </div>
      </motion.button>

      {/* 7-day chart */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Last 7 days
        </div>
        <div className="flex h-24 items-end gap-2">
          {series.map((d, i) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((d.xp / maxXp) * 100, 3)}%` }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 120, damping: 20 }}
                className={`w-full rounded-t-md ${
                  d.date === today ? 'bg-cyan-400' : d.xp > 0 ? 'bg-zinc-600' : 'bg-zinc-800'
                }`}
              />
              <span
                className={`text-[10px] font-semibold ${
                  d.date === today ? 'text-cyan-300' : 'text-zinc-600'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Streaks */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Streaks
        </div>
        {streaks.length === 0 ? (
          <div className="text-sm text-zinc-600">
            No streaks yet — 3 days in a row starts the fire. 🔥
          </div>
        ) : (
          <div className="space-y-2">
            {streaks.map(({ h, s }) => (
              <div key={h.id} className="flex items-center gap-3 text-sm">
                <span>{h.emoji}</span>
                <span className="flex-1 text-zinc-300">{h.name}</span>
                <span className="font-bold text-orange-400">🔥 {s}d</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <VaultCard vault={vault} />
    </div>
  )
}
