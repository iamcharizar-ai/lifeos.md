// Month review, rendered from exactly one thing: a month snapshot.
//
// A finished month reads its sealed snapshot — the roster and the day codes
// as they stood when the month closed. Nothing you do afterwards touches it,
// which is the whole point: delete habits freely, the past stays put.
//
// The running month has no seal yet, so it is derived live from the checklist
// and today's ticks. Its roster is whatever is switched on in the Daily tab
// right now — take a habit off the checklist and it leaves this month's graph
// and matrix immediately; put it back and it returns. That month is still
// yours to change, right up until it seals.
//
// Read top to bottom it answers: how did the month go (the numbers, and against
// the month before), what did each day look like (tap a bar),
// and the full habit × day grid. The ranking of habits sits shut at the bottom.
import { useEffect, useMemo, useRef, useState } from 'react'
import { domainOf, type Habit } from '../config/habits'
import { EDIT_DAYS, cellEditable, editableDays } from '../lib/backfill'
import { SLEEP_HABIT, tagOf } from '../game-core/rules.ts'
import type { SleepNight } from '../game-core/events.ts'
import type { Ticks } from '../lib/store'
import {
  buildDraft,
  dayIso,
  daysInMonth,
  frozenSnapshot,
  shiftYm,
  useMonths,
  ymOf,
  type MonthSnapshot,
  type SnapHabit,
} from '../lib/monthSnapshot'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

