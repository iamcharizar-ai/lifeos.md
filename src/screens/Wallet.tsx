import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  dayEarned,
  LEISURE_RATE,
  levelInfo,
  lifetimeEarned,
  totalSpent,
  weekRecap,
  type Spend,
  type Stores,
} from '../lib/ledger'
import { AnimatedNumber } from '../components/AnimatedNumber'

const SPEND_OPTIONS = [
  { hours: 0.5, label: '30 min' },
  { hours: 1, label: '1 hour' },
  { hours: 2, label: '2 hours' },
]

type LedgerRow = {
  key: string
  when: string
  label: string
  delta: number
}

export function Wallet({
  stores,
  spends,
  today,
  onSpend,
}: {
  stores: Stores
  spends: Spend[]
  today: string
  onSpend: (hours: number, xp: number) => void
}) {
  const [justSpent, setJustSpent] = useState<number | null>(null)

  const lifetime = lifetimeEarned(stores)
  const balance = lifetime - totalSpent(spends)
  const lvl = levelInfo(lifetime)

  const week = useMemo(() => weekRecap(stores, spends, today), [stores, spends, today])
  const lastWeek = useMemo(() => weekRecap(stores, spends, today, -1), [stores, spends, today])
  const wow = week.net - lastWeek.net
  const isSunday = new Date(today + 'T12:00:00').getDay() === 0
  const maxDay = Math.max(...week.days.map((d) => d.earned), 1)

  const rows = useMemo<LedgerRow[]>(() => {
    const dates = new Set([
      ...Object.keys(stores.ticks),
      ...Object.keys(stores.health),
      ...Object.keys(stores.workouts),
    ])
    const earns: LedgerRow[] = [...dates]
      .map((date) => ({
        key: `earn-${date}`,
        when: date,
        label: 'Day earn — habits · health · bonuses',
        delta: dayEarned(stores, date),
      }))
      .filter((r) => r.delta > 0)
    const spendRows: LedgerRow[] = spends.map((s) => ({
      key: s.id,
      when: s.at.slice(0, 10),
      label: `Leisure · ${s.hours}h 🎮`,
      delta: -s.xp,
    }))
    return [...earns, ...spendRows].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 14)
  }, [stores, spends])

  const spend = (hours: number) => {
    const xp = Math.round(hours * LEISURE_RATE)
    if (xp > balance) return
    onSpend(hours, xp)
    setJustSpent(hours)
    setTimeout(() => setJustSpent(null), 2200)
  }

  return (
    <div className="space-y-4">
      {/* Balance hero */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Spendable balance
        </div>
        <div className="mt-2 text-5xl font-bold tabular-nums text-cyan-300">
          <AnimatedNumber value={balance} />
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {LEISURE_RATE} XP = 1 hour of leisure · LVL {lvl.level} ·{' '}
          {lifetime.toLocaleString('en-IN')} lifetime
        </div>
      </div>

      {/* Weekly payday */}
      <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-b from-violet-500/10 to-zinc-900/50 p-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-violet-300">
            {isSunday ? '💸 Payday' : 'This week'}
          </div>
          <span className="text-[10px] tabular-nums text-zinc-500">
            {week.startISO.slice(5)} – {week.endISO.slice(5)}
          </span>
        </div>

        <div className="mt-2 flex items-end gap-3">
          <div className="text-4xl font-bold tabular-nums text-zinc-100">
            <AnimatedNumber value={week.net} />
            <span className="ml-1 text-sm font-medium text-zinc-500">net XP</span>
          </div>
          {lastWeek.net !== 0 && (
            <span
              className={`mb-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                wow >= 0 ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'
              }`}
            >
              {wow >= 0 ? '▲' : '▼'} {Math.abs(wow)} vs last wk
            </span>
          )}
        </div>

        <div className="mt-1 flex gap-4 text-[11px] tabular-nums">
          <span className="text-emerald-400">+{week.earned} earned</span>
          <span className="text-rose-400">−{week.spent} spent</span>
        </div>

        {/* week ribbon — Mon→Sun earn bars */}
        <div className="mt-4 flex items-end gap-1.5">
          {week.days.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((d.earned / maxDay) * 100, 4)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  className={`w-full rounded-t ${
                    d.date === today
                      ? 'bg-violet-400'
                      : d.earned > 0
                        ? 'bg-violet-400/40'
                        : 'bg-zinc-800'
                  }`}
                />
              </div>
              <span
                className={`text-[9px] font-semibold ${
                  d.date === today ? 'text-violet-300' : 'text-zinc-600'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>

        {isSunday && (
          <div className="mt-3 rounded-xl bg-violet-400/10 px-3 py-2 text-center text-[11px] text-violet-200">
            Week closed. {week.net >= 0 ? 'Banked and carried forward.' : 'Overspent — earn it back.'} 🧾
          </div>
        )}
      </div>

      {/* Spend */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Buy leisure time 🎮
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SPEND_OPTIONS.map((o) => {
            const cost = Math.round(o.hours * LEISURE_RATE)
            const affordable = cost <= balance
            return (
              <motion.button
                key={o.hours}
                whileTap={affordable ? { scale: 0.93 } : undefined}
                onClick={() => spend(o.hours)}
                disabled={!affordable}
                className={`rounded-2xl border px-3 py-3 text-center transition-colors ${
                  affordable
                    ? 'border-cyan-400/40 bg-cyan-400/10 hover:border-cyan-400/70'
                    : 'cursor-not-allowed border-zinc-800 bg-zinc-900/40 opacity-40'
                }`}
              >
                <div className="text-sm font-bold">{o.label}</div>
                <div className="mt-0.5 text-xs tabular-nums text-cyan-300">−{cost} XP</div>
              </motion.button>
            )
          })}
        </div>
        <AnimatePresence>
          {justSpent !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-xl bg-emerald-400/15 px-4 py-2.5 text-center text-sm font-semibold text-emerald-300"
            >
              {justSpent}h of guilt-free leisure unlocked. Enjoy it — you paid for it. 🎮
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ledger */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Ledger
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600">Nothing yet — tick some habits.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 tabular-nums text-zinc-600">{r.when.slice(5)}</span>
                <span className="flex-1 text-zinc-300">{r.label}</span>
                <span
                  className={`font-bold tabular-nums ${
                    r.delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
