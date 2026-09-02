// Live habit config — a tiny external store over localStorage, updated by
// last-write-wins `config` events from the ledger and by the PC vault poller.
// Everything that renders or scores habits reads getHabits()/useHabits() so a
// template edit in Obsidian propagates to every device without a redeploy.
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_HABITS,
  DEFAULT_TIERS,
  activateOn,
  archiveOn,
  habitIdFor,
  isLive,
  isWaterHabit,
  migrateHabit,
  parseTemplateHabits,
  type Habit,
  type Tier,
} from '../config/habits'
import { dateISO } from './store'

// Water habits are retired from the stack (hydration = Health-tab meter);
// strip them at every ingress so no source can resurrect them.
const stripWater = (habits: Habit[]): Habit[] => habits.filter((h) => !isWaterHabit(h.id))

// Every ingress (localStorage, cloud event, vault template) runs through this,
// so the rest of the app can assume `spans` is always present and sane.
const normalize = (habits: Habit[]): Habit[] => stripWater(habits).map(migrateHabit)

export type ConfigSource = 'default' | 'vault' | 'app' | 'cloud'

export interface HabitConfig {
  habits: Habit[]
  at: string // ISO timestamp — LWW ordering across devices
  source: ConfigSource
}

const CFG_KEY = 'lifeos.habitcfg.v1'
const EPOCH = '1970-01-01T00:00:00.000Z'

function load(): HabitConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (raw) {
      const cfg = JSON.parse(raw) as HabitConfig
      if (Array.isArray(cfg.habits) && cfg.habits.length > 0 && cfg.at)
        return { ...cfg, habits: normalize(cfg.habits) }
    }
  } catch {
    /* corrupted → default */
  }
  return { habits: DEFAULT_HABITS, at: EPOCH, source: 'default' }
}

let current: HabitConfig = load()
const listeners = new Set<() => void>()

export const getConfig = (): HabitConfig => current

/** The whole library — live habits and dropped ones alike. Month views need both. */
export const getHabits = (): Habit[] => current.habits

/** Only what is on the checklist today. Daily list, XP and vault write-back use this. */
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
 * names; anything only the loser knows is adopted *dropped* rather than thrown
 * away, so nothing can delete a habit's history for good:
 *   - a device that never saw a habit can't erase it by making the next edit;
 *   - a pre-span config event, where deleting meant vanishing from the payload,
 *     replays as "was dropped that day" instead of resurrecting on the checklist.
 * The cost is that a purge can be undone by a stale peer — cheap, since purge
 * only ever removes never-ticked entries.
 */
function mergeRegistries(winner: Habit[], loser: Habit[], on: string): Habit[] {
  const known = new Set(winner.map((h) => h.id))
  const extra = loser.filter((h) => !known.has(h.id)).map((h) => archiveOn(h, on))
  return [...winner, ...extra]
}

/**
 * Fold one config event in. Newer wins on the fields of a habit both sides know,
 * but habits only the *other* side knows are always adopted — an older event
 * from a device that has been offline still teaches us the habits it created.
 * Returns true when the visible list changed.
 */
export function applyConfig(cfg: HabitConfig): boolean {
  if (!Array.isArray(cfg.habits) || cfg.habits.length === 0) return false
  const incoming = normalize(cfg.habits)
  if (incoming.length === 0) return false
  const newer = cfg.at > current.at
  // Habits the winner dropped are closed as of the winning config's own day, so
  // replaying history lands the archive date where it actually happened.
  const on = (newer ? cfg.at : current.at).slice(0, 10)
  const habits = newer
    ? mergeRegistries(incoming, current.habits, on)
    : mergeRegistries(current.habits, incoming, on)
  const at = newer ? cfg.at : current.at
  const changed = !sameHabits(habits, current.habits)
  if (!changed && at === current.at) return false
  current = { habits, at, source: newer ? cfg.source : current.source }
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(current))
  } catch {
    /* quota — state still lives in the ledger */
  }
  if (changed) listeners.forEach((l) => l())
  return changed
}

