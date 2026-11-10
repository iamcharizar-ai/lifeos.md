// GAME CORE — shared by Pokedex and Life OS.
// Source of truth lives in the pokedex repo (core/); `npm run core` copies it
// into Life OS. Pure TypeScript, no DOM, no dependencies.
//
// Every number that shapes the game is in this file (the shops and prices are
// in economy.ts, the Battle Frontier in frontier.ts). The ruleset is version 9
// (RULES-V9.md) with version 13 laid over it from V13_START (RULES-V13.md) and version 14 from V14_START (RULES-V14.md):
// days before that fold exactly as they did. Version 8 and the older ones were
// replaced on 2026-10-12; the last commit that still carries them is `pre-v9`.

/** Days before this are not part of the game. */
export const GAME_START = '2026-10-03'
/** The first day stakes apply: brought forward from 23 Oct to 12 Oct 2026. Never earlier than a day already lived, or old empty days would be punished after the fact. */
export const STAKES_FROM = '2026-10-12'

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
/** A measured night with this many minutes of deep sleep pays a Bell of its own, on top of the score's, from DEEP_SLEEP_FROM. */
export const DEEP_SLEEP_MIN = 90
export const DEEP_SLEEP_FROM = '2026-10-22'

/** Habits that open into a block of items and pay for the share that was done. */
export const ARBOR_HABIT = 'arbor-morning'
export const GUITAR_HABIT = 'woodshed-guitar'
/** The month-end review is a tick of this id, filed under the first day of the month it closes. Each one pays a Comet Shard. */
export const REVIEW_HABIT = 'month-review'

/** A tick counts if it was made by the end of the day after the one it belongs to. */
export const GRACE_DAYS = 1
/** A reward nobody collects pays itself into the wallet this many days after it was earned. The Collect strip shows them until then. */
export const CLAIM_AUTO = 3


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
/** The ball is how full the day was: the share of the day's habits ticked, the same share that wears the wild Pokemon down. */
export type Ball = 'poke' | 'great' | 'ultra'
export const BALL_MULT: Record<Ball, number> = { poke: 1, great: 1.3, ultra: 1.6 }
export const BALL_NAME: Record<Ball, string> = { poke: 'Poke Ball', great: 'Great Ball', ultra: 'Ultra Ball' }
export const ballFor = (share: number): Ball => (share >= 0.8 ? 'ultra' : share >= 0.5 ? 'great' : 'poke')
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
/**
 * A party of six: the partner and up to this many fully trained Pokemon standing behind it. Every strike gets +TEAM_BONUS for each of them, and
 * +TEAM_NATURE more on the kind of work that member's nature raised. All the strike bonuses are added together, then applied once.
 */
export const TEAM_SIZE = 5
/** In a `team` event's list, this stands for a place left open on purpose: it is not filled from the lab by the fold (the app fills it after an hour). A list with no hole still fills its empty places as it always did. */
export const TEAM_HOLE = '-'
/**
 * From this day any Pokemon you own can stand on the team, not only a fully trained one, and a place nobody chose fills itself with the oldest in
 * My Pokemon. Only the fully trained ones count towards the boss's party of six (the rest still add to every strike). Earlier days fold as they always did.
 */
export const TEAM_OPEN_FROM = '2026-10-14'
export const TEAM_BONUS = 0.02
export const TEAM_NATURE = 0.03
/** A partner with a Mega registered adds this to every strike. */
export const MEGA_BONUS = 0.1

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
/**
 * Strong's training kit: each full set of its seven pieces pays gems and Iron, and every KIT_SHARD_EVERY-th set a Red Shard on top.
 * (Version 11: the kit used to pay a shard every set with no limit, which made Mega Stones far too easy to come by.)
 */
export const KIT_SHARD_EVERY = 3
export const KIT_IRON = 3
export const GEMS = { catch: 3, shiny: 20, evolve: 10, gym: 20, elite: 30, league: 50, graduate: 15, perfect: 5, kit: 10 } as const

/** Hearts at which a partner's bond steps up a level. Hearts only ever count up. (Version 13 added the 100 and 150 levels; the first three are as they always were.) */
export const HEART_LEVELS = [10, 30, 60, 100, 150] as const
export const bondLevel = (hearts: number): number => HEART_LEVELS.filter((n) => hearts >= n).length

