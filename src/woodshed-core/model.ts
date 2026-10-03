// WOODSHED CORE — shared by Woodshed and Life OS.
// Source of truth lives in the woodshed repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.

/** The six strings of the neck view, top (melody) to bottom (low end). */
export type Lane = 'songs' | 'voice' | 'pick' | 'fret' | 'time' | 'rhythm'
export const LANES: Lane[] = ['songs', 'voice', 'pick', 'fret', 'time', 'rhythm']
export const LANE_NAME: Record<Lane, string> = {
  songs: 'Songs',
  voice: 'Expression',
  pick: 'Picking hand',
  fret: 'Fretting hand',
  time: 'Time',
  rhythm: 'Rhythm guitar',
}

export interface Item {
  id: string
  name: string
  lane: Lane
  /** position along the neck, 1-12: roughly when it comes up in the course */
  fret: number
  /** drill = technique exercise · phrase = a few bars of a song · song = one whole guitar part */
  kind: 'drill' | 'phrase' | 'song'
  req: string[]
  /** minutes to spend on it in a session */
  mins: number
  /** metronome range in bpm. Without one the item is judged by feel alone (bends, vibrato). */
  start?: number
  target?: number
  /** clean days at the target needed to own it (default OWN_DAYS) */
  own?: number
  why: string
  how: string[]
  /** bars written out in the notation described in tools/gp2json.py */
  tab?: string[]
  /** phrases: where the bars live in data/songs (bar numbers, inclusive) */
  src?: { song: string; track: number; from: number; to: number }
  /** the tab came without rhythm: note lengths were read off its spacing, so they are a best guess */
  inferred?: boolean
  /** open-string pitches (MIDI, low to high) when it matters; default is D standard */
  tuning?: number[]
  /** phrases: the song item they belong to */
  part?: string
  /** anything the guitar itself has to be able to do */
  gear?: string
}

/** 0 rough · 1 getting there · 2 clean */
export type Feel = 0 | 1 | 2
export const FEEL_NAME = ['Rough', 'Getting there', 'Clean'] as const

export interface Log {
  done: boolean
  bpm?: number
  feel?: Feel
  at: string
}

/** 0 not started · 1 learning · 2 solid · 3 owned */
export type Rank = 0 | 1 | 2 | 3
export const RANK_NAME = ['Not started', 'Learning', 'Solid', 'Owned'] as const
export const OWN_DAYS = 3

// ── ledger events ───────────────────────────────────────────────────────────
// `guitar`       payload: { itemId, done?, bpm?, feel? }   one practice log per item per day (last write wins)
//                payload: { itemId, parked }               take an item out of / back into rotation
// `guitar_plan`  payload: { items: JSON string[] }         the day's session; first one for a day wins
export interface LedgerEvent {
  device: string
  at: string // ISO, client clock
  day: string // YYYY-MM-DD the event belongs to
  type: string
  payload: Record<string, string | number | boolean | null>
  inserted_at?: string
}

export interface ShedState {
  /** itemId → day → what was logged */
  logs: Record<string, Record<string, Log>>
  parked: Record<string, { on: boolean; at: string }>
  plans: Record<string, { items: string[]; at: string }>
}

export const emptyShed = (): ShedState => ({ logs: {}, parked: {}, plans: {} })

/**
 * Fold guitar events into state. Idempotent and order-independent (logs and
 * parking are last-write-wins by `at`, plans are first-write-wins), so
 * replaying the whole ledger is always safe. Returns the same object when
 * nothing changed.
 */
export function foldShed(state: ShedState, events: LedgerEvent[]): ShedState {
  let next = state
  const touch = () => {
    if (next === state) next = { logs: { ...state.logs }, parked: { ...state.parked }, plans: { ...state.plans } }
  }
  for (const ev of events) {
    const p = ev.payload ?? {}
    if (ev.type === 'guitar') {
      const id = String(p.itemId ?? '')
      if (!id) continue
      if (typeof p.parked === 'boolean') {
        const cur = next.parked[id]
        if (!cur || ev.at > cur.at) { touch(); next.parked[id] = { on: p.parked, at: ev.at } }
        continue
      }
      const cur = next.logs[id]?.[ev.day]
      if (cur && ev.at <= cur.at) continue
      touch()
      const log: Log = { done: p.done !== false, at: ev.at }
      if (typeof p.bpm === 'number' && p.bpm > 0) log.bpm = Math.round(p.bpm)
      if (p.feel === 0 || p.feel === 1 || p.feel === 2) log.feel = p.feel
      next.logs[id] = { ...next.logs[id], [ev.day]: log }
    } else if (ev.type === 'guitar_plan') {
      const cur = next.plans[ev.day]
      if (cur && ev.at >= cur.at) continue
      try {
        const items = JSON.parse(String(p.items ?? '[]')) as string[]
        if (Array.isArray(items)) { touch(); next.plans[ev.day] = { items, at: ev.at } }
      } catch {
        /* malformed plan: ignore */
      }
    }
  }
  return next
}

export const practicedOn = (s: ShedState, day: string, id: string): boolean => Boolean(s.logs[id]?.[day]?.done)
export const isParked = (s: ShedState, id: string): boolean => Boolean(s.parked[id]?.on)

export interface Stats {
  /** days it was practised */
  days: number
  last?: string
  lastBpm?: number
  lastFeel?: Feel
  /** fastest tempo logged as clean */
  best: number
  /** days logged clean at the target tempo (or just clean, for items without one) */
  cleanDays: number
  /** the day it became owned */
  ownedOn?: string
  /** practice days since it was owned: spaces out the reviews */
  reviews: number
}

/** Everything known about one item, derived from its logs alone. */
export function statsOf(item: Item, s: ShedState): Stats {
  const st: Stats = { days: 0, best: 0, cleanDays: 0, reviews: 0 }
  const logs = s.logs[item.id]
  if (!logs) return st
  const need = item.own ?? OWN_DAYS
  for (const day of Object.keys(logs).sort()) {
    const l = logs[day]
    if (!l.done) continue
    st.days++
    st.last = day
    if (l.bpm) st.lastBpm = l.bpm
    st.lastFeel = l.feel
    if (st.ownedOn) st.reviews++
    if (l.feel !== 2) continue
    if (l.bpm && l.bpm > st.best) st.best = l.bpm
    // a clean log without a tempo is taken at the tempo you were last on
    const bpm = l.bpm ?? st.lastBpm ?? 0
    if (!item.target || bpm >= item.target) {
      st.cleanDays++
      if (!st.ownedOn && st.cleanDays >= need) st.ownedOn = day
    }
  }
  return st
}

/** Clean at this fraction of the target tempo counts as "solid": good enough to build on. */
const SOLID = 0.8

export function rankOf(item: Item, st: Stats): Rank {
  if (st.ownedOn) return 3
  if (st.days === 0) return 0
  if (st.cleanDays >= 1) return 2
  if (item.target && st.best >= Math.round(item.target * SOLID)) return 2
  return 1
}

export function dayISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)
