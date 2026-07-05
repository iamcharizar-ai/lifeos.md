import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CoinSlot } from '../components/CoinSlot'
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
  const [denom, setDenom] = useState(1) // hours selected for the coin

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
      <div className="plate p-5 text-center">
        <div className="hud-label">Spendable balance</div>
        <div className="num mt-2 font-display text-5xl font-bold text-gold">
          <AnimatedNumber value={balance} />
        </div>
        <div className="num mt-1 text-xs text-ash">
          LVL {lvl.level} · {lifetime.toLocaleString('en-IN')} lifetime XP
        </div>
      </div>

      {/* Weekly payday */}
      <div className="plate overflow-hidden bg-gradient-to-b from-gold/[0.07] to-plate p-5">
        <div className="flex items-baseline justify-between">
          <div className="hud-label !text-gold">{isSunday ? '💸 Payday' : 'This week'}</div>
          <span className="num text-[10px] text-dim">
            {week.startISO.slice(5)} – {week.endISO.slice(5)}
          </span>
        </div>

        <div className="mt-2 flex items-end gap-3">
          <div className="num font-display text-4xl font-bold text-bone">
            <AnimatedNumber value={week.net} />
            <span className="ml-1 font-sans text-sm font-medium text-ash">net XP</span>
          </div>
          {lastWeek.net !== 0 && (
            <span
              className={`chip num mb-1 border px-2 py-0.5 text-[10px] font-bold ${
                wow >= 0
                  ? 'border-sage/40 bg-sage/10 text-sage'
                  : 'border-ember-dim bg-ember/10 text-ember'
              }`}
            >
              {wow >= 0 ? '▲' : '▼'} {Math.abs(wow)} vs last wk
            </span>
          )}
        </div>

        <div className="num mt-1 flex gap-4 text-[11px]">
          <span className="text-sage">+{week.earned} earned</span>
          <span className="text-ember">−{week.spent} spent</span>
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
                  className={`chip w-full ${
                    d.date === today ? 'bg-gold' : d.earned > 0 ? 'bg-gold/35' : 'bg-plate2'
                  }`}
                />
              </div>
              <span
                className={`num text-[9px] font-semibold ${
                  d.date === today ? 'text-gold' : 'text-dim'
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}
        </div>

        {isSunday && (
          <div className="chip mt-3 border border-gold-dim bg-gold/10 px-3 py-2 text-center text-[11px] text-gold">
            Week closed. {week.net >= 0 ? 'Banked and carried forward.' : 'Overspent — earn it back.'} 🧾
          </div>
        )}
      </div>

      {/* Spend — the coin slot. Choosing is a tap; paying is a gesture. */}
      <div className="plate plate-raised p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="hud-label">Buy leisure time 🎮</div>
          <span className="num text-[10px] text-dim">{LEISURE_RATE} XP = 1h</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SPEND_OPTIONS.map((o) => {
            const cost = Math.round(o.hours * LEISURE_RATE)
            const affordable = cost <= balance
            const selected = denom === o.hours
            return (
              <motion.button
                key={o.hours}
                whileTap={affordable ? { scale: 0.93 } : undefined}
                onClick={() => affordable && setDenom(o.hours)}
                disabled={!affordable}
                className={`chip border px-3 py-2.5 text-center transition-colors ${
                  !affordable
                    ? 'cursor-not-allowed border-line bg-plate opacity-40'
                    : selected
                      ? 'border-gold-dim bg-gold/10'
                      : 'border-line bg-plate hover:border-line2'
                }`}
              >
                <div className={`text-sm font-bold ${selected ? 'text-gold' : 'text-bone'}`}>
                  {o.label}
                </div>
                <div className="num mt-0.5 text-xs text-ash">−{cost} XP</div>
              </motion.button>
            )
          })}
        </div>

        <div className="mt-4">
          <CoinSlot
            cost={Math.round(denom * LEISURE_RATE)}
            affordable={Math.round(denom * LEISURE_RATE) <= balance}
            onCommit={() => spend(denom)}
          />
        </div>
        <AnimatePresence>
          {justSpent !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="chip mt-3 border border-sage/40 bg-sage/10 px-4 py-2.5 text-center text-sm font-semibold text-sage"
            >
              {justSpent}h of guilt-free leisure unlocked. Enjoy it — you paid for it. 🎮
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ledger */}
      <div className="plate p-5">
        <div className="hud-label mb-3">Ledger</div>
        {rows.length === 0 ? (
          <div className="text-sm text-dim">Nothing yet — tick some habits.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 text-sm">
                <span className="num w-20 shrink-0 text-dim">{r.when.slice(5)}</span>
                <span className="flex-1 text-bone">{r.label}</span>
                <span
                  className={`num font-bold ${r.delta > 0 ? 'text-gold' : 'text-ember'}`}
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
