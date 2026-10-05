// GAME CORE — shared by Pokedex and Life OS.
// Source of truth lives in the pokedex repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.
//
// Every number that shapes the game is in this file.

/** Bump when a rule changes, and note the day it took effect in the guide. */
export const RULES_VERSION = 1
/** Days before this are not part of the game. */
export const GAME_START = '2026-10-03'

// ── XP ──────────────────────────────────────────────────────────────────────
export type Tier = 'pillar' | 'core' | 'standard' | 'basic'
export const TIERS: Tier[] = ['pillar', 'core', 'standard', 'basic']
/** A pillar is the day's real work (LeetCode, Gym, Woodshed, Arbor). Everything else is small on purpose, but never zero. */
export const TIER_XP: Record<Tier, number> = { pillar: 100, core: 30, standard: 3, basic: 1 }
export const tierXp = (tier: string): number => TIER_XP[tier as Tier] ?? TIER_XP.basic

/** What a habit says about the day. Decides branching evolutions and Mega X / Y. */
export type Tag = 'code' | 'fitness' | 'guitar' | 'arbor' | 'sleep' | 'routine'
export const TAGS: Tag[] = ['code', 'fitness', 'guitar', 'arbor', 'sleep', 'routine']
/** Habit id → tag. A new pillar (a measured Sleep, say) is one more line here. */
export const HABIT_TAG: Record<string, Tag> = {
  'leetcode-coding': 'code',
  gym: 'fitness',
  'woodshed-guitar': 'guitar',
  'arbor-morning': 'arbor',
  'sleep-before-10': 'sleep',
}
export const tagOf = (habitId: string): Tag => HABIT_TAG[habitId] ?? 'routine'

/** Habits that open into a block of items and pay for the share that was done. */
export const ARBOR_HABIT = 'arbor-morning'
export const GUITAR_HABIT = 'woodshed-guitar'

/** A tick counts if it was made by the end of the day after the one it belongs to. */
export const GRACE_DAYS = 1

// ── momentum ────────────────────────────────────────────────────────────────
/** A day "counts" when this many pillars were done (or all of them, if there are fewer). */
export const PILLARS_FOR_A_DAY = 2
export const MOMENTUM_WINDOW = 7
/** Multiplier from how many of the previous seven days counted. Never resets, only slides. */
export const momentumMult = (days: number): number => (days >= 7 ? 1.5 : days >= 5 ? 1.35 : days >= 3 ? 1.2 : 1)

// ── levels ──────────────────────────────────────────────────────────────────
export const xpForLevel = (level: number): number => 6 * level * level
export const levelOf = (xp: number): number => Math.max(1, Math.floor(Math.sqrt(xp / 6) + 1e-9))

/** Level at which a stage evolves, by how many stages its line has. null = it does not. */
export const evolveAt = (stages: number, stage: number): number | null =>
  stages >= 3 ? (stage === 1 ? 16 : stage === 2 ? 36 : null) : stages === 2 ? (stage === 1 ? 25 : null) : null
/** Level at which a partner is finished and moves into the Pokedex for good. */
export const graduateAt = (stages: number): number => (stages <= 1 ? 30 : 50)

// ── catching ────────────────────────────────────────────────────────────────
export const START_SPECIES = 'charmander'
export const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'] as const
/** Each pair of graduates opens the next region. */
export const GRADUATES_PER_REGION = 2
export const regionsOpen = (graduates: number): number => Math.min(REGIONS.length, 1 + Math.floor(graduates / GRADUATES_PER_REGION))
/** Every Nth perfect day, counted for life. */
export const RARE_EVERY = 5
export const SHINY_EVERY = 10
export const LEGENDARY_EVERY = 25
/** Odds of an ordinary catch or egg: common / uncommon / rare. */
export const CATCH_WEIGHTS = { C: 65, U: 30, R: 5 } as const

// ── weekly ──────────────────────────────────────────────────────────────────
/** Counting days in a Monday-to-Sunday week needed for a badge. */
export const BADGE_DAYS = 5
export const BADGES_PER_REGION = 8
/** Two days running without a single pillar and the partner dozes off. */
export const SLEEP_AFTER = 2
