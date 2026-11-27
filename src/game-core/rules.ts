// The rules as they were up to version 21.1 live in legacy/ and are frozen. This file is where the version 22 rules go (GAME-SPEC-V22.md).
// Until they are built it hands the old ones on unchanged, so every importer keeps working.
import type { Rarity } from './legacy/rules.ts'
export * from './legacy/rules.ts'

// ══ version 22 (GAME-SPEC-V22.md) ══════════════════════════════════════════════
// Built in steps; this is where its rules live. The live fold (core/fold.ts) is the engine, a copy of the frozen one in legacy/ with these
// rules switched on from V22_START. core/oracle.test.ts proves it folds every earlier day exactly as legacy/fold.ts does.
/** The first day of version 22: the day it deployed, 12 Nov 2026 (the owner approved it that morning). Days before it fold by the frozen rules. A `let` only so a test of the old rules can set it (setV22Start). */
export let V22_START = '2026-11-12'
export const setV22Start = (day: string): void => { V22_START = day }
export const v22On = (day: string): boolean => day >= V22_START

/**
 * Version 23 (MEGA-OVERHAUL-PLAN.md): Momentum is a ladder, one small step for each good day of the last seven, and the streak puts Mega Stones on its days.
 * It starts the day it deployed, 25 Nov 2026 (the owner asked for it that day); every earlier day folds exactly as before.
 * A `let` only so a test can set it.
 */
export let V23_START = '2026-11-25'
export const setV23Start = (day: string): void => { V23_START = day }
export const v23On = (day: string): boolean => day >= V23_START

/**
 * Scenes (core/places.ts): from this day a wild Pokemon turns up only in a place you own. The Meadow is free; every other place is a scene bought in the Rare
 * shop (the old Beach, Cave and Starry night scenes are gone from it), and the Bag's scene is either "rotating" (Today follows the wild Pokemon's place) or one
 * you lock, which changes only the look. It starts the day it deployed, 25 Nov 2026; the wild Pokemon already in front of you that day is the one it was.
 * Only while version 22 is on, so the older fixtures (which pin V22_START far ahead) fold as they always did. A `let` only so a test can set it.
 */
export let SCENES_START = '2026-11-25'
export const setScenesStart = (day: string): void => { SCENES_START = day }
export const scenesOn = (day: string): boolean => v22On(day) && day >= SCENES_START
/**
 * Hatch first: from this day an egg or fossil that the day's steps already finish hatches before the day's actions, so a Pokemon that hatched today can be
 * fed, put in the party or led the same day (before, those actions were taken before it existed and did nothing: Scyther, 27 Nov 2026). One that finishes
 * only because of something done today (an Old Charm bought) still hatches after the actions, as before. Starts the day it deployed; only while version 22
 * is on. A `let` only so a test can set it.
 */
export let HATCH_FIRST = '2026-11-27'
export const setHatchFirst = (day: string): void => { HATCH_FIRST = day }
export const hatchFirstOn = (day: string): boolean => v22On(day) && day >= HATCH_FIRST
/** The XP multiplier by the number of good days (two pillars) among the seven before today: every good day adds a little, the seventh is the leap. Tuned on the owner's real days: their pace averages x1.107, as today's steps do (x1.104). */
export const MOMENTUM_LADDER = [1, 1.02, 1.05, 1.12, 1.21, 1.33, 1.5, 2] as const
export const momentumLadder = (days: number): number => MOMENTUM_LADDER[Math.max(0, Math.min(MOMENTUM_LADDER.length - 1, Math.floor(days)))]
/** A good day carries a Mega Stone once the seven-day count, with it, has reached this: the streak is on. */
export const STONE_STREAK = 4
/** A Lab Pokemon in Mega form is worth this many times as much to the Lab that day (the party's own x2 is POWER_MEGA_X). */
export const LAB_MEGA_X = 2

// ── the day (spec sections 2 and 3) ──
/**
 * The wild Pokemon: every habit ticked takes one HP off, nothing multiplies it (3.3). Its HP is a fixed number of ticks by rarity, set from the owner's
 * real ledger (39 days, 14.8 ticks a day) so a catch takes as long as it did when the day hit for 100 x share^1.5 x ball: 0.267 ticks to a legacy HP.
 * (549 ticks against 2,059 HP over the days that were not perfect; then 10% off, because the simulator's catches a month at the real pace were 4.3 against 4.8.)
 * A busier player ticks more of the list, and the old curve paid them more than linear ticks do: at the 'normal' pace v22 catches 7.1 a month against 11.2. That is the cost of the rule "one tick, one HP".
 */
export const TICKS_PER_HP = 0.24
export const WILD_TICKS: Record<Rarity, number> = { C: 170, U: 260, R: 390, L: 720 }
/** What one empty day gives back to the wild Pokemon, in ticks (it was 60 HP). */
export const SLIP_WILD_TICKS = 16
/** The gym leader: each pillar done hits for this, or the weak one for more, times the day's tier (DAY_HIT_MULT) and (1 + party power) (3.4). First values: tuned in the simulator. */
export const PILLAR_HIT = 115
export const WEAK_HIT = 150
/**
 * Party power (5.3): for each of the six, level x POWER_LEVEL plus POWER_HEART for every bond level it has; doubled when its type beats the foe's, doubled again with a
 * Mega Stone, and the partner's share counted twice. The Trainer adds POWER_TRAINER for each Trainer level (every TRAINER_HEARTS hearts, no last level).
 */
export const POWER_LEVEL = 0.002
export const POWER_HEART = 0.01
export const POWER_TYPE_X = 2
export const POWER_MEGA_X = 2
export const POWER_PARTNER_X = 2
export const POWER_TRAINER = 0.02
/** The boss takes party power at this share: the same number as the leader's, damped so a week's card is as hard to beat as it was (tools/sim-life.mjs --rules v22). */
export const BOSS_POWER = 0.6
export const TRAINER_HEARTS = 100
export const trainerLevelV22 = (hearts: number): number => Math.floor(hearts / TRAINER_HEARTS)

// ── pillars: tracks and berries (spec section 4) ──
/** Seven pips fill a pillar's track; a full track is a prize in Collect, its shard or its egg, and it starts again. */
export const TRACK_LEN = 7
/** A berry fed to a Pokemon whose favourite it is (the berry of its first type's kind of work) gives this; any other berry of the six gives BERRY_PLAIN. */
export const BERRY_PLAIN = 2
export const BERRY_FAVOURITE = 5
/** The Lab (spec 5.4): a Pokemon is worth its level, LAB_FINAL more in its last form, half as much again when shiny; a day's research is the pillars done times (LAB_BASE + the Lab's strength). */
export const LAB_BASE = 20
export const LAB_FINAL = 10
export const LAB_SHINY = 1.5