/** Coins for showing up: by the share of the day's habits ticked, the best bar reached. (Version 9 folded the daily quests, which paid for the same days, into these.) */
/** A second day running at or above `share` ticked adds this to the showing-up pay. */
export const PAY_STREAK = { share: 0.75, coins: 20 } as const
/** Gems with the Comet Shard for a month-end review. */
export const REVIEW_GEMS = 10
export const DAILY_PAY: { share: number; coins: number }[] = [{ share: 0.5, coins: 40 }, { share: 0.75, coins: 90 }, { share: 1, coins: 140 }]
export const WEEK_DAYS = 5
/** Every SEASON_STEP XP of the month's work is a step on the season ladder. */
export const SEASON_STEP = 1500
/** A Rare Egg is five days' walking: its steps count, at most STEPS_GOAL a day, and a day with no band reading adds nothing. One is kept warm at a time. */
export const EGG_DAYS = 5
export const EGG_STEPS = EGG_DAYS * STEPS_GOAL
// (Version 12: an egg used to be warmed by days with two pillars, and the Box was refilled with a made-up "egg" when it ran empty;
// now it is warmed by steps, a beaten boss can drop one, and a new partner from an empty Box is simply a new starter.)

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

// ── version 13: Champion's Road (RULES-V13.md) ──────────────────────────────
/** The first day of version 13. Everything below applies from this day; earlier days fold as they always did. */
export const V13_START = '2026-10-15'

/** A leader's HP: 2,000, plus 15% for every league further on, ×1.25 for the Elite Four and ×1.6 for a Champion, and +60% for every Rematch rank above the first. */
export const LEAGUE_STEP = 0.15
export const ELITE_MULT = 1.25
export const CHAMPION_MULT = 1.6
export const RANK_STEP = 0.6
export const leaderHp = (league: number, kind: 'gym' | 'elite' | 'champion', lap: number): number =>
  Math.round((LEADER_HP * (1 + LEAGUE_STEP * league) * (kind === 'champion' ? CHAMPION_MULT : kind === 'elite' ? ELITE_MULT : 1) * (1 + RANK_STEP * lap)) / 50) * 50

/** Every level of the partner adds this to every strike. */
export const LEVEL_POWER = 0.01
/** Every level of a party member adds this to every strike, on top of TEAM_BONUS. */
export const TEAM_LEVEL = 0.002
/** A forged Mega Stone: MEGA_BONUS, and this much more for each bond level. A Mega for the day (no stone) adds MEGA_DAY. */
export const MEGA_BOND = 0.05
export const MEGA_DAY = 0.1

/** What each bond level unlocks (HEART_LEVELS says how many hearts each takes). */
export const BOND_PERKS = ['pickup', 'endure', 'focus', 'friends', 'share'] as const
export type BondPerk = (typeof BOND_PERKS)[number]
export const hasPerk = (bond: number, perk: BondPerk): boolean => bond >= BOND_PERKS.indexOf(perk) + 1
/** Pickup: the chance of a find on a day with a pillar, at bond 1, and what each level above adds. */
export const PICKUP_BASE = 0.3
export const PICKUP_STEP = 0.1
/** Endure forgives one empty day in this many. */
export const ENDURE_DAYS = 7
/** Focus: the chance of a critical day, and what a critical hit does to the strike. */
export const CRIT_BASE = 0.12
export const CRIT_MULT = 1.5
/** Best friends: XP ×this. Exp. Share: each party member still being raised gets this share of the partner's XP. */
export const FRIENDS_XP = 1.1
export const SHARE_XP = 0.1
/** A perfect day Dynamaxes the partner: its strike ×DYNAMAX, ×GIGANTAMAX when the partner has a Gigantamax form. */
export const DYNAMAX = 2
export const GIGANTAMAX = 2.5

// ── version 14: every item asks a question (RULES-V14.md) ───────────────────
/** The first day of version 14. Earlier days fold as they always did. */
export const V14_START = '2026-10-19'
/** Hearts stop counting at the last bond level: a berry is refused once a Pokemon has this many, so none is thrown away. */
export const HEART_CAP = HEART_LEVELS[HEART_LEVELS.length - 1]

