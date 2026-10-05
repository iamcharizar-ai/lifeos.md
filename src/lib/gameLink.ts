// The two things the game reads straight from the ledger, beyond habits and
// ticks: what the band measured (`vitals`, written by the Vitals sync) and
// items used from the Pokedex's Bag (`item_use`). Kept as the events
// themselves and folded by the shared core, so this app and the Pokedex read
// them the same way. Cached locally so the partner strip is right offline.
import { useSyncExternalStore } from 'react'
import { BODY_EVENT, USE_EVENT, bodyOf, usesOf, type GameEvent } from '../game-core/events.ts'
import { bandFrom, type BodyFacts, type ItemUse } from '../game-core/facts.ts'
import { inOrder } from '../game-core/order.ts'
import { SLEEP_HABIT, V2_START } from '../game-core/rules.ts'

type Stored = GameEvent & { device?: string; inserted_at?: string }

export interface GameLink {
  body: Record<string, BodyFacts>
  uses: ItemUse[]
  /** first day the band reported a sleep score; null = no band yet */
  band: string | null
}

const KEY = 'lifeos.gamelink.v1'
const listeners = new Set<() => void>()
const keyOf = (e: Stored): string => `${e.device ?? ''}|${e.at}|${e.type}|${JSON.stringify(e.payload)}`
// a vitals row matters here only when it carries something the game reads
const relevant = (e: Stored): boolean =>
  e.type === USE_EVENT || (e.type === BODY_EVENT && ['sleepScore', 'steps', 'recovery'].some((k) => k in (e.payload ?? {})))

function load(): Stored[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Stored[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

let events: Stored[] = load()
const seen = new Set(events.map(keyOf))
const derive = (): GameLink => {
  const sorted = inOrder(events)
  const body = bodyOf(sorted)
  return { body, uses: usesOf(sorted), band: bandFrom({ habits: [], ticks: {}, today: '', body }) }
}
let state: GameLink = derive()

export const getGameLink = (): GameLink => state
export const useGameLink = (): GameLink =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, getGameLink)

/** Fold ledger events (remote or replayed at boot) in. Idempotent. */
export function applyGameEvents(fresh: Stored[]): void {
  const add = fresh.filter((e) => relevant(e) && !seen.has(keyOf(e)))
  if (!add.length) return
  for (const e of add) seen.add(keyOf(e))
  events = [...events, ...add]
  state = derive()
  try {
    localStorage.setItem(KEY, JSON.stringify(events))
  } catch {
    /* quota: the ledger still has it */
  }
  listeners.forEach((l) => l())
}

/** Once the band reports sleep, the Sleep habit is filled by its score and not by hand. */
export const sleepMeasured = (link: GameLink, habitId: string, day: string): boolean =>
  habitId === SLEEP_HABIT && link.band !== null && day >= link.band && day >= V2_START
