// Live habit config — a tiny external store over localStorage, updated by
// last-write-wins `config` events from the cloud ledger. Everything that renders
// or scores habits reads getHabits()/useHabits().
//
// Delete is real. A deleted habit's id goes on a tombstone list that travels
// with the config, so no stale peer can re-adopt it during a merge and no
// replay of the append-only ledger can resurrect it. Past months are safe
// because they live in frozen month snapshots, not in this registry.
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_HABITS,
  activateOn,
  archiveOn,
  isLive,
  migrateHabit,
  type Habit,
  type Tier,
} from '../config/habits'
import { dateISO } from './store'

// Hydration left the habit stack in 2026-07 and lives nowhere now. Seeded as
// tombstones so a replay of a pre-2026-07 config event can't bring it back.
const LEGACY_TOMBSTONES = [
  'water-1l-morning',
  'water-1l-midday',
  'water-1l-afternoon',
  'water-1l-evening',
]

export type ConfigSource = 'default' | 'app' | 'cloud'

export interface HabitConfig {
  habits: Habit[]
  /** ids erased for good — never re-adopted from any source */
  deleted: string[]
  at: string // ISO timestamp — LWW ordering across devices
  source: ConfigSource
}

const CFG_KEY = 'lifeos.habitcfg.v1'
const EPOCH = '1970-01-01T00:00:00.000Z'

/** Every ingress runs through this, so the rest of the app can assume sane spans. */
function normalize(habits: Habit[], deleted: Iterable<string>): Habit[] {
  const gone = new Set(deleted)
  const seen = new Set<string>()
  const out: Habit[] = []
  for (const h of habits) {
    if (!h?.id || gone.has(h.id) || seen.has(h.id)) continue
    seen.add(h.id)
    out.push(migrateHabit(h))
  }
  return out
}

function load(): HabitConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (raw) {
      const cfg = JSON.parse(raw) as HabitConfig
      if (Array.isArray(cfg.habits) && cfg.at) {
        const deleted = [...new Set([...(cfg.deleted ?? []), ...LEGACY_TOMBSTONES])]
        return { ...cfg, deleted, habits: normalize(cfg.habits, deleted) }
      }
    }
  } catch {
    /* corrupted → default */
  }
  return {
    habits: DEFAULT_HABITS,
    deleted: [...LEGACY_TOMBSTONES],
    at: EPOCH,
    source: 'default',
  }
}

let current: HabitConfig = load()
const listeners = new Set<() => void>()

export const getConfig = (): HabitConfig => current

/** The whole library — habits on the checklist and switched-off ones alike. */
export const getHabits = (): Habit[] => current.habits

/** Only what is on the checklist today. */
export const getLiveHabits = (): Habit[] => current.habits.filter(isLive)

export function subscribeHabits(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useHabits(): Habit[] {
  return useSyncExternalStore(subscribeHabits, getHabits)
}

function sameSpans(a: Habit, b: Habit): boolean {
  return (
    a.spans.length === b.spans.length &&
    a.spans.every((s, i) => s.from === b.spans[i].from && s.to === b.spans[i].to)
  )
}

function sameHabits(a: Habit[], b: Habit[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (h, i) =>
        h.id === b[i].id &&
        h.name === b[i].name &&
        h.emoji === b[i].emoji &&
        h.tier === b[i].tier &&
        sameSpans(h, b[i]),
    )
  )
}

/**
 * Union two registries. The winner's list is authoritative for the habits it
 * names; a habit only the loser knows is adopted (switched off, so it can't
 * silently rejoin the checklist) — that way a device that has been offline can
 * still teach us habits it created. Tombstoned ids are the exception: they are
 * gone from both sides for good.
 */
function mergeRegistries(winner: Habit[], loser: Habit[], gone: Set<string>, on: string): Habit[] {
  const known = new Set(winner.map((h) => h.id))
  const extra = loser
    .filter((h) => !known.has(h.id) && !gone.has(h.id))
    .map((h) => archiveOn(h, on))
  return [...winner, ...extra]
}

/**
 * Fold one config event in. Newer wins on the fields of a habit both sides know.
 * Tombstones always union — a delete is never undone by an older peer.
 * Returns true when the visible list changed.
 */
