// GAME CORE — shared by Pokedex and Life OS.
// Source of truth lives in the pokedex repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.
//
// Every number that shapes the game is in this file.

/** Bump when a rule changes, and note the day it took effect in the guide. */
export const RULES_VERSION = 5
/** Days before this are not part of the game. */
export const GAME_START = '2026-10-03'
/**
 * Rules version 3 applies from this day: the wild Pokemon with HP, the Box,
 * gym leaders with HP, stones, the measured Sleep pillar. Earlier days keep
 * version 1. (Version 2 was replaced before its first day.)
 */
export const V3_START = '2026-10-05'
/**
 * Rules version 4 applies from this day: a day's list only grows, domains come
 * from the list, badges are the gym reward, stones are no longer earned or
 * spent, Mega is kept for good, bond is never lost, a nature at graduation.
 * No pacing number changed. Days before it keep the version they were played under.
 */
export const V4_START = '2026-10-08'
/**
 * Rules version 5 applies from this day: coins and gems, a shop, balls you
 * throw, berries, incense, a team of three, the Professor, daily and weekly
 * quests, and a softer catch curve. XP still comes only from the day's work.
 * It begins on the same day version 4 was due to, so version 4 never ran a
 * day (as version 2 never did); its rules are all still in force inside 5.
 */
export const V5_START = '2026-10-08'
/** Which rules a day is played under. */
export const rulesOn = (day: string, v3From: string = V3_START, v4From: string = V4_START, v5From: string = V5_START): 1 | 3 | 4 | 5 =>
  day >= v5From ? 5 : day >= v4From ? 4 : day >= v3From ? 3 : 1

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
export const isTag = (x: unknown): x is Tag => typeof x === 'string' && (TAGS as string[]).includes(x)

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

// ── version 3: one wild Pokemon at a time ──────────────────────────────────
// It stands in front of you until it is caught. Each day wears it down by how
// WHOLE the day was: 100 x (share of the day's XP done) squared x the ball, so
// a whole day hits four times as hard as a half day. It never flees.
export type Rarity = 'C' | 'U' | 'R' | 'L'
export const WILD_HP: Record<Rarity, number> = { C: 700, U: 1100, R: 1600, L: 3000 }
/** Every Nth wild Pokemon to appear is a legendary. */
export const LEGENDARY_EVERY_WILD = 25
export const wildHit = (share: number, ball: number): number => Math.round(100 * share * share * ball)
/** The ball comes from the chores: the share of routine habits done. */
export type Ball = 'poke' | 'great' | 'ultra'
export const BALL_MULT: Record<Ball, number> = { poke: 1, great: 1.25, ultra: 1.5 }
export const BALL_NAME: Record<Ball, string> = { poke: 'Poke Ball', great: 'Great Ball', ultra: 'Ultra Ball' }
export const ballFor = (routineShare: number): Ball => (routineShare >= 0.8 ? 'ultra' : routineShare >= 0.5 ? 'great' : 'poke')
/** A perfect day catches the wild Pokemon on the spot, and that catch is shiny one time in this many. */
export const SHINY_ODDS = 10

// ── version 3: gym leaders have HP ──────────────────────────────────────────
// Each day deals the day's base XP to the current leader, with the domains
// that leader is weak to counting extra. HP carries over: no weeks, no
// thresholds, no losing.
export const LEADER_HP = 4000
export const WEAK_MULT = 1.5
/** If the partner's type is super effective against the leader's, everything hits this much harder. */
export const ADVANTAGE_MULT = 1.2
/** A region opens only when BOTH are true: enough partners fully trained, and the league before it beaten. */
export const regionsOpenV2 = (graduates: number, leagues: number): number =>
  Math.min(REGIONS.length, 1 + Math.min(Math.floor(graduates / GRADUATES_PER_REGION), leagues))

// ── version 3: stones ───────────────────────────────────────────────────────
// Evolution is never touched by any of this: a partner evolves by level, on
// its own. Stones are a rare extra, earned (never bought) and spent by hand in
// the Pokedex on things that change nothing about XP. Which stone you get is
// only its look: any stone does any of the three things. They come from every
// second gym, each Elite Four member, each Champion and every RARE_EVERY-th
// perfect day.
export const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'shiny-stone', 'dusk-stone', 'dawn-stone', 'ice-stone'] as const
export type Stone = (typeof STONES)[number]
/** A gym's stone is the one of whichever domain hit that leader hardest. */
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
 *  lead    bring a Pokemon from the Box forward as the partner now; the old one goes back to the Box, XP kept
 * Choosing who is NEXT (what: 'next') is free and needs no stone.
 */
export type StoneUse = 'mega' | 'branch' | 'lead'
export const MEGA_DAYS = 7

// ── version 3: trainer stats ────────────────────────────────────────────────
/** Stats are an average over this many days. */
export const STAT_DAYS = 28
/** Steps in a day that count as a full Speed day. */
export const STEPS_GOAL = 10000

// ── version 4: Mega for good ────────────────────────────────────────────────
/** The Key Stone comes with this many badges of the first league. */
export const KEY_STONE_BADGES = 8

