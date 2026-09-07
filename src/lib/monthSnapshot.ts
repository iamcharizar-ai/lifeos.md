// Month snapshots — the thing that makes deleting a habit safe.
//
// A finished month is written down once and never recomputed. The snapshot
// holds its own roster (the habits that ran that month, in the order they had)
// and one row of day codes per habit, so nothing you do to the library
// afterwards — rename, switch off, delete outright — can move a past bar.
//
// The running month has no snapshot yet, only a *draft* that is rewritten from
// live state on every change. That is deliberate: the current month is still
// yours to edit. The draft's real job is to be sitting there ready on the first
// day of the next month, so the roster survives even if you delete everything
// before opening the app again.
//
// Day codes: '1' done · '0' was on the checklist, not ticked · '-' wasn't a
// habit then. Future-ness is not encoded — the view derives it from today.
import { useSyncExternalStore } from 'react'
import { isActiveOn, type Habit, type Tier } from '../config/habits'
import type { Ticks } from './store'

export type CellCode = '1' | '0' | '-'

export interface SnapHabit {
  id: string
  name: string
  emoji: string
  tier: Tier
}

export interface MonthSnapshot {
  ym: string // YYYY-MM
  /** ISO time this month was sealed, or null while it is still the running month */
  frozenAt: string | null
  habits: SnapHabit[]
  /** habitId → one code per day of the month */
  cells: Record<string, string>
}

const KEY = 'lifeos.months.v1'

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export const ymOf = (day: string): string => day.slice(0, 7)

/** Step a YYYY-MM key by whole months. */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function dayIso(ym: string, day: number): string {
  return `${ym}-${pad2(day)}`
}

type Store = Record<string, MonthSnapshot>

function loadStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

let store: Store = loadStore()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* quota — worst case a month re-derives from live state */
  }
}

export function subscribeMonths(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

let version = 0
const notify = () => {
  version += 1
  listeners.forEach((l) => l())
}

const getVersion = () => version

/** Re-render on any snapshot change (a month sealing, or a peer's month arriving). */
export function useMonths(): number {
  return useSyncExternalStore(subscribeMonths, getVersion)
}

/** The sealed snapshot for `ym`, or null when that month is still open. */
export function frozenSnapshot(ym: string): MonthSnapshot | null {
  const s = store[ym]
  return s && s.frozenAt ? s : null
}

export const getSnapshot = (ym: string): MonthSnapshot | undefined => store[ym]

const trim = (h: Habit): SnapHabit => ({ id: h.id, name: h.name, emoji: h.emoji, tier: h.tier })

/**
 * Derive a month from live state. The roster is every habit that was on the
 * checklist at any point that month, plus anything ticked in it — a habit you
 * switched off on the 20th still deserves its first nineteen days.
 */
export function buildMonth(ym: string, habits: Habit[], ticks: Ticks): MonthSnapshot {
  const n = daysInMonth(ym)
  const days = Array.from({ length: n }, (_, i) => dayIso(ym, i + 1))
  const roster: SnapHabit[] = []
  const cells: Record<string, string> = {}
  for (const h of habits) {
    let row = ''
    let any = false
    for (const day of days) {
      if (ticks[day]?.[h.id]) {
        row += '1'
        any = true
      } else if (isActiveOn(h, day)) {
        row += '0'
        any = true
      } else row += '-'
    }
    if (!any) continue
    roster.push(trim(h))
    cells[h.id] = row
  }
  return { ym, frozenAt: null, habits: roster, cells }
}

/**
 * Seal a draft. The roster and the "was it scheduled" codes come from the
 * draft — that is the part the live registry may no longer know — while ticks
 * are re-read, so a day logged after the draft was last written still counts.
 */
function seal(draft: MonthSnapshot, ticks: Ticks, at: string): MonthSnapshot {
  const n = daysInMonth(draft.ym)
  const cells: Record<string, string> = {}
  for (const h of draft.habits) {
    const row = draft.cells[h.id] ?? '-'.repeat(n)
    let out = ''
    for (let i = 0; i < n; i++) {
      const ticked = Boolean(ticks[dayIso(draft.ym, i + 1)]?.[h.id])
      const was = row[i] ?? '-'
      // A tick always wins. Without one, a day the draft called "done" was at
      // least scheduled, so it degrades to a miss rather than to grey.
      out += ticked ? '1' : was === '1' ? '0' : was
    }
    cells[h.id] = out
  }
  return { ...draft, frozenAt: at, cells }
}

/** Months worth considering: from the first month with any tick through `ym`. */
function monthRange(ticks: Ticks, ym: string): string[] {
  const withTicks = Object.keys(ticks).filter((d) => Object.keys(ticks[d] ?? {}).length > 0)
  const known = [...withTicks.map(ymOf), ...Object.keys(store)].sort()
  const first = known[0] ?? ym
  const out: string[] = []
  for (let m = first; m <= ym; m = shiftYm(m, 1)) out.push(m)
  return out
}

/**
 * Keep the draft for the running month fresh and seal every month behind it.
 * Returns the months sealed on this pass so the caller can broadcast them.
 */
export function ensureMonths(habits: Habit[], ticks: Ticks, today: string): MonthSnapshot[] {
  const nowYm = ymOf(today)
  const at = new Date().toISOString()
  const sealed: MonthSnapshot[] = []
  let dirty = false

  for (const ym of monthRange(ticks, nowYm)) {
    if (ym === nowYm) continue
    if (store[ym]?.frozenAt) continue
    const draft = store[ym] ?? buildMonth(ym, habits, ticks)
    const snap = seal(draft, ticks, at)
    store[ym] = snap
    sealed.push(snap)
    dirty = true
  }

  const draft = buildMonth(nowYm, habits, ticks)
  const prev = store[nowYm]
  if (!prev?.frozenAt && JSON.stringify(prev) !== JSON.stringify(draft)) {
    store[nowYm] = draft
    dirty = true
  }

  if (dirty) {
    persist()
    notify()
  }
  return sealed
}

/**
 * Take a sealed month from another device. First seal wins — it was written
 * closest to the month's real end — so a later re-seal never overwrites it.
 */
export function adoptSnapshot(snap: MonthSnapshot): boolean {
  if (!snap?.ym || !snap.frozenAt || !Array.isArray(snap.habits)) return false
  const mine = store[snap.ym]
  if (mine?.frozenAt && mine.frozenAt <= snap.frozenAt) return false
  store[snap.ym] = snap
  persist()
  notify()
  return true
}

/** Every sealed month, newest first — used to seed the cloud on first boot. */
export function frozenSnapshots(): MonthSnapshot[] {
  return Object.values(store)
    .filter((s) => s.frozenAt)
    .sort((a, b) => (a.ym < b.ym ? 1 : -1))
}
