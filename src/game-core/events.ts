// The two kinds of ledger event the game reads directly, turned into what
// facts.ts takes. Pokedex and Life OS both call these, so the two apps cannot
// read the same event differently.
import type { BodyFacts, ItemUse } from './facts.ts'

export interface GameEvent {
  type: string
  day: string
  at: string
  payload: Record<string, unknown>
}

/** Written by the Vitals band sync, one row per day. */
export const BODY_EVENT = 'vitals'
/** Written by the Pokedex when a stone is spent or the next partner is chosen: `{ item, uid, what, to? }`. */
export const USE_EVENT = 'item_use'
/** Written by Life OS once a day: `{ habits: JSON [{ id, tier }] }`, the list as it stood that day. Life OS writes it for today only, again if the list is edited during the day, so the last one for a day stands and nothing written later can reach back. */
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

/** Items used from the Bag, in the order they were used. */
export function usesOf(events: GameEvent[]): ItemUse[] {
  const out: ItemUse[] = []
  for (const ev of events)
    if (ev.type === USE_EVENT && typeof ev.payload?.uid === 'string' && typeof ev.payload?.what === 'string')
      out.push({ day: ev.day, item: typeof ev.payload.item === 'string' ? ev.payload.item : '', uid: ev.payload.uid, what: ev.payload.what, ...(typeof ev.payload.to === 'string' ? { to: ev.payload.to } : {}) })
  return out
}

/** day → that day's habit list. Pass events oldest first: the last list written for a day is the one that stands. */
export function listsOf(events: GameEvent[]): Record<string, { id: string; tier: string }[]> {
  const out: Record<string, { id: string; tier: string }[]> = {}
  for (const ev of events) {
    if (ev.type !== LIST_EVENT) continue
    try {
      const list = JSON.parse(String(ev.payload?.habits)) as { id?: unknown; tier?: unknown }[]
      if (Array.isArray(list) && list.length) out[ev.day] = list.filter((h) => typeof h?.id === 'string' && typeof h?.tier === 'string') as { id: string; tier: string }[]
    } catch {
      /* a malformed list is no list: the day falls back to the library */
    }
  }
  return out
}
