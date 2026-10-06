// The Woodshed side of LifeOS.
//
// The Guitar habit is "linked": it opens into today's practice session, picked
// by the Woodshed coach. Each item is logged here with how it felt, which
// writes a `guitar` event Woodshed reads, and the habit ticks itself when the
// whole session is done. State (practice logs, parked items, the day's frozen
// plan) is folded from `guitar` / `guitar_plan` events by the shared core and
// cached locally so the block works offline.
import { useSyncExternalStore } from 'react'
import { planFor } from '../woodshed-core/coach.ts'
import { ITEMS } from '../woodshed-core/course.ts'
import { emptyShed, foldShed, type LedgerEvent, type ShedState } from '../woodshed-core/model.ts'

// A habit of its own, not the old 'guitar' id (which is on the deleted list).
export const GUITAR_HABIT = 'woodshed-guitar'
// localhost is only a dev default; without VITE_WOODSHED_URL a production build shows no link.
export const WOODSHED_URL: string = import.meta.env.VITE_WOODSHED_URL || (import.meta.env.DEV ? 'http://localhost:5180' : '')

const listeners = new Set<() => void>()
const KEY = 'lifeos.woodshed.v1'

function load(): ShedState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ShedState | null
    return raw && raw.logs && raw.parked && raw.plans ? raw : emptyShed()
  } catch {
    return emptyShed()
  }
}

let state: ShedState = load()

export const getShed = (): ShedState => state
export const useShed = (): ShedState =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, getShed)

/** Fold ledger events (remote or our own) into Woodshed state. Idempotent. */
export function applyShedEvents(events: LedgerEvent[]): void {
  const next = foldShed(state, events)
  if (next === state) return
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota — the ledger still has it */
  }
  listeners.forEach((l) => l())
}

/** Today's session: the plan a device already published, else the coach's pick right now. */
export const sessionToday = (s: ShedState, day: string) => planFor(ITEMS, s, day)