type Cell = 'done' | 'missed' | 'na' | 'future'
interface DayStat {
  d: number
  done: number
  expected: number
  pct: number | null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const monthName = (ym: string, opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', opts)
}

const emptySnap = (ym: string): MonthSnapshot => ({ ym, frozenAt: null, habits: [], cells: {} })

/** The running month is derived live; a finished one is its seal, or nothing (never rebuilt from today's library). */
function snapOf(ym: string, today: string, habits: Habit[], ticks: Ticks): MonthSnapshot {
  const nowYm = ymOf(today)
  if (ym === nowYm) return buildDraft(ym, habits, ticks)
  if (ym > nowYm) return emptySnap(ym)
  return frozenSnapshot(ym) ?? emptySnap(ym)
}

function cellOf(snap: MonthSnapshot, today: string, habitId: string, d: number): Cell {
  if (dayIso(snap.ym, d) > today) return 'future'
  const c = snap.cells[habitId]?.[d - 1]
  return c === '1' ? 'done' : c === '0' ? 'missed' : 'na'
}

function dayStatsOf(snap: MonthSnapshot, today: string): DayStat[] {
  return Array.from({ length: daysInMonth(snap.ym) }, (_, i) => {
    const d = i + 1
    let done = 0
    let expected = 0
    for (const h of snap.habits) {
      const c = cellOf(snap, today, h.id, d)
      if (c === 'done') {
        done++
        expected++
      } else if (c === 'missed') expected++
    }
    return { d, done, expected, pct: expected === 0 ? null : done / expected }
  })
}

const averageOf = (stats: DayStat[]): number | null => {
  const scored = stats.filter((s) => s.pct !== null)
  return scored.length ? Math.round((scored.reduce((a, s) => a + (s.pct as number), 0) / scored.length) * 100) : null
}

/** Longest stretch of days in a row that pass `ok`; a day with nothing scheduled breaks it. */
function longestRun<T>(items: T[], ok: (x: T) => boolean): number {
  let best = 0
  let cur = 0
  for (const x of items) {
    cur = ok(x) ? cur + 1 : 0
    best = Math.max(best, cur)
  }
  return best
}

/** A bar's colour says how the day went: green 80+, blue 50+, orange 25+, red under that. */
const barTone = (pct: number): string =>
  pct >= 0.8 ? 'bg-neo-green' : pct >= 0.5 ? 'bg-neo-blue' : pct >= 0.25 ? 'bg-neo-orange' : 'bg-neo-red'

export function MonthView({
  habits,
  ticks,
  today,
  initialYm,
  nights,
  onBackfill,
  isHandLocked,
}: {
  habits: Habit[]
  ticks: Ticks
  today: string
  /** open on this month instead of the running one (month-end review's "Graph" jump) */
  initialYm?: string
  /** the band's nights, so the Sleep row shows each night's score */
  nights?: Record<string, SleepNight>
  /** edit mode: fill in or take back one habit on one earlier day (never pays XP, see lib/backfill.ts) */
  onBackfill?: (habitId: string, day: string, on: boolean) => void
  /** habits another app or the band fills: their cells are not editable here */
  isHandLocked?: (habitId: string) => boolean
}) {
  const [ym, setYm] = useState(() => initialYm ?? ymOf(today))
  const [editing, setEditing] = useState(false)
  const months = useMonths() // re-render when a month seals or one arrives from another device

  const nowYm = ymOf(today)
  const when: 'past' | 'current' | 'ahead' = ym < nowYm ? 'past' : ym > nowYm ? 'ahead' : 'current'
  const sealed = frozenSnapshot(ym)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const snap = useMemo(() => snapOf(ym, today, habits, ticks), [ym, today, habits, ticks, months])
  const prevYm = shiftYm(ym, -1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevSnap = useMemo(() => snapOf(prevYm, today, habits, ticks), [prevYm, today, habits, ticks, months])

  // Edit mode exists only on the running month, and only for the last few days of it. Anything else (a sealed month,
  // the days before the 1st) is locked, so leaving the month or the day rolling into the next month ends the edit.
  const editWindow = useMemo(() => (when === 'current' && onBackfill ? editableDays(today) : []), [when, today, onBackfill])
  const canEdit = editWindow.length > 0
  const editOn = editing && canEdit
  const editable = (habitId: string, day: string, c: Cell) =>
    editOn && editWindow.includes(day) && c !== 'na' && c !== 'future' && !isHandLocked?.(habitId) && cellEditable(ticks[day]?.[habitId], day)

  const label = monthName(ym)
  const days = useMemo(() => Array.from({ length: daysInMonth(ym) }, (_, i) => i + 1), [ym])
  const iso = (d: number) => dayIso(ym, d)
  const isFuture = (d: number) => iso(d) > today
  const dowOf = (d: number) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, d).getDay()
  const isWeekend = (d: number) => dowOf(d) === 0 || dowOf(d) === 6

  const rows = snap.habits
  const dayStats = useMemo(() => dayStatsOf(snap, today), [snap, today])
  const avgPct = averageOf(dayStats)
  const prevAvg = useMemo(() => averageOf(dayStatsOf(prevSnap, today)), [prevSnap, today])
  const scored = dayStats.filter((s) => s.pct !== null)
  const perfectDays = scored.filter((s) => (s.pct as number) >= 1).length
  const zeroDays = scored.filter((s) => s.done === 0).length
  const totalTicks = dayStats.reduce((a, s) => a + s.done, 0)
  const bestRun = longestRun(dayStats.filter((s) => !isFuture(s.d)), (s) => s.pct !== null && s.pct >= 0.8)

  // the kind of work a habit is, for its colour (a sealed month carries no domain, so the library or its id says)
  const tagFor = useMemo(() => {
    const byId = new Map(habits.map((h) => [h.id, h]))
    return (h: SnapHabit) => {
      const lib = byId.get(h.id)
      return lib ? domainOf(lib) : tagOf(h.id)
    }
  }, [habits])

  // the day open under the calendar: today in the running month, else the last day with a record
  const defaultDay = useMemo(() => {
    if (when === 'current') return Number(today.slice(8, 10))
    const last = [...dayStats].reverse().find((s) => s.pct !== null)
    return last?.d ?? 1
  }, [when, today, dayStats])
  const [picked, setPicked] = useState<number | null>(null)
  const selDay = picked && picked <= days.length ? picked : defaultDay
  useEffect(() => {
    setPicked(null)
    setEditing(false)
  }, [ym])

  // a long month scrolls the grid sideways: open it on today, not on the 1st
  const gridEl = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = gridEl.current
    const t = el?.querySelector<HTMLElement>('[data-today]')
    if (el && t) el.scrollLeft = Math.max(0, t.offsetLeft - 200)
    else if (el) el.scrollLeft = 0
  }, [ym, rows.length])

  // ← and → step through the months
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') setYm((y) => shiftYm(y, -1))
      if (e.key === 'ArrowRight') setYm((y) => shiftYm(y, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // habits, best kept to most slipped
  const ranking = useMemo(
    () =>
      rows
        .map((h) => {
          const cells = days.map((d) => cellOf(snap, today, h.id, d))
          const done = cells.filter((c) => c === 'done').length
          const eligible = cells.filter((c) => c === 'done' || c === 'missed').length
          const counted = cells.filter((c) => c === 'done' || c === 'missed')
          return { h, done, eligible, pct: eligible ? done / eligible : null, run: longestRun(counted, (c) => c === 'done') }
        })
        .filter((r) => r.eligible > 0)
        .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.done - a.done),
    [rows, days, snap, today],
  )

  const delta = avgPct !== null && prevAvg !== null ? avgPct - prevAvg : null
  const status =
    when === 'current'
      ? { chip: 'Running', cls: 'bg-neo-yellow', line: 'Shows exactly the habits on your checklist right now. It seals itself the day the month turns over.' }
      : when === 'ahead'
        ? { chip: 'Ahead', cls: 'bg-white', line: 'Hasn’t happened yet.' }
        : sealed
          ? { chip: 'Sealed', cls: 'bg-neo-green', line: 'Written down when it ended: editing or deleting habits now cannot change it.' }
          : { chip: 'No record', cls: 'bg-neo-gray', line: 'Nothing was tracked before the app started keeping monthly seals.' }


  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="neo-card bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setYm(shiftYm(ym, -1))} className="neo-button px-3 py-2 text-sm font-bold" aria-label="Previous month" title="Previous month (←)">
            ◄<span className="hidden sm:inline"> {monthName(prevYm, { month: 'short' })}</span>
          </button>
          <div className="min-w-0 text-center">
            <h2 className="font-display text-xl font-bold uppercase leading-tight tracking-wider text-black sm:text-2xl">{label}</h2>
            <span className={`mt-1 inline-block border-2 border-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.cls}`} title={status.line}>
              {status.chip}
            </span>
          </div>
          <button onClick={() => setYm(shiftYm(ym, 1))} className="neo-button px-3 py-2 text-sm font-bold" aria-label="Next month" title="Next month (→)">
            <span className="hidden sm:inline">{monthName(shiftYm(ym, 1), { month: 'short' })} </span>►
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold text-neo-gray-dark">{status.line}</p>
      </div>

      {/* The month in numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="neo-card neo-card-yellow col-span-2 flex items-center justify-between px-4 py-3 sm:col-span-1 sm:block">
          <div className="text-[10px] font-bold uppercase tracking-wider">Average day</div>
          <div className="flex items-baseline gap-2">
            <span className="num font-display text-4xl font-bold leading-none">{avgPct === null ? '—' : `${avgPct}%`}</span>
            {delta !== null && (
              <span className={`num text-xs font-bold ${delta > 0 ? 'text-emerald-800' : delta < 0 ? 'text-red-700' : 'text-black/60'}`} title={`${monthName(prevYm, { month: 'long' })}: ${prevAvg}%`}>
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)} pts
              </span>
            )}
          </div>
        </div>
        {[
          { k: 'Perfect days', v: perfectDays, hint: 'Every habit ticked' },
          { k: 'Best run', v: bestRun, hint: 'Days in a row at 80% or more' },
          { k: 'Zero days', v: zeroDays, hint: 'Nothing ticked at all', bad: zeroDays > 0 },
          { k: 'Total ticks', v: totalTicks, hint: 'Every habit ticked, all month' },
        ].map((s) => (
          <div key={s.k} className="neo-card bg-white px-3 py-2" title={s.hint}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark">{s.k}</div>
            <div className={`num font-display text-2xl font-bold ${s.bad ? 'text-neo-red' : 'text-black'}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Daily completion: the month's days as bars on a 0-100 scale. Colour says how the day went; tap a bar for its habits */}
      <section className="neo-card bg-white p-4" aria-label="Daily completion rate">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="hud-label border-black text-xs">Daily completion</div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-neo-gray-dark" aria-hidden>
            {[
              ['bg-neo-green', '80+'],
              ['bg-neo-blue', '50+'],
              ['bg-neo-orange', '25+'],
              ['bg-neo-red', 'under'],
            ].map(([c, t]) => (
              <span key={t} className="flex items-center gap-1">
                <i className={`inline-block h-2.5 w-2.5 border-2 border-black ${c}`} />
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          {/* the scale */}
          <div className="num relative h-48 w-8 shrink-0 text-right text-[10px] font-bold text-black/60" aria-hidden>
            {[100, 80, 50, 0].map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ bottom: `${v}%` }}>
                {v}
              </span>
            ))}
          </div>
          <div className="relative h-48 min-w-0 flex-1 border-b-[3px] border-l-2 border-black">
            {[100, 80, 50].map((v) => (
              <div key={v} className={`absolute inset-x-0 border-t ${v === 80 ? 'border-dashed border-neo-green' : 'border-black/15'}`} style={{ bottom: `${v}%` }} aria-hidden />
            ))}
            {avgPct !== null && (
              <div className="avg-line" style={{ bottom: `${avgPct}%` }} aria-hidden>
                <span className="num">avg {avgPct}</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-end gap-[2px] px-[2px]">
              {dayStats.map((s) => {
                const isToday = iso(s.d) === today
                const future = isFuture(s.d)
                const on = s.d === selDay
                const pct = s.pct === null ? null : Math.round(s.pct * 100)
                return (
                  <button
                    key={s.d}
                    type="button"
                    onClick={() => setPicked(s.d)}
                    aria-pressed={on}
                    className={`relative flex h-full min-w-0 flex-1 items-end ${on ? 'bg-black/10' : isWeekend(s.d) ? 'bg-black/[0.04]' : ''}`}
                    title={
                      future
                        ? `${pad2(s.d)} ${label} — upcoming`
                        : pct === null
                          ? `${pad2(s.d)} ${label} — no habits scheduled`
                          : `${pad2(s.d)} ${label} — ${s.done}/${s.expected} habits (${pct}%)`
                    }
                    aria-label={`Show ${s.d} ${label}`}
                  >
                    {on && pct !== null && (
                      <span className="num absolute left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap bg-black px-1 py-0.5 text-[10px] font-bold leading-none text-white" style={{ bottom: `${Math.max(pct, 3)}%` }}>
                        {pct}%
                      </span>
                    )}
                    {/* Height is plain CSS, not an entrance animation — a bar that
                        never gets a frame (background tab, reduced motion) must
                        still be the right height. */}
                    <div
                      style={{ height: `${pct === null ? (future ? 0 : 4) : Math.max(pct, 3)}%`, transitionDelay: `${s.d * 12}ms` }}
                      className={`w-full border-x-2 border-t-2 border-black transition-[height] duration-500 ease-out ${
                        pct === null ? 'border-dashed bg-neo-gray/40' : isToday ? 'bar-today' : barTone(s.pct as number)
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="mt-1 flex gap-2">
          <div className="w-8 shrink-0" />
          <div className="flex min-w-0 flex-1 gap-[2px] px-[2px]">
            {days.map((d) => (
              <div
                key={d}
                className={`num min-w-0 flex-1 text-center text-[10px] font-bold leading-none ${
                  iso(d) === today ? 'text-black underline' : d === selDay ? 'text-black' : d === 1 || d % 5 === 0 ? 'text-black/60' : 'text-transparent'
                }`}
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Habit × day matrix */}
      <section className="neo-card overflow-hidden bg-white p-3" aria-label="Habit completion matrix">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="hud-label border-black text-xs">Habit × day</div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editOn}
              className={`neo-button px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${editOn ? 'bg-neo-yellow' : ''}`}
            >
              {editOn ? '✓ Done editing' : '✎ Edit graph'}
            </button>
          )}
        </div>

        {editOn && (
          <p className="mb-2 border-2 border-dashed border-black bg-neo-yellow/40 px-3 py-2 text-[11px] font-bold leading-snug" role="status">
            Tap a boxed cell to fill in or undo a day you missed. The last {EDIT_DAYS} days of this month can be edited ({editWindow.length === EDIT_DAYS ? '' : 'only '}
            {editWindow.length} open now); older days and earlier months are locked. Edits change this graph only: they never pay XP in the Pokedex, and a tick you made in time stays.
          </p>
        )}

        <div className="mb-2 flex flex-wrap gap-3 text-[10px] font-bold text-neo-gray-dark">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-neo-green" /> done
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> missed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 border-2 border-dashed border-black/30 bg-neo-gray/30" /> not on the checklist then
          </span>
        </div>

        <div ref={gridEl} className="overflow-x-auto pb-2">
          <div className="min-w-max rounded border-2 border-black bg-neo-bg">
            {/* Header row: day numbers */}
            <div className="sticky top-0 z-20 flex border-b-2 border-black bg-white">
              <div className="sticky left-0 z-30 w-40 shrink-0 border-r-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-black lg:w-48">Habit</div>
              {days.map((d) => {
                const isToday = iso(d) === today
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPicked(d)}
                    data-today={isToday ? '' : undefined}
                    className={`num w-7 shrink-0 border-r border-black/20 py-1 text-center text-xs font-bold lg:w-8 ${
                      isToday ? 'border-x-2 border-black bg-neo-yellow font-extrabold text-black' : d === selDay ? 'bg-black text-white' : isWeekend(d) ? 'bg-black/5 text-black/70' : 'text-black/70'
                    }`}
                  >
                    <div>{d}</div>
                    <div className={`text-[9px] font-bold ${d === selDay && !isToday ? 'text-white/60' : 'text-black/40'}`}>{DOW[dowOf(d)]}</div>
                  </button>
                )
              })}
              <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-2 text-center text-xs font-bold text-black">Total</div>
            </div>

            {rows.map((h, idx) => {
              const cells = days.map((d) => cellOf(snap, today, h.id, d))
              const rowDone = cells.filter((c) => c === 'done').length
              const rowEligible = cells.filter((c) => c === 'done' || c === 'missed').length
              const rowPct = rowEligible === 0 ? null : Math.round((rowDone / rowEligible) * 100)
              const pillar = h.tier === 'pillar'
              return (
                <div key={h.id} className={`flex items-center border-b border-black/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-neo-bg'}`}>
                  <div
                    className={`sticky left-0 z-10 flex w-40 shrink-0 items-center gap-1.5 border-r-2 border-black bg-white px-2 py-2 text-xs font-bold text-neo-black shadow-[2px_0_4px_rgba(0,0,0,0.05)] lg:w-48 ${pillar ? 'matrix-pillar' : ''}`}
                    data-tag={pillar ? tagFor(h) : undefined}
                  >
                    <span className="text-sm">{h.emoji}</span>
                    <span className={`truncate ${pillar ? 'uppercase' : ''}`} title={h.name}>
                      {h.name}
                    </span>
                  </div>

                  {cells.map((c, i) => {
                    const d = days[i]
                    const isToday = iso(d) === today
                    // Sleep's row is the night's score from the band, shaded by how good it was
                    const score = h.id === SLEEP_HABIT ? nights?.[iso(d)]?.score : undefined
                    if (score !== undefined)
                      return (
                        <div key={d} title={`Sleep — ${pad2(d)} ${label}: score ${score}`} className={`flex w-7 shrink-0 items-center justify-center border-r border-black/10 py-1.5 lg:w-8 ${isToday ? 'border-x border-black/30 bg-neo-yellow/20' : ''}`}>
                          <div className="sleep-cell num" style={{ background: score >= 90 ? '#f2c14e' : score >= 80 ? '#7fd38a' : score >= 70 ? '#9aa6ff' : '#d8d3ff' }}>{score}</div>
                        </div>
                      )
                    const canFlip = editable(h.id, iso(d), c)
                    const Wrap = canFlip ? 'button' : 'div'
                    return (
                      <Wrap
                        key={d}
                        {...(canFlip
                          ? { type: 'button' as const, onClick: () => onBackfill?.(h.id, iso(d), c !== 'done'), 'aria-pressed': c === 'done', 'aria-label': `${h.name}, ${pad2(d)} ${label}: ${c === 'done' ? 'tap to undo' : 'tap to fill in'}` }
                          : {})}
                        title={`${h.name} — ${pad2(d)} ${label}: ${c === 'done' ? 'done' : c === 'missed' ? 'missed' : c === 'na' ? 'not on the checklist then' : '—'}`}
                        className={`flex w-7 shrink-0 items-center justify-center border-r border-black/10 py-1.5 lg:w-8 ${
                          isToday ? 'border-x border-black/30 bg-neo-yellow/20' : d === selDay ? 'bg-black/[0.07]' : isWeekend(d) ? 'bg-black/[0.03]' : ''
                        } ${canFlip ? 'cursor-pointer bg-neo-yellow/30 outline outline-2 -outline-offset-2 outline-dashed outline-black' : ''}`}
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
                      </Wrap>
                    )
                  })}

                  <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-1 text-center text-xs font-bold leading-tight text-black">
                    <div>{rowDone}</div>
                    <div className="text-[9px] font-bold text-neo-gray-dark">{rowPct === null ? '—' : `${rowPct}%`}</div>
                  </div>
                </div>
              )
            })}

            {rows.length === 0 && (
              <div className="px-3 py-6 text-center text-xs font-bold text-neo-gray-dark">{when === 'ahead' ? `${label} hasn’t happened yet.` : `No habits ran in ${label}.`}</div>
            )}

            {/* Footer row: per-day completion % */}
            <div className="flex items-center border-t-2 border-black bg-white">
              <div className="sticky left-0 z-10 w-40 shrink-0 border-r-2 border-black bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark lg:w-48">Day %</div>
              {dayStats.map((s) => (
                <div
                  key={s.d}
                  className={`num w-7 shrink-0 border-r border-black/10 py-2 text-center text-[10px] font-bold lg:w-8 ${
                    isFuture(s.d) || s.pct === null ? 'text-black/20' : s.pct >= 0.8 ? 'text-black' : 'text-black/60'
                  }`}
                >
                  {isFuture(s.d) || s.pct === null ? '·' : Math.round(s.pct * 100)}
                </div>
              ))}
              <div className="num w-12 shrink-0 border-l-2 border-black bg-white py-2 text-center text-xs font-bold text-black">{avgPct === null ? '—' : `${avgPct}%`}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Habits, best kept first */}
      <details className="neo-card bg-white p-3" aria-label="Habits ranked">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="hud-label border-black text-xs">Habits, best kept first</span>
          <span className="text-[10px] font-bold uppercase text-neo-gray-dark">{ranking.length} habits · show ▼</span>
        </summary>
        <div className="mt-3 text-right text-[10px] font-bold uppercase text-neo-gray-dark">done · best run</div>
        {ranking.length === 0 ? (
          <p className="py-4 text-center text-xs font-bold text-neo-gray-dark">{when === 'ahead' ? `${label} hasn’t happened yet.` : `No habits ran in ${label}.`}</p>
        ) : (
          <ol className="mt-1 space-y-1">
            {ranking.map(({ h, done, eligible, pct, run }) => {
              const p = Math.round((pct ?? 0) * 100)
              const pillar = h.tier === 'pillar'
              return (
                <li key={h.id} className={`rank-row ${pillar ? 'is-pillar' : ''}`} data-tag={pillar ? tagFor(h) : undefined} title={`${h.name}: ${done} of ${eligible} days`}>
                  <span className="w-6 shrink-0 text-center text-base leading-none">{h.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] ${pillar ? 'font-extrabold uppercase tracking-wide' : 'font-bold'}`}>{h.name}</span>
                    <span className="rank-track">
                      <i className={`${barTone(pct ?? 0)}`} style={{ width: `${Math.max(p, 2)}%` }} />
                    </span>
                  </span>
                  <span className="num w-10 shrink-0 text-right text-sm font-bold">{p}%</span>
                  <span className="num w-12 shrink-0 text-right text-[11px] font-bold text-neo-gray-dark">
                    {done}/{eligible}
                  </span>
                  <span className="num w-8 shrink-0 text-right text-[11px] font-bold" title={`Longest run this month: ${run} days`}>
                    {run}d
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </details>
    </div>
  )
}