// ── version 4: a nature at graduation ──────────────────────────────────────
// What a partner was raised on, kept for good: the domain it did best in is
// the stat its nature raises, the one it did worst in is the stat it lowers.
// The real table of twenty-five. Same pairing of stat and domain as the
// trainer's own six numbers (Speed is the chores until steps are measured).
export const NATURE_STATS = ['atk', 'def', 'spe', 'spa', 'spd'] as const
export type NatureStat = (typeof NATURE_STATS)[number]
export const NATURE_DOMAIN: Record<NatureStat, Tag> = { atk: 'fitness', def: 'arbor', spe: 'routine', spa: 'code', spd: 'guitar' }
/** NATURES[raised][lowered]; the diagonal is the five that change nothing. */
export const NATURES: Record<NatureStat, Record<NatureStat, string>> = {
  atk: { atk: 'Hardy', def: 'Lonely', spe: 'Brave', spa: 'Adamant', spd: 'Naughty' },
  def: { atk: 'Bold', def: 'Docile', spe: 'Relaxed', spa: 'Impish', spd: 'Lax' },
  spe: { atk: 'Timid', def: 'Hasty', spe: 'Serious', spa: 'Jolly', spd: 'Naive' },
  spa: { atk: 'Modest', def: 'Mild', spe: 'Quiet', spa: 'Bashful', spd: 'Rash' },
  spd: { atk: 'Calm', def: 'Gentle', spe: 'Sassy', spa: 'Careful', spd: 'Quirky' },
}

// ── version 5: something to earn, and something to do with it ──────────────
// Work is still the only source of anything. Coins come one for each XP of
// the day's work (before momentum); gems come from milestones. Neither buys
// XP or levels: they touch catching, bond, the team and how things look.
/** A softer curve than version 3's square: an ordinary day is not punished as hard. */
export const wildHit5 = (share: number, ball: number): number => Math.round(100 * Math.pow(share, 1.5) * ball)

export type ShopItem = 'great-ball' | 'ultra-ball' | 'berry' | 'incense' | 'rare-egg' | 'theme-beach' | 'theme-cave' | 'theme-night'
export interface ShopEntry { name: string; coins?: number; gems?: number; text: string; once?: true }
export const SHOP: Record<ShopItem, ShopEntry> = {
  'great-ball': { name: 'Great Ball', coins: 150, text: 'Throw it at the wild Pokemon: 80 HP at once.' },
  'ultra-ball': { name: 'Ultra Ball', coins: 350, text: 'Throw it at the wild Pokemon: 200 HP at once.' },
  berry: { name: 'Berry', coins: 60, text: 'Feed your partner: one heart. Hearts are never lost.' },
  incense: { name: 'Incense', gems: 40, text: 'Choose the next wild Pokemon from three.' },
  'rare-egg': { name: 'Rare Egg', gems: 150, text: 'Hatches into a rare Pokemon after five days with two pillars.' },
  'theme-beach': { name: 'Beach', gems: 60, text: 'A new place for the battle scene.', once: true },
  'theme-cave': { name: 'Cave', gems: 60, text: 'A new place for the battle scene.', once: true },
  'theme-night': { name: 'Starry night', gems: 60, text: 'A new place for the battle scene.', once: true },
}
export const isShopItem = (x: string): x is ShopItem => x in SHOP
/** HP a thrown ball takes off the wild Pokemon. */
export const THROW_HP: Partial<Record<ShopItem, number>> = { 'great-ball': 80, 'ultra-ball': 200 }
export const THEMES = ['theme-beach', 'theme-cave', 'theme-night'] as const

/** Gems for the things that happen by themselves. */
export const GEMS = { catch: 3, shiny: 20, evolve: 10, gym: 20, elite: 30, league: 50, graduate: 15, transfer: 5 } as const

/** Hearts at which a partner's bond steps up a level. */
export const HEART_LEVELS = [10, 30, 60] as const
export const bondLevel = (hearts: number): number => HEART_LEVELS.filter((n) => hearts >= n).length

export const TEAM_SIZE = 3
/** Each team member whose type beats the leader's adds this much to every strike. */
export const TEAM_BONUS = 0.1

export interface QuestDef { id: string; name: string; coins?: number; gems?: number }
export const DAILY_QUESTS: QuestDef[] = [
  { id: 'two-pillars', name: 'Finish two pillars', coins: 40 },
  { id: 'all-pillars', name: 'Finish every pillar', coins: 80 },
  { id: 'chores', name: 'Four-fifths of the chores', coins: 40 },
  { id: 'perfect', name: 'A perfect day', gems: 5 },
]
export const WEEK_XP = 2000
export const WEEK_DAYS = 5
export const WEEKLY_QUESTS: QuestDef[] = [
  { id: 'five-days', name: `${WEEK_DAYS} days with two pillars`, gems: 15 },
  { id: 'week-xp', name: `${WEEK_XP.toLocaleString('en-IN')} XP of work`, coins: 300 },
  { id: 'catch', name: 'Catch a Pokemon', gems: 10 },
]

// ── version 5: the season, and eggs ─────────────────────────────────────────
// The season is a ladder climbed by the month's work: every SEASON_STEP XP of
// work is a step, and each step hands something over by itself. It starts
// again each calendar month; nothing already handed over is taken back.
export const SEASON_STEP = 1500
export interface SeasonReward { coins?: number; gems?: number; item?: ShopItem }
export const SEASON_REWARDS: SeasonReward[] = [{ coins: 100 }, { item: 'great-ball' }, { gems: 10 }, { item: 'berry' }, { coins: 200 }, { item: 'ultra-ball' }, { gems: 25 }]
export const seasonReward = (step: number): SeasonReward => SEASON_REWARDS[(step - 1) % SEASON_REWARDS.length]
/** A Rare Egg hatches after this many days with two pillars. One is kept warm at a time. */
export const EGG_DAYS = 5
