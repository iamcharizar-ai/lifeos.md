import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  dayEarned,
  LEISURE_RATE,
  levelInfo,
  lifetimeEarned,
  totalSpent,
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
  onSpend,
}: {
  stores: Stores
  spends: Spend[]
  onSpend: (hours: number, xp: number) => void
}) {
  const [justSpent, setJustSpent] = useState<number | null>(null)

  const lifetime = lifetimeEarned(stores)
  const balance = lifetime - totalSpent(spends)
  const lvl = levelInfo(lifetime)

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
