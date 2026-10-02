// The Sunday reset list — a second, separate roster of one-off self-care tasks
// (cut nails, face pack, clean the room…) that only ever shows on Sundays.
//
// Deliberately NOT habits: they have no tiers, no XP, no streaks, and they never
// touch the Monthly graph, so a long Sunday list can't make Sundays look like a
// bad day. What a Sunday task shares with habits is its tick: it is a normal
// `tick` event (habit id `sun:<id>`, keyed on the real Sunday's date), so
// phone↔PC sync and the offline outbox work with no new plumbing.
//
// The list itself (which tasks exist, their order) is a tiny external store over
// localStorage, last-write-wins by timestamp across devices via `sunday` events
// — the same shape as lib/habitConfig.ts.
import { useSyncExternalStore } from 'react'

export interface SundayTask {
  id: string
  name: string
  emoji: string
}

export interface SundayList {
  tasks: SundayTask[]
  at: string // ISO timestamp — LWW ordering across devices
}

const KEY = 'lifeos.sunday.v1'
/** `at` of the built-in seed list — anything newer is a list somebody saved. */
export const SEED_AT = '1970-01-01T00:00:00.000Z'

// Seeds for a device that has never saved a list. Any real list (local or from
// the cloud) outranks them, and deleting them all sticks.
const DEFAULTS: SundayTask[] = [
  { id: 'cut-nails', name: 'Cut nails', emoji: '💅' },
  { id: 'face-pack', name: 'Face pack', emoji: '🧖' },
  { id: 'pluck-eyebrows', name: 'Pluck eyebrows (monobrow)', emoji: '🤨' },
  { id: 'shave-legs', name: 'Shave legs', emoji: '🪒' },
]

/** Tick key for a Sunday task — the colon keeps it clear of habit slugs. */
export const sundayTickId = (taskId: string): string => `sun:${taskId}`

/** Local calendar day → is it a Sunday? (noon dodges any DST edge) */
export const isSunday = (day: string): boolean => new Date(`${day}T12:00:00`).getDay() === 0

/** Every ingress runs through this: well-formed, trimmed, unique ids. */
function clean(tasks: unknown): SundayTask[] {
  if (!Array.isArray(tasks)) return []
  const seen = new Set<string>()
  const out: SundayTask[] = []
  for (const t of tasks as Partial<SundayTask>[]) {
    const name = typeof t?.name === 'string' ? t.name.trim() : ''
    if (!t?.id || typeof t.id !== 'string' || !name || seen.has(t.id)) continue
    seen.add(t.id)
    out.push({ id: t.id, name, emoji: (typeof t.emoji === 'string' && t.emoji.trim()) || '⭐' })
  }
  return out
}

function load(): SundayList {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const list = JSON.parse(raw) as SundayList
      if (Array.isArray(list.tasks) && list.at) return { at: list.at, tasks: clean(list.tasks) }
    }
  } catch {
    /* corrupted → defaults */
  }
  return { tasks: DEFAULTS, at: SEED_AT }
}

let current: SundayList = load()
const listeners = new Set<() => void>()

export const getSundayList = (): SundayList => current
export const getSundayTasks = (): SundayTask[] => current.tasks

export function useSundayTasks(): SundayTask[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getSundayTasks,
  )
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* quota — the ledger still has it */
  }
}

const sameTasks = (a: SundayTask[], b: SundayTask[]): boolean =>
  a.length === b.length &&
  a.every((t, i) => t.id === b[i].id && t.name === b[i].name && t.emoji === b[i].emoji)

/** Fold a list from the cloud in. Newer wins; returns true when the tasks changed. */
export function applySundayList(list: SundayList): boolean {
  if (!Array.isArray(list.tasks) || !list.at || list.at <= current.at) return false
  const tasks = clean(list.tasks)
  const changed = !sameTasks(tasks, current.tasks)
  current = { tasks: changed ? tasks : current.tasks, at: list.at }
  persist()
  if (changed) listeners.forEach((l) => l())
  return changed
}

/**
 * Save a locally edited list. A local edit is always the newest intent on this
 * device, so unlike applySundayList this never loses to LWW.
 */
export function commitSundayTasks(tasks: SundayTask[]): SundayList {
  current = { tasks: clean(tasks), at: new Date().toISOString() }
  persist()
  listeners.forEach((l) => l())
  return current
}
