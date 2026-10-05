// GAME CORE — shared by Pokedex and Life OS.
// Source of truth lives in the pokedex repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.
//
// Every number that shapes the game is in this file.

/** Bump when a rule changes, and note the day it took effect in the guide. */
export const RULES_VERSION = 2
/** Days before this are not part of the game. */
export const GAME_START = '2026-10-03'
/** Rules version 2 (gyms, the Bag, stones, the measured Sleep pillar) applies from this day. Earlier days keep version 1. */
export const V2_START = '2026-10-06'

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

/** The sleep habit. Once the band reports a sleep score it becomes a pillar paid on that score. */
export const SLEEP_HABIT = 'sleep-before-10'
/** Sleep score (0-100) at which the Sleep pillar counts as done. It pays score/100 of a pillar either way. */
export const SLEEP_DONE = 80

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

// ── version 2: gyms and the league ──────────────────────────────────────────
/** Each badge week beats the next gym of the current region. After the eighth, the next four beat the Elite Four and the fifth the Champion. A missed week costs nothing: the next badge week carries on. */
export const LEAGUE_STEPS = 5
/** A region opens only when BOTH are true: enough partners fully trained, and the league before it beaten. */
export const regionsOpenV2 = (graduates: number, leagues: number): number =>
  Math.min(REGIONS.length, 1 + Math.min(Math.floor(graduates / GRADUATES_PER_REGION), leagues))

// ── version 2: stones ───────────────────────────────────────────────────────
// Evolution is never touched by any of this: a partner evolves by level, on
// its own. Stones are a rare extra, earned (never bought) and spent by hand in
// the Pokedex on things that change nothing about XP. Which stone you get is
// only its look: any stone does any of the three things.
export const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'shiny-stone', 'dusk-stone', 'dawn-stone', 'ice-stone'] as const
export type Stone = (typeof STONES)[number]
/** A gym badge comes with the stone of whatever led that week. */
export const STONE_FOR_TAG: Partial<Record<Tag, Stone>> = {
  fitness: 'fire-stone', sleep: 'water-stone', code: 'thunder-stone', arbor: 'leaf-stone', guitar: 'moon-stone',
}
/** The Elite Four, the Champion and every RARE_EVERY-th perfect day hand over the next of these in turn. */
export const MILESTONE_STONES: Stone[] = ['sun-stone', 'shiny-stone', 'dusk-stone', 'dawn-stone', 'ice-stone']
export const ITEM_NAME: Record<string, string> = {
  'fire-stone': 'Fire Stone', 'water-stone': 'Water Stone', 'thunder-stone': 'Thunder Stone', 'leaf-stone': 'Leaf Stone', 'moon-stone': 'Moon Stone',
  'sun-stone': 'Sun Stone', 'shiny-stone': 'Shiny Stone', 'dusk-stone': 'Dusk Stone', 'dawn-stone': 'Dawn Stone', 'ice-stone': 'Ice Stone',
}
/**
 * What one stone can be spent on:
 *  mega    the partner Mega Evolves for MEGA_DAYS days, whatever momentum is doing
 *  branch  choose which way a branching Pokemon evolves when its level comes (it still evolves on its own)
 *  lead    bring a Pokemon from the queue forward as the partner; the old one waits at the front, XP kept
 */
export type StoneUse = 'mega' | 'branch' | 'lead'
export const MEGA_DAYS = 7

// ── version 2: trainer stats ────────────────────────────────────────────────
/** Stats are an average over this many days. */
export const STAT_DAYS = 28
/** Steps in a day that count as a full Speed day. */
export const STEPS_GOAL = 10000
