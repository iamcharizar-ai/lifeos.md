import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Habit } from '../config/habits'
import type { Ticks } from '../lib/store'

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
  const avgPct = Math.round((monthDone / activeDays) * 100)

  return (
    <div className="space-y-4">
      {/* Month nav & stats */}
      <div className="neo-card flex items-center justify-between p-3 bg-white">
        <button
          onClick={() => nav(-1)}
          className="neo-button px-3 py-1 text-sm font-bold"
          aria-label="Previous month"
        >
          ◄ Prev
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-bold uppercase tracking-wider text-black">
            {label}
          </div>
          <div className="num text-xs font-bold text-neo-gray-dark">
            Monthly Average: <span className="text-black">{avgPct}%</span>
          </div>
        </div>
        <button
          onClick={() => nav(1)}
          className="neo-button px-3 py-1 text-sm font-bold"
          aria-label="Next month"
        >
          Next ►
        </button>
      </div>

      {/* Completion graph */}
      <div className="neo-card neo-card-pink p-4">
        <div className="hud-label border-black mb-3 text-xs">Daily Completion Rate</div>
        <div className="flex h-24 items-end gap-1 border-b-2 border-black pb-1">
          {days.map((d, i) => {
            const isToday = iso(d) === today
            return (
              <div key={d} className="flex h-full flex-1 flex-col justify-end items-center">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(dayPct[i] * 100, isFuture(d) ? 0 : 4)}%` }}
                  transition={{ delay: i * 0.012, type: 'spring', stiffness: 150, damping: 22 }}
                  className={`w-full border-t-2 border-x border-black ${
                    isToday ? 'bg-neo-yellow' : dayPct[i] > 0 ? 'bg-neo-blue' : 'bg-white/40'
                  }`}
                />
              </div>
            )
          })}
        </div>
        <div className="num mt-1 flex justify-between text-[10px] font-bold text-black">
          <span>Day 1</span>
          <span>Day {Math.ceil(days.length / 2)}</span>
          <span>Day {days.length}</span>
        </div>
      </div>

      {/* Redesigned Brutalist Grid — habits left, days across */}
      <div className="neo-card p-3 bg-white overflow-hidden">
        <div className="hud-label border-black mb-3 text-xs">Habit Completion Matrix</div>
        
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max border-2 border-black rounded bg-neo-bg">
            {/* Header row: day numbers */}
            <div className="flex border-b-2 border-black bg-white sticky top-0 z-20">
              <div className="sticky left-0 z-30 w-44 shrink-0 border-r-2 border-black bg-white px-3 py-2 text-xs font-bold text-black uppercase tracking-wider">
                Habit
              </div>
              {days.map((d) => {
                const isToday = iso(d) === today
                return (
                  <div
                    key={d}
                    className={`num w-8 shrink-0 text-center py-2 text-xs font-bold border-r border-black/20 ${
                      isToday ? 'bg-neo-yellow text-black font-extrabold border-x-2 border-black' : 'text-black/70'
                    }`}
                  >
                    {d}
                  </div>
                )
              })}
              <div className="num w-12 shrink-0 text-center py-2 text-xs font-bold text-black border-l-2 border-black bg-white">
                Total
              </div>
            </div>

            {/* Habit rows */}
            {habits.map((h, idx) => {
              const rowDone = days.filter((d) => ticks[iso(d)]?.[h.id]).length
              return (
                <div
                  key={h.id}
                  className={`flex items-center border-b border-black/30 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-neo-bg'
                  }`}
                >
                  {/* Sticky left habit title */}
                  <div className="sticky left-0 z-10 w-44 shrink-0 truncate border-r-2 border-black bg-white px-3 py-2 text-xs font-bold text-neo-black flex items-center gap-1.5 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                    <span className="text-sm">{h.emoji}</span>
                    <span className="truncate">{h.name}</span>
                  </div>

                  {/* Day boxes */}
                  {days.map((d) => {
                    const done = Boolean(ticks[iso(d)]?.[h.id])
                    const future = isFuture(d)
                    const isToday = iso(d) === today

                    return (
                      <div
                        key={d}
                        className={`w-8 shrink-0 flex justify-center items-center py-1.5 border-r border-black/10 ${
                          isToday ? 'bg-neo-yellow/20 border-x border-black/30' : ''
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded border-2 border-black flex items-center justify-center text-xs font-bold transition-colors ${
                            done
                              ? 'bg-neo-green text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                              : future
                                ? 'bg-neo-gray/30 border-black/20'
                                : isToday
                                  ? 'bg-white border-black font-bold'
                                  : 'bg-white'
                          }`}
                        >
                          {done ? '✓' : ''}
                        </div>
                      </div>
                    )
                  })}

                  {/* Summary Total */}
                  <div className="num w-12 shrink-0 text-center py-2 text-xs font-bold text-black border-l-2 border-black bg-white">
                    {rowDone}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
