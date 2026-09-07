// Month review, rendered from exactly one thing: a month snapshot.
//
// A finished month reads its sealed snapshot — the roster and the day codes
// as they stood when the month closed. Nothing you do afterwards touches it,
// which is the whole point: delete habits freely, the past stays put.
//
// The running month has no seal yet, so it is derived live from the registry
// and today's ticks. That month is still yours to change.
import { useMemo, useState } from 'react'
import type { Habit } from '../config/habits'
import type { Ticks } from '../lib/store'
import {
  buildMonth,
  dayIso,
  daysInMonth,
  frozenSnapshot,
  shiftYm,
  useMonths,
  ymOf,
  type MonthSnapshot,
} from '../lib/monthSnapshot'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type Cell = 'done' | 'missed' | 'na' | 'future'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** bar colour scales with completion so the month reads at a glance */
function barTone(pct: number): string {
  if (pct >= 0.8) return 'bg-neo-green'
  if (pct >= 0.5) return 'bg-neo-blue'
  if (pct >= 0.25) return 'bg-neo-orange'
  if (pct > 0) return 'bg-neo-red'
  return 'bg-white/40'
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
  const [ym, setYm] = useState(() => ymOf(today))
  useMonths() // re-render when a month seals or one arrives from another device

  const nowYm = ymOf(today)
  const when: 'past' | 'current' | 'ahead' = ym < nowYm ? 'past' : ym > nowYm ? 'ahead' : 'current'
  const sealed = frozenSnapshot(ym)
  // Only the running month is derived live. A finished month is whatever its
  // seal says — and if it has no seal, we simply never recorded it. Rebuilding
  // it from today's library would invent a month of misses out of nothing.
  const snap: MonthSnapshot = useMemo(
    () =>
      when === 'current'
        ? buildMonth(ym, habits, ticks)
        : (sealed ?? { ym, frozenAt: null, habits: [], cells: {} }),
    [when, sealed, ym, habits, ticks],
  )

  const { days, label } = useMemo(() => {
    const [y, m] = ym.split('-').map(Number)
    return {
      days: Array.from({ length: daysInMonth(ym) }, (_, i) => i + 1),
      label: new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
    }
  }, [ym])

  const iso = (d: number) => dayIso(ym, d)
  const isFuture = (d: number) => iso(d) > today
  const dowOf = (d: number) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, d).getDay()
  const isWeekend = (d: number) => dowOf(d) === 0 || dowOf(d) === 6

  const rows = snap.habits
  const cellOf = (habitId: string, d: number): Cell => {
    if (isFuture(d)) return 'future'
    const c = snap.cells[habitId]?.[d - 1]
    return c === '1' ? 'done' : c === '0' ? 'missed' : 'na'
  }

  const dayStats = useMemo(
    () =>
      days.map((d) => {
        let done = 0
        let expected = 0
        for (const h of rows) {
          const c = cellOf(h.id, d)
          if (c === 'done') {
            done++
            expected++
          } else if (c === 'missed') expected++
        }
        return { done, expected, pct: expected === 0 ? null : done / expected }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, rows, snap, today],
  )

  const scored = dayStats.filter((s) => s.pct !== null)
  const avgPct = scored.length
    ? Math.round((scored.reduce((a, s) => a + (s.pct as number), 0) / scored.length) * 100)
    : 0
  const bestPct = scored.length
    ? Math.round(Math.max(...scored.map((s) => s.pct as number)) * 100)
    : 0
  const perfectDays = scored.filter((s) => (s.pct as number) >= 1).length
  const zeroDays = scored.filter((s) => s.done === 0).length
  const totalTicks = dayStats.reduce((a, s) => a + s.done, 0)

  return (
    <div className="space-y-4">
      {/* Month nav & stats */}
      <div className="neo-card flex items-center justify-between bg-white p-3">
        <button
          onClick={() => setYm(shiftYm(ym, -1))}
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
            Average: <span className="text-black">{avgPct}%</span>
            <span className="mx-1.5 text-black/30">|</span>
            {rows.length} habits ran
          </div>
        </div>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          className="neo-button px-3 py-1 text-sm font-bold"
          aria-label="Next month"
        >
          Next ►
        </button>
      </div>

      <div
        className={`neo-card px-3 py-2 text-[11px] font-bold ${
          when === 'current' ? 'neo-card-yellow text-black' : 'bg-white text-neo-gray-dark'
        }`}
      >
        {when === 'current'
          ? '✏️ Running month. It follows your library live, and seals itself the day the month turns over.'
          : when === 'ahead'
            ? '📆 Hasn’t happened yet.'
            : sealed
              ? '🔒 Sealed. This month was written down when it ended — editing or deleting habits now cannot change it.'
              : '📭 No record for this month. Nothing was tracked before the app started keeping monthly seals.'}
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
        <div className="hud-label mb-3 border-black text-xs">Daily Completion Rate</div>
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
                {/* Height is plain CSS, not an entrance animation — a bar that
                    never gets a frame (background tab, reduced motion) must
                    still be the right height. */}
                <div
                  style={{
                    // a day with nothing scheduled gets a stub, not a full-height
                    // ghost bar that reads as 100% at a glance
                    height: `${pct === null ? (future ? 0 : 6) : Math.max(pct * 100, 3)}%`,
                    transitionDelay: `${i * 12}ms`,
                  }}
                  className={`w-full border-x border-t-2 border-black transition-[height] duration-500 ease-out ${
                    pct === null
                      ? 'border-dashed bg-neo-gray/30'
                      : isToday
                        ? 'bg-neo-yellow'
                        : barTone(pct)
                  }`}
                />
              </div>
            )
          })}
        </div>
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

      {/* Habit × day matrix */}
      <div className="neo-card overflow-hidden bg-white p-3">
        <div className="mb-3 hud-label border-black text-xs">Habit Completion Matrix</div>

        <div className="mb-2 flex flex-wrap gap-3 text-[10px] font-bold text-neo-gray-dark">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-neo-green" /> done
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> missed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-dashed border-black/30 bg-neo-gray/30" />{' '}
            not on the checklist then
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
                    <div className="text-[9px] font-bold text-black/40">{DOW[dowOf(d)]}</div>
                  </div>
                )
              })}
              <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-2 text-center text-xs font-bold text-black">
                Total
              </div>
            </div>

            {rows.map((h, idx) => {
              const cells = days.map((d) => cellOf(h.id, d))
              const rowDone = cells.filter((c) => c === 'done').length
              const rowEligible = cells.filter((c) => c === 'done' || c === 'missed').length
              const rowPct = rowEligible === 0 ? null : Math.round((rowDone / rowEligible) * 100)
              return (
                <div
                  key={h.id}
                  className={`flex items-center border-b border-black/30 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-neo-bg'
                  }`}
                >
                  <div className="sticky left-0 z-10 flex w-40 shrink-0 items-center gap-1.5 border-r-2 border-black bg-white px-2 py-2 text-xs font-bold text-neo-black shadow-[2px_0_4px_rgba(0,0,0,0.05)] lg:w-48">
                    <span className="text-sm">{h.emoji}</span>
                    <span className="truncate" title={h.name}>
                      {h.name}
                    </span>
                  </div>

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
                                  : 'border-black bg-white'
                          }`}
                        >
                          {c === 'done' ? '✓' : ''}
                        </div>
                      </div>
                    )
                  })}

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
                {when === 'ahead' ? `${label} hasn’t happened yet.` : `No habits ran in ${label}.`}
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
      </div>
    </div>
  )
}
