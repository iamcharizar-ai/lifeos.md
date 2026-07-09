// Live habit config — a tiny external store over localStorage, updated by
// last-write-wins `config` events from the ledger and by the PC vault poller.
// Everything that renders or scores habits reads getHabits()/useHabits() so a
// template edit in Obsidian propagates to every device without a redeploy.
import { useSyncExternalStore } from 'react'
import {
  DEFAULT_HABITS,
  DEFAULT_TIERS,
  habitIdFor,
  isWaterHabit,
  parseTemplateHabits,
  type Habit,
  type Tier,
} from '../config/habits'

// Water habits are retired from the stack (hydration = Health-tab meter);
// strip them at every ingress so no source can resurrect them.
const stripWater = (habits: Habit[]): Habit[] => habits.filter((h) => !isWaterHabit(h.id))

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
        return { ...cfg, habits: stripWater(cfg.habits) }
    }
  } catch {
    /* corrupted → default */
  }
  return { habits: DEFAULT_HABITS, at: EPOCH, source: 'default' }
}

let current: HabitConfig = load()
const listeners = new Set<() => void>()

export const getConfig = (): HabitConfig => current
export const getHabits = (): Habit[] => current.habits

export function subscribeHabits(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useHabits(): Habit[] {
  return useSyncExternalStore(subscribeHabits, getHabits)
}

function sameHabits(a: Habit[], b: Habit[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (h, i) =>
        h.id === b[i].id && h.name === b[i].name && h.emoji === b[i].emoji && h.tier === b[i].tier,
    )
  )
}

/** Adopt cfg if it is newer than what we hold. Returns true when the list changed. */
export function applyConfig(cfg: HabitConfig): boolean {
  if (cfg.at <= current.at) return false
  if (!Array.isArray(cfg.habits) || cfg.habits.length === 0) return false
  cfg = { ...cfg, habits: stripWater(cfg.habits) }
  if (cfg.habits.length === 0) return false
  const changed = !sameHabits(cfg.habits, current.habits)
  current = cfg
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
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
 */
export function configFromTemplate(text: string): HabitConfig | null {
  const parsed = parseTemplateHabits(text)
  if (!parsed) return null
  const prevTier = new Map(current.habits.map((h) => [h.id, h.tier]))
  const seen = new Set<string>()
  const habits: Habit[] = []
  for (const { name, emoji } of parsed) {
    const id = habitIdFor(name)
    if (seen.has(id)) continue // duplicate line in template — keep the first
    if (isWaterHabit(id)) continue // hydration lives on the Health tab now
    seen.add(id)
    habits.push({ id, name, emoji, tier: prevTier.get(id) ?? DEFAULT_TIERS[id] ?? 'standard' })
  }
  if (habits.length === 0 || sameHabits(habits, current.habits)) return null
  return { habits, at: new Date().toISOString(), source: 'vault' }
}

/** New config with one habit's tier changed (app-owned edit), or null if a no-op. */
export function configWithTier(habitId: string, tier: Tier): HabitConfig | null {
  const habits = current.habits.map((h) => (h.id === habitId ? { ...h, tier } : h))
  if (sameHabits(habits, current.habits)) return null
  return { habits, at: new Date().toISOString(), source: 'app' }
}
