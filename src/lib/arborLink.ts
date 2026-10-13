// The Arbor + Strong side of LifeOS.
//
// Three habits are "linked": they are fed by the other apps through the shared
// ledger instead of being ticked by hand. (The third, Guitar, lives in
// lib/guitarLink.ts.)
//   • gym            → ticked by a `workout` event from Strong (locked here)
//   • arbor-morning  → expands into today's coach-picked skills; each one is
//                      tickable here and writes a `skill` event Arbor reads
// Arbor state (skill progress, practice log, the day's frozen plan) is folded
// from `skill` / `plan` events by the shared core and cached locally so the
// block works offline.
import { useSyncExternalStore } from 'react'
import { planFor } from '../arbor-core/coach.ts'
import { emptyArbor, foldArbor, type ArborState, type LedgerEvent } from '../arbor-core/model.ts'
import { SKILLS } from '../arbor-core/skills.ts'
import { GUITAR_HABIT } from './guitarLink'

export const GYM_HABIT = 'gym'
export const ARBOR_HABIT = 'arbor-morning'
export type Link = 'strong' | 'arbor' | 'woodshed' | 'vitals'
export const linkOf = (habitId: string): Link | null =>
  habitId === GYM_HABIT ? 'strong' : habitId === ARBOR_HABIT ? 'arbor' : habitId === GUITAR_HABIT ? 'woodshed' : null

// Gym stays hand-tickable until Strong has proven the link works (one workout
// event from it has been folded). Locking it before that would leave no way to
// tick Gym at all if Strong is not connected to the ledger yet.
const STRONG_SEEN = 'lifeos.strongLinked.v1'
let strongSeen = localStorage.getItem(STRONG_SEEN) === '1'
export const isStrongLinked = (): boolean => strongSeen
export function markStrongLinked(): void {
  if (strongSeen) return
  strongSeen = true
  localStorage.setItem(STRONG_SEEN, '1')
  listeners.forEach((l) => l())
}
export const useStrongLinked = (): boolean =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, isStrongLinked)

/** True when this habit must not be ticked by hand right now. */
export const isLocked = (habitId: string): boolean =>
  habitId === ARBOR_HABIT || (habitId === GYM_HABIT && strongSeen)

export const STRONG_URL = 'https://strong-five.vercel.app'
export const ARBOR_URL = 'https://arbor-umber.vercel.app'

const listeners = new Set<() => void>()
const KEY = 'lifeos.arbor.v1'

function load(): ArborState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ArborState | null
    return raw && raw.progress && raw.practice && raw.plans ? raw : emptyArbor()
  } catch {
    return emptyArbor()
  }
}

let state: ArborState = load()

export const getArbor = (): ArborState => state
export const useArbor = (): ArborState =>
  useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, getArbor)

/** Fold ledger events (remote or our own) into Arbor state. Idempotent. */
export function applyArborEvents(events: LedgerEvent[]): void {
  const next = foldArbor(state, events)
  if (next === state) return
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota — the ledger still has it */
  }
  listeners.forEach((l) => l())
}

/** Today's skills: the plan a device already published, else the coach's pick right now. */
export const planToday = (s: ArborState, day: string) => planFor(SKILLS, s, day)
