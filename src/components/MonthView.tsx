import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Habit } from '../config/habits'
import type { Ticks } from '../lib/store'

// Read-only month dashboard: completion-% graph up top, habits down the left,
// tick grid in the middle. Modeled on Rishabh's paper tracker spreads — for
// seeing trends, not editing.

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function MonthView({
  habits,
  ticks,
  today,
}: {
  habits: Habit[]
  ticks: Ticks
  today: string
}) {
  const [ym, setYm] = useState(() => today.slice(0, 7)) // YYYY-MM

  const { year, month, days, label } = useMemo(() => {
    const [y, m] = ym.split('-').map(Number)
    const count = new Date(y, m, 0).getDate()
    return {
      year: y,
      month: m,
      days: Array.from({ length: count }, (_, i) => i + 1),
      label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
    }
  }, [ym])

  const iso = (d: number) => `${year}-${pad2(month)}-${pad2(d)}`
  const isFuture = (d: number) => iso(d) > today

  const dayPct = useMemo(
    () =>
      days.map((d) => {
        if (habits.length === 0) return 0
        const t = ticks[iso(d)]
        if (!t) return 0
        return habits.filter((h) => t[h.id]).length / habits.length
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, habits, ticks, ym],
  )

  const nav = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYm(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }

  const monthDone = dayPct.reduce((a, p) => a + p, 0)
  const activeDays = days.filter((d) => !isFuture(d)).length || 1

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => nav(-1)} className="chip border border-line bg-plate px-3 py-1 text-xs text-ash hover:text-bone" aria-label="Previous month">
          ‹
        </button>
        <div className="text-center">
          <div className="font-display text-sm font-bold uppercase tracking-[0.18em] text-bone">
            {label}
          </div>
          <div className="num text-[9px] text-dim">
            avg {Math.round((monthDone / activeDays) * 100)}% · view only — tick in Today
          </div>
        </div>
        <button onClick={() => nav(1)} className="chip border border-line bg-plate px-3 py-1 text-xs text-ash hover:text-bone" aria-label="Next month">
          ›
        </button>
      </div>

      {/* Completion graph */}
      <div className="plate p-4">
        <div className="hud-label mb-2">Day completion %</div>
        <div className="flex h-20 gap-px">
          {days.map((d, i) => (
            <div key={d} className="flex h-full flex-1 items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(dayPct[i] * 100, isFuture(d) ? 0 : 2)}%` }}
                transition={{ delay: i * 0.012, type: 'spring', stiffness: 150, damping: 22 }}
                className={iso(d) === today ? 'w-full bg-ember' : 'w-full bg-gold'}
                style={
                  iso(d) === today ? undefined : { opacity: 0.25 + dayPct[i] * 0.75 }
                }
              />
            </div>
          ))}
        </div>
        <div className="num mt-1 flex justify-between text-[8px] text-dim">
          <span>1</span>
          <span>{Math.ceil(days.length / 2)}</span>
          <span>{days.length}</span>
        </div>
      </div>

      {/* Tick grid — habits left, days across */}
      <div className="plate overflow-x-auto p-3">
        <div className="min-w-max">
          {/* day-number header */}
          <div className="flex">
            <div className="sticky left-0 z-10 w-32 shrink-0 bg-plate" />
            {days.map((d) => (
              <div
                key={d}
                className={`num w-4 shrink-0 text-center text-[7px] ${
                  iso(d) === today ? 'font-bold text-ember' : 'text-dim'
                }`}
              >
                {d}
              </div>
            ))}
            <div className="num w-8 shrink-0 text-right text-[7px] text-dim">Σ</div>
          </div>
          {habits.map((h) => {
            const rowDone = days.filter((d) => ticks[iso(d)]?.[h.id]).length
            return (
              <div key={h.id} className="flex items-center border-t border-line/40 py-[3px]">
                <div className="sticky left-0 z-10 w-32 shrink-0 truncate bg-plate pr-2 text-[10px] text-ash">
                  {h.emoji} {h.name}
                </div>
                {days.map((d) => {
                  const done = Boolean(ticks[iso(d)]?.[h.id])
                  const future = isFuture(d)
                  return (
                    <div key={d} className="flex w-4 shrink-0 justify-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-[2px] ${
                          done
                            ? 'bg-gold'
                            : future
                              ? 'border border-line/40'
                              : iso(d) === today
                                ? 'border border-ember/60 bg-plate2'
                                : 'bg-plate2'
                        }`}
                      />
                    </div>
                  )
                })}
                <div className="num w-8 shrink-0 text-right text-[8px] text-dim">{rowDone}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