/**
 * Build a config from the vault's daily template, or null when nothing changed.
 * Template owns names/emoji/order/membership; tiers carry over from the current
 * config (new habits default to their legacy tier, else 'standard').
 *
 * Missing from the template means *dropped*, never *deleted* — the habit keeps
 * its registry entry with a closed span, so its history stays readable and a
 * later template edit can bring it back without losing the gap.
 */
export function configFromTemplate(text: string, today: string = dateISO()): HabitConfig | null {
  const parsed = parseTemplateHabits(text)
  if (!parsed) return null
  const prev = new Map(current.habits.map((h) => [h.id, h]))
  const seen = new Set<string>()
  const habits: Habit[] = []
  for (const { name, emoji } of parsed) {
    const id = habitIdFor(name)
    if (seen.has(id)) continue // duplicate line in template — keep the first
    if (isWaterHabit(id)) continue // hydration lives on the Health tab now
    seen.add(id)
    const old = prev.get(id)
    if (old) habits.push({ ...activateOn(old, today), name, emoji })
    else
      habits.push({
        id,
        name,
        emoji,
        tier: DEFAULT_TIERS[id] ?? 'standard',
        spans: [{ from: today, to: null }],
      })
  }
  if (habits.length === 0) return null
  // Everything the template no longer lists keeps its place in the library.
  for (const h of current.habits) if (!seen.has(h.id)) habits.push(archiveOn(h, today))
  if (sameHabits(habits, current.habits)) return null
  return { habits, at: new Date().toISOString(), source: 'vault' }
}

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
  return { habits, at: new Date().toISOString(), source: 'app' }
}

/** Append a brand-new habit, live from `today`. Null when the id already exists. */
export function configWithNewHabit(
  habit: Omit<Habit, 'spans'>,
  today: string = dateISO(),
): HabitConfig | null {
  if (current.habits.some((h) => h.id === habit.id)) return null
  const habits = [...current.habits, { ...habit, spans: [{ from: today, to: null }] }]
  return { habits, at: new Date().toISOString(), source: 'app' }
}

/**
 * Erase a habit from the library outright. Only for entries with no history —
 * anything that was ever ticked must stay so past months keep rendering it.
 */
export function configWithoutHabit(habitId: string): HabitConfig | null {
  const habits = current.habits.filter((h) => h.id !== habitId)
  if (habits.length === current.habits.length || habits.length === 0) return null
  return { habits, at: new Date().toISOString(), source: 'app' }
}

/** New config with one habit's tier changed (app-owned edit), or null if a no-op. */
export function configWithTier(habitId: string, tier: Tier): HabitConfig | null {
  const habits = current.habits.map((h) => (h.id === habitId ? { ...h, tier } : h))
  if (sameHabits(habits, current.habits)) return null
  return { habits, at: new Date().toISOString(), source: 'app' }
}

/**
 * Commit a locally-built config. Unlike applyConfig this never loses to LWW —
 * a local edit is always the newest intent on this device.
 */
export function commitConfig(cfg: HabitConfig): HabitConfig {
  const next = { ...cfg, habits: normalize(cfg.habits) }
  current = next
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(next))
  } catch {
    /* quota — state still lives in the ledger */
  }
  listeners.forEach((l) => l())
  return next
}

/**
 * Save the daily checklist after a manager edit (reorder / rename / retier).
 * `liveList` is only the habits that stay on the checklist: registry entries it
 * omits are archived rather than dropped, and already-archived ones are carried
 * through untouched so the library never shrinks behind the user's back.
 */
export function saveHabits(liveList: Habit[], today: string = dateISO()): HabitConfig {
  const edited = new Map(liveList.map((h) => [h.id, h]))
  const habits: Habit[] = liveList.map((h) => {
    const old = current.habits.find((x) => x.id === h.id)
    // Keep the registry's spans — the manager edits labels and order, not history.
    if (old) return { ...h, spans: activateOn(old, today).spans }
    // Unknown id (a habit added straight from the manager) starts today.
    return { ...h, spans: h.spans?.length ? h.spans : [{ from: today, to: null }] }
  })
  for (const h of current.habits) {
    if (edited.has(h.id)) continue
    habits.push(isLive(h) ? archiveOn(h, today) : h)
  }
  return commitConfig({ habits, at: new Date().toISOString(), source: 'app' })
}

