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
/** Written by the Pokedex when a stone is spent from the Bag: `{ item, uid, what, to? }`. */
export const USE_EVENT = 'item_use'

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
    if (ev.type === USE_EVENT && typeof ev.payload?.item === 'string' && typeof ev.payload?.uid === 'string' && typeof ev.payload?.what === 'string')
      out.push({ day: ev.day, item: ev.payload.item, uid: ev.payload.uid, what: ev.payload.what, ...(typeof ev.payload.to === 'string' ? { to: ev.payload.to } : {}) })
  return out
}
