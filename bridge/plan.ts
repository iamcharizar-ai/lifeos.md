// What a sync writes. The Google Health CLI gives raw readings; the game reads
// the numbers made from them (a night's sleep score, a morning's recovery), so
// they are worked out here, once, with the weeks already in the ledger for
// company (steadiness and recovery compare a night against the ones before it).
// A day whose numbers are the same as the ledger's writes nothing, so running
// it every morning, or twice, costs nothing.
import { createHash } from 'node:crypto'
import { rowsToWrite, toVitals, type SimpleSet } from './map.ts'
import { emptyVitals, foldVitals, type LedgerEvent } from './model.ts'

/** Recovery and steadiness look at the weeks before a day, so a sync reads this many days of the ledger from before its first day. */
export const LOOK_BACK = 35
export const DEVICE = 'health-sync'

/** The `vitals` events to write, oldest day first. `known` is the ledger's own `vitals` events from LOOK_BACK days before the first day read. */
export function planWrites(read: SimpleSet, known: LedgerEvent[], at: string): LedgerEvent[] {
  const fresh = toVitals(read)
  const state = foldVitals(emptyVitals(), known)
  const scores: Record<string, { sleepScore?: number; recovery?: number }> = {}
  for (const r of known) for (const k of ['sleepScore', 'recovery'] as const) if (typeof r.payload?.[k] === 'number') (scores[r.day] ??= {})[k] = r.payload[k] as number
  const out = rowsToWrite(fresh, state, scores)
  const newest: Record<string, string> = {}
  for (const r of known) if (r.at > (newest[r.day] ?? '')) newest[r.day] = r.at
  return Object.entries(out)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, payload]) => ({ id: rowId(day, payload, newest[day] ?? ''), device: DEVICE, at, day, type: 'vitals', payload: payload as LedgerEvent['payload'] }))
}

/**
 * A row's id, made from what it says and what the ledger held for its day when it was planned. Two syncs that
 * run at once (Google sends steps, distance and calories as separate notifications, seconds apart) read the
 * same ledger and plan the same row, so they make the same id and the ledger keeps one (written with
 * on_conflict=id, ignore-duplicates). A later sync that writes the same numbers again, after something else
 * changed them in between, sees a newer row for the day and so makes a new id: that write still lands.
 */
export function rowId(day: string, payload: object, newestKnown: string): string {
  const keys = Object.keys(payload).sort()
  const h = createHash('sha256').update(JSON.stringify(['vitals', day, newestKnown, keys.map((k) => [k, (payload as Record<string, unknown>)[k]])])).digest('hex')
  // shaped as a version-5-style UUID, which is what the column takes
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** How the planned rows are sent: a row already there (same id) is skipped, not an error. */
export const WRITE_PATH = 'events?on_conflict=id'
export const WRITE_PREFER = 'resolution=ignore-duplicates,return=minimal'
