// The two kinds of ledger event the game reads directly, turned into what
// facts.ts takes. Pokedex and Life OS both call these, so the two apps cannot
// read the same event differently.
import type { BodyFacts, ItemUse } from './facts.ts'
import { V4_START, isTag, type Tag } from './rules.ts'

export interface GameEvent {
  type: string
  day: string
  at: string
  payload: Record<string, unknown>
}

/** Written by the Vitals band sync, one row per day. */
export const BODY_EVENT = 'vitals'
/** Written by the Pokedex when something is chosen by hand (who is next, a branch, who leads, which form shows): `{ item, uid, what, to? }`. */
export const USE_EVENT = 'item_use'
/** Written by Life OS for today only: `{ habits: JSON [{ id, tier, tag }] }`, the list as it stood that day. See listsOf for which one stands. */
export const LIST_EVENT = 'day_list'

const BODY_FIELDS = ['sleepScore', 'steps', 'recovery'] as const

/** day → what the band measured. Pass events oldest first: a later reading replaces an earlier one, and null takes it back. */
export function bodyOf(events: GameEvent[]): Record<string, BodyFacts> {
  const out: Record<string, BodyFacts> = {}
  for (const ev of events) {
    if (ev.type !== BODY_EVENT) continue
    for (const k of BODY_FIELDS) {
      const v = ev.payload?.[k]
      if (typeof v === 'number' && Number.isFinite(v)) (out[ev.day] ??= {})[k] = v
      else if (v === null && out[ev.day]) delete out[ev.day][k]
    }
  }
  return out
}

/** One night as the band reported it, for showing. The game itself only reads the score (see BodyFacts). */
export interface SleepNight {
  /** the morning it ended: the day it is filed under */
  day: string
  score?: number
  /** "YYYY-MM-DDTHH:MM", where you were */
  bed?: string
  wake?: string
  sleepMin?: number
  awakeMin?: number
  deepMin?: number
  remMin?: number
  lightMin?: number
}
const NIGHT_NUMBERS = ['sleepMin', 'awakeMin', 'deepMin', 'remMin', 'lightMin'] as const
const NIGHT_TEXT = ['bed', 'wake'] as const

/** day → the night that ended on it. Same rules as bodyOf: oldest first, a later reading replaces an earlier one, null takes it back. A day with nothing about sleep is absent. */
export function sleepOf(events: GameEvent[]): Record<string, SleepNight> {
  const out: Record<string, SleepNight> = {}
  for (const ev of events) {
    if (ev.type !== BODY_EVENT) continue
    const p = ev.payload ?? {}
    const set = (k: keyof SleepNight, v: unknown, ok: boolean) => {
      if (ok) (out[ev.day] ??= { day: ev.day } as SleepNight)[k as 'score'] = v as never
      else if (v === null && out[ev.day]) delete out[ev.day][k as 'score']
    }
    set('score', p.sleepScore, typeof p.sleepScore === 'number' && Number.isFinite(p.sleepScore))
    for (const k of NIGHT_NUMBERS) set(k, p[k], typeof p[k] === 'number' && Number.isFinite(p[k] as number))
    for (const k of NIGHT_TEXT) set(k, p[k], typeof p[k] === 'string' && (p[k] as string).length > 0)
  }
  for (const d of Object.keys(out)) if (Object.keys(out[d]).length <= 1) delete out[d]
  return out
}

/** Items used from the Bag, in the order they were used. */
export function usesOf(events: GameEvent[]): ItemUse[] {
  const out: ItemUse[] = []
  for (const ev of events)
    if (ev.type === USE_EVENT && typeof ev.payload?.uid === 'string' && typeof ev.payload?.what === 'string')
      out.push({ day: ev.day, item: typeof ev.payload.item === 'string' ? ev.payload.item : '', uid: ev.payload.uid, what: ev.payload.what, ...(typeof ev.payload.to === 'string' ? { to: ev.payload.to } : {}) })
  return out
}

export interface ListedHabit {
  id: string
  tier: string
  /** the habit's domain as it stood that day (version 4 lists carry it) */
  tag?: Tag
}

function parseList(raw: unknown): ListedHabit[] | null {
  try {
    const list = JSON.parse(String(raw)) as { id?: unknown; tier?: unknown; tag?: unknown }[]
    if (!Array.isArray(list)) return null
    return list
      .filter((h) => typeof h?.id === 'string' && typeof h?.tier === 'string')
      .map((h) => ({ id: h.id as string, tier: h.tier as string, ...(isTag(h.tag) ? { tag: h.tag } : {}) }))
  } catch {
    return null // a malformed list is no list: the day falls back to the library
  }
}

/**
 * day → that day's habit list. Pass events oldest first.
 *
 * Before version 4 the last list written for a day is the one that stands.
 * From version 4 a day's list can grow but not shrink: the first one stands,
 * a later one that day can only add habits (in the tier and domain they had
 * when they were added), and taking a habit off, moving it or changing its
 * tier waits for tomorrow. So a missed habit cannot be edited out of today.
 * A list written with `fix: true` is a deliberate correction and replaces the day's.
 */
export function listsOf(events: GameEvent[], v4From: string = V4_START): Record<string, ListedHabit[]> {
  const out: Record<string, ListedHabit[]> = {}
  for (const ev of events) {
    if (ev.type !== LIST_EVENT) continue
    const list = parseList(ev.payload?.habits)
    if (!list) continue
    if (ev.day < v4From) {
      // those lists never carried a domain: the id decided, and still does for those days
      if (list.length) out[ev.day] = list.map(({ id, tier }) => ({ id, tier }))
      continue
    }
    const cur = out[ev.day]
    if (!cur || ev.payload?.fix === true) out[ev.day] = list
    else {
      const have = new Set(cur.map((h) => h.id))
      for (const h of list) if (!have.has(h.id)) cur.push(h)
    }
  }
  return out
}

/** Would writing `list` for a day change what stands for it? Life OS asks before it writes, so an edit that cannot count is not sent over and over. */
export function listAdds(stands: ListedHabit[] | undefined, list: ListedHabit[]): boolean {
  if (!stands) return true
  const have = new Set(stands.map((h) => h.id))
  return list.some((h) => !have.has(h.id))
}
