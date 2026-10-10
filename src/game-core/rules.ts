// GAME CORE — shared by Pokedex and Life OS.
// Source of truth lives in the pokedex repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.
//
// Every number that shapes the game is in this file (the shops and prices are
// in economy.ts). There is one ruleset: version 8. The older versions were
// removed when the game was restarted from a clean fold on 2026-10-09; the last
// commit that still carries them is the git tag `pre-v8`.

/** Days before this are not part of the game. */
export const GAME_START = '2026-10-03'
/** The first day stakes apply. Two weeks of play first, so the numbers can be checked against real days. */
export const STAKES_FROM = '2026-10-23'

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
/** A measured night at this score or more pays two Bells instead of one. */
export const SLEEP_DEEP = 90

/** Habits that open into a block of items and pay for the share that was done. */
export const ARBOR_HABIT = 'arbor-morning'
export const GUITAR_HABIT = 'woodshed-guitar'
/** The month-end review is a tick of this id, filed under the first day of the month it closes. Each one pays a Comet Shard. */
export const REVIEW_HABIT = 'month-review'

/** A tick counts if it was made by the end of the day after the one it belongs to. */
export const GRACE_DAYS = 1

// ── momentum ────────────────────────────────────────────────────────────────
/** A day "counts" when this many pillars were done (or all of them, if there are fewer). */
export const PILLARS_FOR_A_DAY = 2
export const MOMENTUM_WINDOW = 7
/** Multiplier from how many of the previous seven days counted. Never resets, only slides. */
export const momentumMult = (days: number): number => (days >= 7 ? 1.5 : days >= 5 ? 1.35 : days >= 3 ? 1.2 : 1)
/** Two days running with no pillar and the partner dozes off. */
export const SLEEP_AFTER = 2

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
/** Each pair of graduates opens the next region, once the league before it is beaten. */
export const GRADUATES_PER_REGION = 2
export const regionsOpen = (graduates: number, leagues: number): number =>
  Math.min(REGIONS.length, 1 + Math.min(Math.floor(graduates / GRADUATES_PER_REGION), leagues))
/** Odds of an ordinary catch or egg: common / uncommon / rare. */
export const CATCH_WEIGHTS = { C: 65, U: 30, R: 5 } as const
/** Every Nth wild Pokemon to appear is a legendary. */
export const LEGENDARY_EVERY_WILD = 25

export type Rarity = 'C' | 'U' | 'R' | 'L'
export const WILD_HP: Record<Rarity, number> = { C: 700, U: 1100, R: 1600, L: 3000 }
/**
 * What a day does to the wild Pokemon: 100 x (share of the day's habits ticked)^1.5 x the ball.
 * Showing up catches, so a day of chores wears it down even when no pillar was done.
 */
export const wildHit = (share: number, ball: number): number => Math.round(100 * Math.pow(share, 1.5) * ball)
/** The ball comes from the chores: the share of routine habits done. */
export type Ball = 'poke' | 'great' | 'ultra'
export const BALL_MULT: Record<Ball, number> = { poke: 1, great: 1.25, ultra: 1.5 }
export const BALL_NAME: Record<Ball, string> = { poke: 'Poke Ball', great: 'Great Ball', ultra: 'Ultra Ball' }
export const ballFor = (routineShare: number): Ball => (routineShare >= 0.8 ? 'ultra' : routineShare >= 0.5 ? 'great' : 'poke')
/** A perfect day catches the wild Pokemon on the spot, and that catch is shiny one time in this many. */
export const SHINY_ODDS = 10
/** A catch made by wearing the wild Pokemon down is shiny one time in this many (a Lucky Egg halves it). */
export const SHINY_ODDS_WORN = 50

// ── gym leaders ─────────────────────────────────────────────────────────────
// Each day deals the day's work to the current leader, with the domains that
// leader is weak to counting extra. HP carries over: no weeks, no thresholds.
export const LEADER_HP = 2000
export const WEAK_MULT = 1.5
/** If the partner's type is super effective against the leader's, everything hits this much harder. */
export const ADVANTAGE_MULT = 1.2
/** A party of six: the partner and up to this many fully trained Pokemon standing behind it. Each whose type beats the leader's adds TEAM_BONUS to every strike. */
export const TEAM_SIZE = 5
export const TEAM_BONUS = 0.05
/** A partner with a Mega registered strikes this much harder. */
export const MEGA_MULT = 1.1

// ── trainer stats ───────────────────────────────────────────────────────────
/** Stats are an average over this many days. */
export const STAT_DAYS = 28
/** Steps in a day that count as a full Speed day. */
export const STEPS_GOAL = 10000

// ── a nature at graduation ──────────────────────────────────────────────────
// What a partner was raised on, kept for good: the domain it did best in is
// the stat its nature raises, the one it did worst in is the stat it lowers.
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

// ── gems, bond, quests, season, eggs ────────────────────────────────────────
/** Gems for the things that happen by themselves. */
export const GEMS = { catch: 3, shiny: 20, evolve: 10, gym: 20, elite: 30, league: 50, graduate: 15 } as const

/** Hearts at which a partner's bond steps up a level. Hearts only ever count up. */
export const HEART_LEVELS = [10, 30, 60] as const
export const bondLevel = (hearts: number): number => HEART_LEVELS.filter((n) => hearts >= n).length

/** Coins for showing up: by the share of the day's habits ticked, the best bar reached. */
export const DAILY_PAY: { share: number; coins: number }[] = [{ share: 0.5, coins: 20 }, { share: 0.75, coins: 45 }, { share: 1, coins: 80 }]
export const WEEK_XP = 2000
export const WEEK_DAYS = 5
/** Every SEASON_STEP XP of the month's work is a step on the season ladder. */
export const SEASON_STEP = 1500
/** A Rare Egg hatches after this many days with two pillars. One is kept warm at a time. */
export const EGG_DAYS = 5

// ── stakes (from STAKES_FROM) ───────────────────────────────────────────────
// A day with nothing ticked at all costs something, but only what is still in
// progress: the wild Pokemon, the leader, and part of the level the partner is
// working on. Anything finished (a level, an evolution, a trained or caught
// Pokemon, a badge, an item) is never taken back.
/** Days a wild Pokemon stays before it flees, by rarity. A fled one is seen, never caught. */
export const WILD_STAY: Record<Rarity, number> = { C: 21, U: 21, R: 28, L: 42 }
/** Max Repel adds this many days to the wild Pokemon's stay. One per Pokemon. */
export const REPEL_DAYS = 7
/** What one empty day gives back: HP to the leader, HP to the wild Pokemon, and the share of the XP into the current level the partner loses. */
export const SLIP = { leader: 100, wild: 60, xp: 0.1 } as const
