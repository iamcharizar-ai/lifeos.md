// What the game reads straight from the ledger, beyond habits and ticks: what
// the band measured (`vitals`, written by the Vitals sync), stones spent and
// partners chosen in the Pokedex (`item_use`), and each day's frozen habit
// list (`day_list`, written here once a day). Kept as the events
// themselves and folded by the shared core, so this app and the Pokedex read
// them the same way. Cached locally so the partner strip is right offline.
import { useSyncExternalStore } from 'react'
import { BODY_EVENT, LIST_EVENT, USE_EVENT, bodyOf, listsOf, sleepOf, usesOf, type GameEvent, type SleepNight } from '../game-core/events.ts'
import { bandFrom, type BodyFacts, type ItemUse } from '../game-core/facts.ts'
import { inOrder } from '../game-core/order.ts'
import { SLEEP_HABIT } from '../game-core/rules.ts'

type Stored = GameEvent & { device?: string; inserted_at?: string }

export interface GameLink {
  body: Record<string, BodyFacts>
  uses: ItemUse[]
  /** day → the habit list as it stood that day */
  lists: Record<string, { id: string; tier: string }[]>
  /** first day the band reported a sleep score; null = no band yet */
  band: string | null
  /** day → the night that ended on it, as the band reported it (bed and wake times, stages, score) */
  nights: Record<string, SleepNight>
}

const KEY = 'lifeos.gamelink.v1'
const listeners = new Set<() => void>()
const keyOf = (e: Stored): string => `${e.device ?? ''}|${e.at}|${e.type}|${JSON.stringify(e.payload)}`
// a vitals row matters here only when it carries something the game reads
const relevant = (e: Stored): boolean =>
  e.type === USE_EVENT || e.type === LIST_EVENT || (e.type === BODY_EVENT && ['sleepScore', 'steps', 'recovery', 'sleepMin', 'bed', 'wake'].some((k) => k in (e.payload ?? {})))

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
  return { body, uses: usesOf(sorted), lists: listsOf(sorted), band: bandFrom({ habits: [], ticks: {}, today: '', body }), nights: sleepOf(sorted) }
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

/** A sleep habit is filled by the band only on a morning it has a reading. With none, it can be ticked by hand (SLEEP-DESIGN.md D2). */
export const sleepMeasured = (link: GameLink, habitId: string, day: string): boolean =>
  habitId === SLEEP_HABIT && typeof link.body[day]?.sleepScore === 'number'

export type SleepState = 'measured' | 'waiting' | 'off'
/** Last night, as the Sleep row should show it: measured, waiting for the reading, or no band in use. */
export const sleepState = (link: GameLink, day: string): SleepState =>
  typeof link.body[day]?.sleepScore === 'number' ? 'measured' : link.band !== null && day >= link.band ? 'waiting' : 'off'
