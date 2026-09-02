// Month review. Reads the whole habit library, not today's checklist, and
// scores every day against the checklist as it stood *that day*:
//   done   — ticked
//   missed — was on the checklist, not ticked
//   n/a    — not a habit yet, or already dropped (grey; never counted)
//   future — hasn't happened
// That is what stops a mid-month edit from rewriting the earlier bars, and it
// keeps a habit added on the 20th from looking like nineteen failures.
import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { archivedOn, isActiveOn, isLive, type Habit } from '../config/habits'
import type { Ticks } from '../lib/store'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const HIDDEN_KEY = 'lifeos.monthview.hidden.v1'

type Cell = 'done' | 'missed' | 'na' | 'future'

/** bar colour scales with completion so the month reads at a glance */
function barTone(pct: number): string {
  if (pct >= 0.8) return 'bg-neo-green'
  if (pct >= 0.5) return 'bg-neo-blue'
  if (pct >= 0.25) return 'bg-neo-orange'
  if (pct > 0) return 'bg-neo-red'
  return 'bg-white/40'
}

function loadHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function MonthView({
  habits,
  ticks,
  today,
}: {
  /** the full library — dropped habits still have months to show */
  habits: Habit[]
  ticks: Ticks
  today: string
}) {
  const [ym, setYm] = useState(() => today.slice(0, 7)) // YYYY-MM
  const [hidden, setHidden] = useState<string[]>(loadHidden)
  const [showDropped, setShowDropped] = useState(true)

  const persistHidden = useCallback((next: string[]) => {
    setHidden(next)
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
    } catch {
      /* quota — hiding is a view preference, safe to lose */
    }
  }, [])

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

  const iso = useCallback(
    (d: number) => `${year}-${pad2(month)}-${pad2(d)}`,
    [year, month],
  )
  const isFuture = (d: number) => iso(d) > today
  const dow = (d: number) => new Date(year, month - 1, d).getDay()
  const isWeekend = (d: number) => dow(d) === 0 || dow(d) === 6

  /** Habits with any life (or any tick) inside this month — the rows worth showing. */
  const monthHabits = useMemo(
    () =>
      habits.filter((h) =>
        days.some((d) => isActiveOn(h, iso(d)) || Boolean(ticks[iso(d)]?.[h.id])),
      ),
    [habits, days, iso, ticks],
  )

  /** One cell's meaning. A tick always wins: no logged day is ever hidden. */
  const cellOf = useCallback(
    (h: Habit, d: number): Cell => {
      const day = iso(d)
      if (ticks[day]?.[h.id]) return 'done'
      if (day > today) return 'future'
      return isActiveOn(h, day) ? 'missed' : 'na'
    },
    [iso, ticks, today],
  )

  /** Per-day done / expected, where "expected" is that day's own checklist size. */
  const dayStats = useMemo(
    () =>
      days.map((d) => {
        let done = 0
        let expected = 0
        for (const h of monthHabits) {
          const c = cellOf(h, d)
          if (c === 'done') {
            done++
            expected++
          } else if (c === 'missed') expected++
        }
        return { done, expected, pct: expected === 0 ? null : done / expected }
      }),
    [days, monthHabits, cellOf],
  )

  const nav = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    setYm(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`)
  }

  const scored = dayStats.filter((s) => s.pct !== null)
  const avgPct = scored.length
    ? Math.round((scored.reduce((a, s) => a + (s.pct as number), 0) / scored.length) * 100)
    : 0
  const bestPct = scored.length ? Math.round(Math.max(...scored.map((s) => s.pct as number)) * 100) : 0
  const perfectDays = scored.filter((s) => (s.pct as number) >= 1).length
  const zeroDays = scored.filter((s) => s.done === 0).length
  const totalTicks = dayStats.reduce((a, s) => a + s.done, 0)

  const droppedIds = useMemo(
    () => new Set(monthHabits.filter((h) => !isLive(h)).map((h) => h.id)),
    [monthHabits],
  )

  const rows = monthHabits.filter(
    (h) => !hidden.includes(h.id) && (showDropped || !droppedIds.has(h.id)),
  )
  const hiddenCount = monthHabits.length - rows.length

  return (
    <div className="space-y-4">
      {/* Month nav & stats */}
      <div className="neo-card flex items-center justify-between bg-white p-3">
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
            <span className="mx-1.5 text-black/30">|</span>
            {monthHabits.length} habits ran
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

      {/* Month stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: 'Best Day', v: `${bestPct}%` },
          { k: 'Perfect Days', v: `${perfectDays}` },
          { k: 'Zero Days', v: `${zeroDays}` },
          { k: 'Total Ticks', v: `${totalTicks}` },
        ].map((s) => (
          <div key={s.k} className="neo-card bg-white px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark">
              {s.k}
            </div>
            <div className="num font-display text-xl font-bold text-black">{s.v}</div>
          </div>
        ))}
      </div>

      {/* Completion graph */}
      <div className="neo-card neo-card-pink p-4">
        <div className="hud-label mb-3 border-black text-xs">
          Daily Completion Rate — against that day&apos;s own checklist
        </div>
        <div className="flex h-40 items-end gap-1 border-b-2 border-black pb-1">
          {days.map((d, i) => {
            const isToday = iso(d) === today
            const future = isFuture(d)
            const { done, expected, pct } = dayStats[i]
            return (
              <div
                key={d}
                className="group flex h-full flex-1 flex-col items-center justify-end"
                title={
                  future
                    ? `${pad2(d)} ${label} — upcoming`
                    : pct === null
                      ? `${pad2(d)} ${label} — no habits scheduled`
                      : `${pad2(d)} ${label} — ${done}/${expected} habits (${Math.round(pct * 100)}%)`
                }
              >
                {!future && pct !== null && (
                  <div
                    className={`num mb-0.5 w-full text-center text-[9px] font-bold leading-none ${
                      pct > 0 ? 'text-black' : 'text-black/35'
                    }`}
                  >
                    {Math.round(pct * 100)}
                  </div>
                )}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{
                    height: `${pct === null ? (future ? 0 : 100) : Math.max(pct * 100, 3)}%`,
                  }}
                  transition={{ delay: i * 0.012, type: 'spring', stiffness: 150, damping: 22 }}
                  className={`w-full border-x border-t-2 border-black ${
                    pct === null
                      ? 'bg-neo-gray/30 border-dashed'
                      : isToday
                        ? 'bg-neo-yellow'
                        : barTone(pct)
                  }`}
                />
              </div>
            )
          })}
        </div>
        {/* day-number axis, one tick per bar so a % lines up with its date */}
        <div className="mt-1 flex gap-1">
          {days.map((d) => (
            <div
              key={d}
              className={`num flex-1 text-center text-[9px] font-bold leading-none ${
                iso(d) === today ? 'text-black underline' : 'text-black/60'
              }`}
            >
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Brutalist Grid — habits left, days across */}
      <div className="neo-card overflow-hidden bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="hud-label border-black text-xs">Habit Completion Matrix</div>
          <div className="flex flex-wrap items-center gap-2">
            {droppedIds.size > 0 && (
              <button
                onClick={() => setShowDropped((s) => !s)}
                className="neo-button bg-white px-2.5 py-1 text-[10px] font-bold uppercase"
              >
                {showDropped ? `Hide dropped (${droppedIds.size})` : `Show dropped (${droppedIds.size})`}
              </button>
            )}
            {hidden.length > 0 && (
              <button
                onClick={() => persistHidden([])}
                className="neo-button neo-card-yellow px-2.5 py-1 text-[10px] font-bold uppercase"
              >
                ↺ Reset rows ({hidden.length})
              </button>
            )}
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-3 text-[10px] font-bold text-neo-gray-dark">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-neo-green" /> done
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> missed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-dashed border-black/30 bg-neo-gray/30" />{' '}
            not a habit then
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-neo-red" /> dropped habit
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-max rounded border-2 border-black bg-neo-bg">
            {/* Header row: day numbers */}
            <div className="sticky top-0 z-20 flex border-b-2 border-black bg-white">
              <div className="sticky left-0 z-30 w-40 shrink-0 border-r-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-black lg:w-48">
                Habit
              </div>
              {days.map((d) => {
                const isToday = iso(d) === today
                return (
                  <div
                    key={d}
                    className={`num w-7 shrink-0 border-r border-black/20 py-1 text-center text-xs font-bold lg:w-8 ${
                      isToday
                        ? 'border-x-2 border-black bg-neo-yellow font-extrabold text-black'
                        : isWeekend(d)
                          ? 'bg-black/5 text-black/70'
                          : 'text-black/70'
                    }`}
                  >
                    <div>{d}</div>
                    <div className="text-[9px] font-bold text-black/40">{DOW[dow(d)]}</div>
                  </div>
                )
              })}
              <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-2 text-center text-xs font-bold text-black">
                Total
              </div>
            </div>

            {/* Habit rows */}
            {rows.map((h, idx) => {
              const cells = days.map((d) => cellOf(h, d))
              const rowDone = cells.filter((c) => c === 'done').length
              const rowEligible = cells.filter((c) => c === 'done' || c === 'missed').length
              const rowPct = rowEligible === 0 ? null : Math.round((rowDone / rowEligible) * 100)
              const isDropped = droppedIds.has(h.id)
              const dropDay = archivedOn(h)
              return (
                <div
                  key={h.id}
                  className={`flex items-center border-b border-black/30 ${
                    isDropped ? 'bg-neo-red/10' : idx % 2 === 0 ? 'bg-white' : 'bg-neo-bg'
                  }`}
                >
                  {/* Sticky left habit title */}
                  <div
                    className={`sticky left-0 z-10 flex w-40 shrink-0 items-center gap-1.5 border-r-2 border-black px-2 py-2 text-xs font-bold shadow-[2px_0_4px_rgba(0,0,0,0.05)] lg:w-48 ${
                      isDropped ? 'bg-neo-red/20 text-neo-red' : 'bg-white text-neo-black'
                    }`}
                  >
                    <button
                      onClick={() => persistHidden([...hidden, h.id])}
                      title={`Hide ${h.name} from this table`}
                      aria-label={`Hide ${h.name}`}
                      className="shrink-0 border-2 border-black bg-white px-1 text-[10px] leading-none text-black"
                    >
                      🚫
                    </button>
                    <span className="text-sm">{h.emoji}</span>
                    <span
                      className={`truncate ${isDropped ? 'line-through decoration-2' : ''}`}
                      title={
                        isDropped && dropDay
                          ? `${h.name} — dropped ${dropDay}`
                          : h.name
                      }
                    >
                      {h.name}
                    </span>
                  </div>

                  {/* Day boxes */}
                  {days.map((d, i) => {
                    const c = cells[i]
                    const isToday = iso(d) === today
                    return (
                      <div
                        key={d}
                        title={`${h.name} — ${pad2(d)} ${label}: ${
                          c === 'done'
                            ? 'done'
                            : c === 'missed'
                              ? 'missed'
                              : c === 'na'
                                ? 'not on the checklist then'
                                : '—'
                        }`}
                        className={`flex w-7 shrink-0 items-center justify-center border-r border-black/10 py-1.5 lg:w-8 ${
                          isToday
                            ? 'border-x border-black/30 bg-neo-yellow/20'
                            : isWeekend(d)
                              ? 'bg-black/[0.03]'
                              : ''
                        }`}
                      >
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold transition-colors lg:h-6 lg:w-6 ${
                            c === 'done'
                              ? 'border-black bg-neo-green text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                              : c === 'na'
                                ? 'border-dashed border-black/25 bg-neo-gray/30'
                                : c === 'future'
                                  ? 'border-black/20 bg-neo-gray/30'
                                  : isToday
                                    ? 'border-black bg-white font-bold'
                                    : 'border-black bg-white'
                          }`}
                        >
                          {c === 'done' ? '✓' : ''}
                        </div>
                      </div>
                    )
                  })}

                  {/* Summary Total */}
                  <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-1 text-center text-xs font-bold leading-tight text-black">
                    <div>{rowDone}</div>
                    <div className="text-[9px] font-bold text-neo-gray-dark">
                      {rowPct === null ? '—' : `${rowPct}%`}
                    </div>
                  </div>
                </div>
              )
            })}

            {rows.length === 0 && (
              <div className="px-3 py-6 text-center text-xs font-bold text-neo-gray-dark">
                No habit rows to show for {label}.
              </div>
            )}

            {/* Footer row: per-day completion % */}
            <div className="flex items-center border-t-2 border-black bg-white">
              <div className="sticky left-0 z-10 w-40 shrink-0 border-r-2 border-black bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark lg:w-48">
                Day %
              </div>
              {days.map((d, i) => {
                const { pct } = dayStats[i]
                return (
                  <div
                    key={d}
                    className={`num w-7 shrink-0 border-r border-black/10 py-2 text-center text-[10px] font-bold lg:w-8 ${
                      isFuture(d) || pct === null
                        ? 'text-black/20'
                        : pct >= 0.8
                          ? 'text-black'
                          : 'text-black/60'
                    }`}
                  >
                    {isFuture(d) || pct === null ? '·' : Math.round(pct * 100)}
                  </div>
                )
              })}
              <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-2 text-center text-xs font-bold text-black">
                {avgPct}%
              </div>
            </div>
          </div>
        </div>

        {hiddenCount > 0 && (
          <div className="mt-2 text-[10px] font-bold text-neo-gray-dark">
            {hiddenCount} row{hiddenCount === 1 ? '' : 's'} hidden from the table. Percentages above
            still count every habit that ran.
          </div>
        )}
      </div>
    </div>
  )
}