export function applyConfig(cfg: HabitConfig): boolean {
  if (!Array.isArray(cfg.habits)) return false
  const deleted = [...new Set([...current.deleted, ...(cfg.deleted ?? [])])]
  const gone = new Set(deleted)
  const incoming = normalize(cfg.habits, gone)
  const newer = cfg.at > current.at
  // Habits the winner doesn't list are closed as of the winning config's own
  // day, so replaying history lands the archive date where it actually happened.
  const on = (newer ? cfg.at : current.at).slice(0, 10)
  const mine = normalize(current.habits, gone)
  const habits = newer
    ? mergeRegistries(incoming, mine, gone, on)
    : mergeRegistries(mine, incoming, gone, on)
  const at = newer ? cfg.at : current.at
  const changed = !sameHabits(habits, current.habits)
  if (!changed && at === current.at && deleted.length === current.deleted.length) return false
  current = { habits, deleted, at, source: newer ? cfg.source : current.source }
  persist()
  if (changed) listeners.forEach((l) => l())
  return changed
}

function persist(): void {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(current))
  } catch {
    /* quota — state still lives in the ledger */
  }
}

const stamp = (habits: Habit[], deleted = current.deleted): HabitConfig => ({
  habits,
  deleted,
  at: new Date().toISOString(),
  source: 'app',
})

/** Flip one habit on/off the checklist as of `today`, or null if it is a no-op. */
export function configWithLive(
  habitId: string,
  live: boolean,
  today: string = dateISO(),
): HabitConfig | null {
  const habits = current.habits.map((h) =>
    h.id === habitId ? (live ? activateOn(h, today) : archiveOn(h, today)) : h,
  )
  if (sameHabits(habits, current.habits)) return null
  return stamp(habits)
}

/** Append a brand-new habit, live from `today`. Null when the id already exists. */
export function configWithNewHabit(
  habit: Omit<Habit, 'spans'>,
  today: string = dateISO(),
): HabitConfig | null {
  if (current.habits.some((h) => h.id === habit.id)) return null
  // A re-created id must clear its tombstone, or normalize() would drop it again.
  const deleted = current.deleted.filter((id) => id !== habit.id)
  return stamp([...current.habits, { ...habit, spans: [{ from: today, to: null }] }], deleted)
}

/** Edit a habit's label / emoji / tier in place. Null when nothing changed. */
export function configWithEdit(
  habitId: string,
  patch: Partial<Pick<Habit, 'name' | 'emoji' | 'tier'>>,
): HabitConfig | null {
  const habits = current.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h))
  if (sameHabits(habits, current.habits)) return null
  return stamp(habits)
}

/** New config with one habit's tier changed, or null if a no-op. */
export const configWithTier = (habitId: string, tier: Tier): HabitConfig | null =>
  configWithEdit(habitId, { tier })

/**
 * Erase a habit for good. No history guard: finished months are already frozen
 * into snapshots, and the current month is meant to be editable. The id is
 * tombstoned so no merge or ledger replay can bring it back.
 */
export function configWithoutHabit(habitId: string): HabitConfig | null {
  const habits = current.habits.filter((h) => h.id !== habitId)
  if (habits.length === current.habits.length) return null
  return stamp(habits, [...new Set([...current.deleted, habitId])])
}

/** Erase several habits at once (Clean up → multi-select). */
export function configWithoutHabits(ids: string[]): HabitConfig | null {
  const gone = new Set(ids)
  const habits = current.habits.filter((h) => !gone.has(h.id))
  if (habits.length === current.habits.length) return null
  return stamp(habits, [...new Set([...current.deleted, ...ids])])
}

/**
 * Reorder the registry. `orderedIds` may cover a subset (e.g. only the live
 * habits the user just dragged); the listed ids are rearranged among the
 * positions they already occupy, so everything else keeps its place.
 */
export function configWithOrder(orderedIds: string[]): HabitConfig | null {
  const inScope = new Set(orderedIds)
  const queue = orderedIds
    .map((id) => current.habits.find((h) => h.id === id))
    .filter((h): h is Habit => Boolean(h))
  if (queue.length === 0) return null
  let next = 0
  const habits = current.habits.map((h) => (inScope.has(h.id) ? queue[next++] : h))
  if (sameHabits(habits, current.habits)) return null
  return stamp(habits)
}

/**
 * Commit a locally-built config. Unlike applyConfig this never loses to LWW —
 * a local edit is always the newest intent on this device.
 */
export function commitConfig(cfg: HabitConfig): HabitConfig {
  const deleted = [...new Set(cfg.deleted ?? current.deleted)]
  current = { ...cfg, deleted, habits: normalize(cfg.habits, deleted) }
  persist()
  listeners.forEach((l) => l())
  return current
}