// ── version 14: the party fights, the Professor researches (RULES-V14.md section 4) ──
/** No Pokemon goes past this level. Fully trained (graduateAt) is still the milestone; after it a Pokemon can go on to this. */
export const MAX_LEVEL = 100
/** The Professor studies up to this many of your Pokemon at a time: the research desk. Nobody in the party can be on it. */
export const RESEARCH_SLOTS = 3
/** What a Pokemon on the desk adds to the day's research: (RESEARCH_BASE + its level) × its rarity's weight, a shiny half again. */
export const RESEARCH_BASE = 10
export const RESEARCH_RARITY: Record<Rarity, number> = { C: 1, U: 1.5, R: 2, L: 3 }
export const RESEARCH_SHINY = 1.5
export const studyPoints = (level: number, rarity: Rarity, shiny: boolean): number => Math.round((RESEARCH_BASE + level) * RESEARCH_RARITY[rarity] * (shiny ? RESEARCH_SHINY : 1))
/** Research points the next rank takes, from rank `rank`. */
export const researchCost = (rank: number): number => 500 * (rank + 1)
/** Each research rank takes this share off every wild Pokemon's HP when it appears, up to RESEARCH_WILD_MAX. */
export const RESEARCH_WILD = 0.03
export const RESEARCH_WILD_MAX = 0.45
export const researchCut = (rank: number): number => Math.min(RESEARCH_WILD_MAX, RESEARCH_WILD * rank)

// ── version 15: the first weeks of play, read back (AUDIT-2026-10-27.md) ───
/** The first day of version 15. Earlier days fold as they always did. */
export const V15_START = '2026-10-27'
/** From version 15, the party studies too, at this share of a desk place, so research starts with a small collection. */
export const RESEARCH_PARTY = 0.5
/** From version 15, every this many levels the partner reaches is a milestone: a choice of two rewards waits in Collect. */
export const MILESTONE_EVERY = 5

// ── version 16: bonds that travel (RULES-V16.md; the numbers are in bond.ts) ──
/** The first day of version 16. Earlier days fold as they always did. */
export const V16_START = '2026-10-27'

// ── version 17: the day's list is the live list ──
/**
 * The first day of version 17. Before it a day's habit list was frozen at its first writing (a later one could only add habits, so a
 * missed habit could not be edited out of today). From it the latest list written for a day stands: what Life OS shows is what the
 * game counts, at once. Earlier days fold as they always did.
 */
export const V17_START = '2026-10-27'

// ── version 18: the game follows Life OS ──
/**
 * The first day of version 18. A kind of work with no habit on the Life OS list (the Woodshed habit archived, say) is shelved: the game
 * hides its shop, feats and Frontier facility, and the boss leaves its task off the card. Put the habit back and it all returns, with
 * nothing lost. Earlier days fold as they always did.
 */
export const V18_START = '2026-11-02'

// ── version 19: eggs ──
/**
 * The first day of version 19 (RULES-V19.md). Eggs come in kinds, a Trail Egg is found by walking, and an egg's steps are no longer
 * cut at STEPS_GOAL a day. An egg put in the Nursery before this day keeps the old size and the old cut; days before it fold as they did.
 */
export const V19_START = '2026-11-04'
/** Walking finds a Trail Egg every this many steps (all the steps the band counts, from V19_START). */
export const TRAIL_EGG_STEPS = 100000

// ── version 20: the Professor's desk counts the day it is set ──
/**
 * The first day of version 20 (RULES-V20.md). From it the day's research is added after the day's own actions, so a Pokemon put on
 * the desk today studies today (before, the desk was read before the day's taps and a change counted from the next day). Earlier days
 * fold as they did.
 */
export const V20_START = '2026-11-05'

// ── version 21: effort tiers (GAME_REDESIGN.md v3) ──
/**
 * The first day of version 21 (RULES-V21.md), the day it shipped. Earlier days fold as they always did.
 * A `let` so a test of an older rule can switch version 21 off for its own process (setV21Start); nothing else ever calls it.
 */
export let V21_START = '2026-11-05'
export const setV21Start = (day: string): void => { V21_START = day }
/**
 * A pillar with a verified source counts only when that source logged something that day (a tick alone is then a basic habit). Gym is
 * a Strong workout. A pillar not listed here is an honour tick. A later source (a LeetCode sync for Code, say) is one more entry here,
 * naming a count in DayMarks (core/facts.ts) that its reader fills in, the way core/strong.ts fills `workouts`.
 */
export const VERIFIED_BY: Partial<Record<Tag, 'workouts' | 'records' | 'clean' | 'owned'>> = { fitness: 'workouts' }
/** The effortful pillars: what a day's tier counts. Sleep is a bonus, chores the floor. */
export const EFFORT_TAGS: Tag[] = ['code', 'fitness', 'arbor', 'guitar']
/** A Max day: every effortful pillar on the list, and this share of the chores. */
export const MAX_DAY_CHORES = 0.75
/** By tier: 0 chores only, 1, 2, 3 (or more) effortful pillars, 4 a Max day. */
// XP rises only on 3-pillar and Max days: sliding momentum already pays ×1.5 for steady work, and a steeper XP curve made partners
// graduate faster than today (tools/sim-life.mjs: 9 fully trained in six months at normal pace against today's 7; this curve gives 8).
export const DAY_XP_MULT = [1, 1, 1, 1.1, 1.15]
export const DAY_HIT_MULT = [1, 1, 1.25, 1.5, 2] as const
export const DAY_HEARTS = [0, 1, 3, 6, 10] as const
export const DAY_RESEARCH = [0, 60, 140, 220, 300] as const
export const DAY_GEMS = [0, 0, 0, 2, 5] as const
export const DAY_COINS = [0, 60, 90, 140, 200] as const
/** A chores-only day's coins: the first bar its chores reach. */
export const CHORE_COINS: { share: number; coins: number }[] = [{ share: 0.75, coins: 60 }, { share: 0.5, coins: 40 }]
/** The first effortful pillar of a day pays this on top of its tier, so starting is worth it. */
export const FIRST_PILLAR = { hearts: 1, research: 40, gems: 2 }
/** A night of 80+ on a day with an effortful pillar: a heart, a share more research, and a Bell (two at SLEEP_DEEP). */
export const SLEEP_BONUS = { hearts: 1, research: 0.2 } as const
/** The neglect bounty: a pillar idle 2 days (or 3 and more) pays its own XP and counter ×this, the day it comes back. Doing it clears it. Kept under what the missed days were worth, so steady always earns more (tools/sim-life.mjs --bounty). */
// Tuned with tools/sim-life.mjs on V21 (5 Nov 2026): skipping a pillar and cashing in starts to beat steady between ×4 and ×5 on that
// pillar's counter (normal pace, two days skipped); at ×3 / ×4 steady still wins on every measure at every pace, by 3% at the thinnest.
export const BOUNTY = { two: 3, three: 4 }
export const bountyMult = (idle: number): number => (idle >= 3 ? BOUNTY.three : idle >= 2 ? BOUNTY.two : 1)
/** Sliding momentum: a day with this many effortful pillars moves it up a step, any other day down one, but for one free day a week. */
export const MOMENTUM_STEPS = [1, 1.2, 1.35, 1.5] as const
export const MOMENTUM_PILLARS = 2
/** The Lab: every rank costs the same, and each Pokemon on the desk adds a share of the day's research by its rarity. */
export const RANK_V21 = 1500
export const DESK_BONUS: Record<Rarity, number> = { C: 0.1, U: 0.15, R: 0.2, L: 0.3 }
/** Leaders' gems: a gym, an Elite Four member or a Champion, and what a league adds. */
export const LEADER_GEMS_V21 = { gym: 10, elite: 15, league: 25 } as const
/** A Mega is worth this per bond level of its Pokemon, and half of that from the party. */
export const MEGA_PER_BOND = 0.05
/** A second Pokemon of a line already yours turns into this many hearts for the one you have (a shiny is kept). */
export const DUPE_HEARTS = 20
/** Once the whole party is at the last bond level, every this many Trainer hearts is a Ribbon. */
export const RIBBON_EVERY = 150

// ── version 21.1: the screens and the rules agree again (AUDIT-2026-11-10.md) ──
/**
 * The first day of the fixes found on 10 Nov 2026, the day they shipped. Earlier days fold as they always did.
 * - A Rare Candy is for any Pokemon you own that still has a level to gain, the partner too (it had been "fully trained only",
 *   while the screens offered it only to those not fully trained: it could be used on nobody).
 * - Momentum is the seven days again (momentumWindow below): what the Life OS card draws, and one meaning of "a day that counts".
 * - Endure is read from version 21's own perk ladder (100 Trainer hearts), as its screen says.
 * A `let` so a test of version 21 as it first shipped can switch these off for its own process (setV21Fix).
 */
export let V21_FIX = '2026-11-10'
export const setV21Fix = (day: string): void => { V21_FIX = day }
/**
 * Momentum from V21_FIX: of the last seven days, how many counted (two pillars, and a good night can be one of them but never the
 * only one). The top step is six of seven, so one rest day a week does not cost it. The screens draw these steps, never their own.
 */
export const MOMENTUM_WINDOW_STEPS: [days: number, mult: number][] = [[3, 1.2], [5, 1.35], [6, 1.5]]
export const momentumWindow = (days: number): number => [...MOMENTUM_WINDOW_STEPS].reverse().find(([d]) => days >= d)?.[1] ?? 1
/** The steps of the seven-day rule before version 21 (momentumMult): the top was seven of seven. */
export const MOMENTUM_OLD_STEPS: [days: number, mult: number][] = [[3, 1.2], [5, 1.35], [7, 1.5]]
