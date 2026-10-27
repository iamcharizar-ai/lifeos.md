// The whole game, as one pure function of the days so far.
//
// Nothing here is stored anywhere: partner, Box, collection, the wild Pokemon,
// the league and the Bag are recomputed from the day list every time, which is
// why two devices (and two apps) always show the same thing.
//
// A day's work does three different things:
//   how MUCH you did      → the partner's XP
//   how MANY habits you ticked → the wild Pokemon's HP (catching), and the ball it is thrown with
//   what KIND of work     → the gym leader's HP (the league)
// and a day with nothing ticked at all costs something small (see SLIP).
import type { DayFacts } from './facts.ts'
import { addDays } from './facts.ts'
import { LEAGUES, lineup, type Leader } from './gyms.ts'
import {
  ADVANTAGE_MULT, BALL_MULT, CATCH_WEIGHTS, DAILY_PAY, EGG_STEPS, GEMS, LEADER_HP, LEGENDARY_EVERY_WILD, MEGA_BONUS, MOMENTUM_WINDOW, NATURES, NATURE_DOMAIN, NATURE_STATS,
  CLAIM_AUTO, KIT_IRON, KIT_SHARD_EVERY, PAY_STREAK, PILLARS_FOR_A_DAY, REPEL_DAYS, SEASON_STEP, SHINY_ODDS, SHINY_ODDS_WORN, SLEEP_AFTER, SLEEP_DEEP, DEEP_SLEEP_MIN, DEEP_SLEEP_FROM, REVIEW_GEMS, SLEEP_HABIT, SLIP, STAKES_FROM, START_SPECIES, STAT_DAYS, STEPS_GOAL, TAGS,
  TEAM_BONUS, TEAM_NATURE, TEAM_OPEN_FROM, TEAM_SIZE, WEAK_MULT, WEEK_DAYS, WILD_HP, WILD_STAY, ballFor, bondLevel, evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, wildHit, xpForLevel,
  V13_START, V14_START, V15_START, RESEARCH_PARTY, MILESTONE_EVERY, HEART_CAP, MAX_LEVEL, RESEARCH_SLOTS, researchCost, researchCut, studyPoints, leaderHp, LEVEL_POWER, TEAM_LEVEL, MEGA_BOND, MEGA_DAY, hasPerk, PICKUP_BASE, PICKUP_STEP, ENDURE_DAYS, CRIT_BASE, CRIT_MULT, FRIENDS_XP, SHARE_XP, DYNAMAX, GIGANTAMAX,
  type Ball, type NatureStat, type Rarity, type Tag,
} from './rules.ts'
import { BOOST, COMET_SHARD, DIRE_HIT, EVO_ITEMS, FOSSILS, LEGEND_KEYS, PICKUP_TIERS, PLATES, PLATE_BONUS, REMATCH_KEYS, plateFor, REVIVE_COST, TREASURE, VITAMINS, VITAMIN_MAX, VITAMIN_STEP, forgeFair, legendFor, milestoneOptions, pickupFind, researchReward, type Option } from './economy.ts'
import { FACILITIES, GOLD_BP, GOLD_GEMS, REMATCH_BP, SILVER_BP, SILVER_GEMS, bpFor } from './frontier.ts'
import {
  BOSS_CATCH_GEMS, BOSS_HEAL, BOSS_HP_PER_LEVEL, BOSS_KILL_GEMS, BOSS_MILESTONES, BOSS_SHINY, BOSS_TAG, BOSS_TASK_COINS, BOSS_TASK_MARKS, KILL_CAP, THROWS, THROW_AT, TYPE_EDGE,
  cardDone, cardWork, catchChance, strikeOf, type BossCard, type BossTask, type Member,
} from './boss.ts'
import { SPECIES, type SpeciesRec } from './species.ts'
import {
  AMULET_MULT, BALLS, BERRY_HEARTS, PARTY_VITAMIN, treasurePrice, MARKS, BOND_PARTY, BOND_STEP, CHEST, EGG_STEPS_OLD_CHARM, FEATS, FORGE_COST, GEAR, GEAR_ITEMS, HELD, LURES, MARK_OWNED, MARK_RECORD, MARK_TAGS, MASTERY_MAX, MASTERY_STEP, ONCE, SELL,
  STANDING, TM_SLOTS, WEEKLY_QUESTS, ballClass, dayGap, dealsFor, forgeShard, heldBonus, heldCommon, isMarkTag, lureTypes, martDeals, masteryCost, offerFor, rng, seasonReward, throwHp, tmType,
  type MarkTag, type Offer, type Reward, type ShopId,
} from './economy.ts'
import { beats, weakDomains } from './types.ts'

type Share = Record<Tag, { got: number; max: number }>
const emptyShare = (): Share => Object.fromEntries(TAGS.map((t) => [t, { got: 0, max: 0 }])) as Share
const ratio = (s: Share, t: Tag): number => (s[t].max > 0 ? s[t].got / s[t].max : 0)

export interface Mon {
  uid: string
  /** first stage of its line */
  base: string
  /** what it is right now */
  form: string
  xp: number
  shiny: boolean
  origin: 'starter' | 'catch' | 'egg' | 'fossil'
  /** day it was caught or hatched */
  from: string
  /** day it became the partner */
  started?: string
  graduated?: string
  /** days it was the partner on which at least one pillar was done. Only ever counts up */
  together?: number
  /** every form it has been, oldest first */
  path: string[]
  /** how it will evolve, when that was chosen by hand */
  pick?: string
  /** Mega forms it has registered for good (forged) */
  megas?: string[]
  /** which form to draw once it has one registered: 'base', or one of `megas`. Absent = the first Mega */
  show?: string
  /** the ball it was caught in: the chores of that day */
  ball?: Ball
  /** hearts beyond the days together: berries and treats fed, and (version 13) every pillar after the first on a day as partner. With `together` they are its hearts, and hearts only ever count up */
  fed?: number
  /** given when it finished training, from what it was raised on */
  nature?: { name: string; up?: Tag; down?: Tag }
  /** the one item it holds (partner only), the TMs equipped, and the exact ball it was thrown with */
  held?: string
  moves?: string[]
  thrown?: string
  /** vitamins given to it (version 13): each one makes that domain's work strike harder, for good */
  vits?: Partial<Record<MarkTag, number>>
}

export type Moment =
  | { kind: 'level'; day: string; uid: string; form: string; level: number }
  | { kind: 'evolve'; day: string; uid: string; from: string; form: string; tag?: string; picked?: true }
  | { kind: 'graduate'; day: string; uid: string; form: string }
  | { kind: 'partner'; day: string; uid: string; form: string; origin: Mon['origin'] }
  /** `how`: 'perfect' = caught on the spot by a perfect day; 'worn' = its HP ran out; 'ball' = a thrown ball finished it */
  | { kind: 'catch'; day: string; uid: string; form: string; shiny: boolean; n: number; how: 'perfect' | 'worn' | 'ball' }
  | { kind: 'appear'; day: string; form: string; rarity: Rarity }
  | { kind: 'form'; day: string; uid: string; form: string; what: 'mega' | 'gmax' }
  | { kind: 'region'; day: string; n: number }
  /** `league` indexes LEAGUES; `slot` indexes that league's lineup (gyms, then Elite Four, then Champion) */
  | { kind: 'gym'; day: string; league: number; slot: number }
  | { kind: 'league'; day: string; league: number }
  | { kind: 'use'; day: string; uid: string; form: string; what: 'branch' | 'lead'; to?: string }
  | { kind: 'key'; day: string }
  | { kind: 'mega'; day: string; uid: string; form: string }
  /** a Pokemon sent to the Professor */
  | { kind: 'transfer'; day: string; form: string; coins: number }
  /** a feat reached, and what it paid. `items` are item ids */
  | { kind: 'feat'; day: string; id: string; name: string; coins: number; gems: number; items: string[] }
  | { kind: 'quest'; day: string; id: string; name: string; coins: number; gems: number }
  | { kind: 'season'; day: string; step: number; coins: number; gems: number; item: string }
  | { kind: 'hatch'; day: string; uid: string; form: string }
  /** `n` counts chests opened for life, so each one is told apart */
  | { kind: 'chest'; day: string; n: number; coins: number; item: string; count: number }
  /** a wild Pokemon stayed its days and got away */
  | { kind: 'flee'; day: string; form: string; rarity: Rarity }
  /** a day with nothing ticked at all, and what it cost (told on the day it was settled, two days later) */
  | { kind: 'slip'; day: string; empty: string; leader: number; wild: number; xp: number }
  /** the weekly boss: it appeared, was killed, was caught (or a throw missed: `n` is which throw), or left */
  | { kind: 'boss'; day: string; week: string; form: string; level: number; what: 'appear' | 'kill' | 'catch' | 'miss' | 'left'; n?: number; shiny?: boolean; uid?: string }
  /** a month-end review was done and paid a Comet Shard; `n` counts reviews for life */
  | { kind: 'review'; day: string; n: number }
  /** a Strong workout dropped a piece of training gear, and a full set of seven turned into a Red Shard (`n` counts sets for life) */
  | { kind: 'gear'; day: string; item: string }
  | { kind: 'kit'; day: string; n: number; shard: boolean }
  // version 13
  /** the partner found something on the day's walk (bond level 1) */
  | { kind: 'pickup'; day: string; item: string; form: string }
  /** an empty day that cost nothing: the bond held (Endure), the Focus Sash, or a Guard Spec */
  | { kind: 'endure'; day: string; empty: string; how: 'endure' | 'sash' | 'guard' }
  /** a Battle Frontier symbol */
  | { kind: 'symbol'; day: string; facility: string; tier: 'silver' | 'gold' }
  /** a Legend key was used: this legend comes next */
  | { kind: 'summon'; day: string; key: string; form: string }
  /** the Lab brought a fossil back */
  | { kind: 'fossil'; day: string; uid: string; form: string; item: string }
  /** an evolution item used on a Pokemon in My Pokemon */
  | { kind: 'itemevo'; day: string; uid: string; from: string; form: string; item: string }
  /** every league beaten again: the next Rematch rank begins (`lap` 1 is rank two) */
  | { kind: 'lap'; day: string; lap: number }
  /** version 14: the Professor's research reached a rank; a Pokemon reached the last level and stepped aside */
  | { kind: 'research'; day: string; rank: number }
  | { kind: 'master'; day: string; uid: string; form: string }

export interface DayResult {
  day: string
  /** XP before the multiplier */
  base: number
  mult: number
  xp: number
  pillars: number
  pillarTotal: number
  /** habits ticked, and habits there were (not counting last night's measured sleep) */
  done: number
  total: number
  /** enough pillars to count toward momentum */
  counts: boolean
  perfect: boolean
  /** share of the day's XP done, 0..1 */
  share: number
  /** share of the day's habits ticked, 0..1: what wears the wild Pokemon down */
  ticked: number
  ball: Ball
  /** what the day did to the wild Pokemon, and to the gym leader */
  hit: number
  strike: number
  /** coins for showing up */
  pay: number
  /** version 13: a critical hit on the leader, the partner Dynamaxed, today's X item boosts, and what Pickup found */
  crit?: boolean
  max?: 'dynamax' | 'gigantamax'
  boost?: Partial<Record<Tag, number>>
  find?: string
}

export interface DexEntry {
  /** first day it stood in front of you, or was yours */
  first: string
  /** day it first became yours (caught, hatched, or evolved into). Absent = seen only */
  own?: string
  shiny?: true
}

/** The Pokemon in front of you. It stays until it is caught (or, once stakes apply, until it flees). */
export interface Wild {
  form: string
  rarity: Rarity
  hp: number
  max: number
  /** day it appeared */
  from: string
  shiny: boolean
  /** it was caught today (so `hp` is 0 and the next one appears tomorrow) */
  caught: boolean
  /** a Max Repel was used on it (days added to its stay), and days left before it flees (0 = gone by tomorrow) */
  repel?: number
  leavesIn?: number
}

/** Where the trainer stands in the leagues. `index` runs past the end of LEAGUES when every one is beaten. */
export interface LeagueState {
  index: number
  /** who is up, as an index into that league's lineup */
  slot: number
  hp: number
  max: number
  /** the domains the current leader is weak to */
  weak: Tag[]
  /** the partner's type is super effective against the current leader */
  edge: boolean
  /** this league's region is not open yet, so its leaders wait */
  waiting: boolean
  /** regional leagues beaten (the ones that open the next region) */
  beaten: number
  /** HP this leader won back on empty days, which a Revive takes off again */
  slipped: number
  /** Rematch laps finished: 0 on the first journey, 1 once every league has been beaten (the rank shown is lap + 1) */
  lap: number
}

export interface HallEntry {
  league: number
  /** the Rematch lap it was won on (0 the first time) */
  lap?: number
  day: string
  partner: { form: string; shiny: boolean }
  /** up to five of the most recently fully trained, newest first */
  team: { form: string; shiny: boolean }[]
  stats: Stats
}

/** 0-100 each, an average over the last STAT_DAYS days. null = nothing to measure it with yet. */
export interface Stats {
  hp: number | null
  atk: number | null
  def: number | null
  spa: number | null
  spd: number | null
  spe: number | null
}

/** Everything that adds to a strike, as fractions (0.1 = +10%). They are added, then applied once. */
export interface Power {
  /** +TEAM_BONUS for each member of the team */
  team: number
  /** bond level */
  bond: number
  /** a registered Mega */
  mega: number
  /** an item with no domain of its own (the Life Orb) */
  item: number
  /** version 13: the partner's level */
  level: number
  /** on each kind of work only: its held item, its mastery level, the team members whose nature raised it, and the partner's vitamins */
  domain: Record<Tag, { held: number; mastery: number; nature: number; vitamin: number }>
}

/** One Battle Frontier facility's run, as the screens show it. */
export interface FrontierRun { id: string; cur: number; best: number; wins: number; silver: string | null; gold: string | null }

export interface Quest { id: string; name: string; coins: number; gems: number; done: boolean; have: number; need: number }

/** Each domain in its own unit. Feats read these. */
export interface Notes {
  /** days the code pillar was done */
  codeDays: number
  /** days the morning block was done in full */
  arborDays: number
  /** days the guitar session was done in full */
  guitarDays: number
  workouts: number
  records: number
  clean: number
  owned: number
  /** steps, at most STEPS_GOAL a day, and the days that had a reading */
  steps: number
  stepDays: number
}

/** A reward earned and waiting to be collected. Counted in the wallet only once claimed (or after CLAIM_AUTO days). */
export interface Held { key: string; day: string; title: string; coins: number; gems: number; items: [string, number][]; /** version 15: a choice of two; claimed with the one chosen, else the first pays itself */ choice?: [Option, Option] }

/** This week's boss, as the screens show it. */
export interface BossView {
  week: string
  species: string
  form: string
  rarity: 'R' | 'L'
  mega: boolean
  level: number
  max: number
  hp: number
  /** share of its HP taken so far, and still standing */
  taken: number
  hpLeft: number
  /** how hard the party hits it (0.12 to 1), and what is added to every strike */
  strike: number
  common: number
  tasks: (BossTask & { p: number })[]
  allDone: boolean
  /** days of its week still to come after today */
  daysLeft: number
  throws: number
  throwsLeft: number
  canThrow: boolean
  /** trained members standing behind the partner: what a throw's chance is worked from */
  trained: number
  killed: boolean
  caught: boolean
  fled: boolean
}
export interface BossPast { week: string; form: string; level: number; taken: number; killed: boolean; caught: boolean }

export interface Game {
  /** the weekly boss: this week's (null when there is none), every earlier one, and how full the party is (a boss needs six) */
  boss: BossView | null
  bossLog: BossPast[]
  bossParty: number
  /** how many of the party behind the partner are fully trained: they make a throw at the boss more likely */
  bossTrained: number
  /** rewards waiting to be collected, oldest first */
  held: Held[]
  partner: Mon
  level: number
  /** XP into the current level, and what the level needs */
  into: number
  need: number
  /** how much of `into` was already there when today began (the rest is today's) */
  intoBeforeToday: number
  /** next level something happens at, and what */
  next: { level: number; what: 'evolve' | 'graduate' | 'master' }
  /** for a partner whose next evolution branches: which way its habits are leaning, percentages that add to about 100 */
  lean: { form: string; tag: string; pct: number }[]
  /** what to draw today: the Mega or Gigantamax form when one is earned */
  display: string
  aura: 'mega' | 'gmax' | null
  asleep: boolean
  /** the Box: caught and not yet raised, oldest first */
  queue: Mon[]
  /** who follows the partner: the one chosen, else the oldest in the Box, else null (an egg) */
  nextUp: string | null
  graduates: Mon[]
  dex: Record<string, DexEntry>
  days: DayResult[]
  today: DayResult
  /** the multiplier in force today, and how many of the last seven days counted */
  momentum: { days: number; mult: number }
  perfectDays: number
  regions: number
  league: LeagueState
  hall: HallEntry[]
  /** what has been earned and not yet spent */
  wallet: { coins: number; gems: number; coinsToday: number; gemsToday: number; marks: Record<MarkTag, number>; marksToday: Record<MarkTag, number>; bp: number; bpToday: number }
  /** item → how many are held (balls, berries, incense, shards, guards), and the themes owned */
  inv: Record<string, number>
  /** the scene theme in use, '' for the ordinary one */
  theme: string
  /** up to TEAM_SIZE Pokemon standing behind the partner (fully trained ones, or from TEAM_OPEN_FROM any you own), and what the strike is raised by */
  team: Mon[]
  power: Power
  /** this week's quests (the day's own reward is its pay) */
  quests: { weekly: Quest[] }
  /** this month's ladder: steps reached, XP into the next one, and what the next one hands over */
  season: { month: string; step: number; into: number; need: number; next: { coins?: number; gems?: number; item?: string } }
  /** the egg being kept warm, if there is one: its steps so far and the steps it needs */
  egg: { have: number; need: number; /** the day it was put in the nursery: its steps count from the day after */ since: string } | null
  /** for each incense (Full Incense and the domain ones), the three the next wild Pokemon can be chosen from, and the one chosen */
  wish: { options: Record<string, string[]>; chosen: string | null }
  /** last night. `state`: measured by the band, a hand tick because there is no reading yet ('self'), or no band in use ('off') */
  sleep: { band: boolean; state: 'measured' | 'self' | 'off'; score: number | null; xp: number }
  /** today's Mart deals, which are already bought, and what is always on the shelf */
  mart: { deals: Offer[]; bought: string[]; standing: Offer[] }
  /** each domain's level (what its marks were spent on) and what a bond level adds to every strike */
  mastery: Record<MarkTag, number>
  bond: { level: number; mult: number }
  runs: Record<string, { cur: number; best: number }>
  counters: Record<string, number>
  feats: { id: string; day: string }[]
  /** day the Key Stone was earned */
  keyStone: string | null
  /** the Pokemon that fled at the start of today, if one did; and the empty day settled today, if there was one */
  fled: string | null
  slip: { empty: string; leader: number; wild: number; xp: number } | null
  /** each domain counted in its own unit, for life */
  notes: Notes
  /** things about the habit list the game cannot make sense of, in plain words */
  warnings: string[]
  stats: Stats
  moments: Moment[]
  wild: Wild | null
  /** version 13: the Battle Frontier's runs; a Guard Spec standing guard; whether the bond's Endure is ready (and when it will be) */
  frontier: FrontierRun[]
  guard: boolean
  endure: { ready: boolean; from: string | null }
  /** version 13 is in force on the last day */
  v13: boolean
  /** version 14 is in force: berries are food, the Collector keeps a wanted list, party vitamins count, any Pokemon can be fed */
  v14: boolean
  /** version 14: the Professor's research: its rank, the points toward the next, who is on the desk and what they add a day, and what it takes off wild Pokemon */
  research: { rank: number; points: number; need: number; desk: Mon[]; chosen: boolean; perDay: number; today: number; cut: number }
}

const FIRST_STAGES = Object.entries(SPECIES).filter(([, r]) => r.s === 1 && !r.f)
const rec = (id: string): SpeciesRec => SPECIES[id]
const stagesOf = (m: Mon): number => rec(m.base).x ?? 1

/** Monday of the week `day` is in. */
function weekOf(day: string): string {
  const dow = new Date(day + 'T12:00:00').getDay() // 0 Sun
  return addDays(day, -((dow + 6) % 7))
}

/** The leader a `gym` moment stands for, or who is up in a league. */
export function leaderOf(league: number, slot: number): Leader | null {
  const l = LEAGUES[league]
  return l ? (lineup(l)[slot] ?? null) : null
}
/** Is this slot one of the league's gyms (it hands over a badge) rather than the Elite Four or Champion? */
export const isGym = (league: number, slot: number): boolean => slot < (LEAGUES[league]?.gyms.length ?? 0)

/** A day with nothing ticked at all (last night's measured sleep is not a tick). */
const emptyDay = (f: DayFacts): boolean => {
  const mine = f.habits.filter((h) => !h.measured)
  return mine.length > 0 && mine.every((h) => !h.done && h.frac === 0)
}

export function foldGame(facts: DayFacts[], opts: { instant?: boolean } = {}): Game {
  const moments: Moment[] = []
  const dex: Record<string, DexEntry> = {}
  const queue: Mon[] = []
  const graduates: Mon[] = []
  const days: DayResult[] = []
  const hall: HallEntry[] = []
  const uids = new Set<string>()
  let regions = 1
  let perfectDays = 0
  let catches = 0
  let spawns = 0
  /** who follows the partner, when one was chosen by hand */
  let chosenNext: string | null = null
  /** version 14: who is on the Professor's research desk (null: the strongest not in the party), and how far the research is */
  let deskPick: string[] | null = null
  const research = { rank: 0, points: 0, today: 0 }
  let keyStone: string | null = null
  const zeroMarks = (): Record<MarkTag, number> => ({ code: 0, fitness: 0, guitar: 0, arbor: 0, sleep: 0 })
  const wallet = { coins: 0, gems: 0, coinsToday: 0, gemsToday: 0, marks: zeroMarks(), marksToday: zeroMarks(), bp: 0, bpToday: 0 }
  // ── version 13 ──
  let guard = false
  let lastEndure: string | null = null
  const fr: Record<string, { cur: number; best: number; wins: number; last: string; silver: string | null; gold: string | null }> = Object.fromEntries(FACILITIES.map((x) => [x.id, { cur: 0, best: 0, wins: 0, last: '', silver: null, gold: null }]))
  const v13On = (day: string): boolean => day >= V13_START
  const v14On = (day: string): boolean => day >= V14_START
  const v15On = (day: string): boolean => day >= V15_START
  const heartsOf = (m: Mon): number => (m.together ?? 0) + (m.fed ?? 0)
  const bpEarn = (n: number) => { wallet.bp += n; wallet.bpToday += n }
  const inv: Record<string, number> = {}
  const sold = new Set<string>()
  const runs: Record<string, { cur: number; best: number; last: string }> = {}
  const cn: Record<string, number> = {}
  const feats: { id: string; day: string }[] = []
  const gotFeat = new Set<string>()
  const mastery: Record<MarkTag, number> = zeroMarks()
  let theme = ''
  let teamPick: string[] | null = null
  let wishFor: string | null = null
  const paid = new Set<string>()
  const monthXp: Record<string, number> = {}, monthStep: Record<string, number> = {}
  const weekXp: Record<string, number> = {}, weekDays: Record<string, number> = {}, weekCatch: Record<string, number> = {}
  let egg: { have: number; since: string } | null = null
  let chests = 0
  let fledToday: string | null = null
  let slipToday: Game['slip'] = null
  const bump = (k: string, n = 1) => { cn[k] = (cn[k] ?? 0) + n }
  const runDay = (key: string, day: string) => {
    const r = (runs[key] ??= { cur: 0, best: 0, last: '' })
    r.cur = r.last && dayGap(r.last, day) <= 2 ? r.cur + 1 : 1
    r.last = day
    r.best = Math.max(r.best, r.cur)
    cn[`run:${key}`] = r.best
  }
  const earn = (coins: number, gems: number) => {
    wallet.coins += coins; wallet.gems += gems; wallet.coinsToday += coins; wallet.gemsToday += gems
  }
  // ── the weekly boss (boss.ts) ──
  interface BossRun { card: BossCard; from: string; taken: number; /** what the work has dealt, before the cap: more than the cap is kept, so the last task finishes it */ dealt: number; work: number; p: number[]; throws: number; killed: boolean; caught: boolean; fled: boolean; paid: Set<number>; done: Set<number>; strike: number; common: number }
  let boss: BossRun | null = null
  const bossLog: BossPast[] = []
  const bossWeeks = new Set<string>()
  // ── rewards that wait to be collected ──
  const held = new Map<string, Held>()
  /** the Type Plates already dropped (claimed or not), so no win drops one twice */
  const platesGot = new Set<string>()
  /** a claim made before its reward existed (a quest or feat won later the same day): it pays the moment the reward appears */
  const claimedEarly = new Set<string>()
  /** pay it into the wallet and the bag (not today's tally: that counted when it was earned) */
  const credit = (h: Held, day: string) => {
    wallet.coins += h.coins; wallet.gems += h.gems
    for (const [id, n] of h.items) {
      inv[id] = (inv[id] ?? 0) + n
      if (id === 'key-stone' && !keyStone) { keyStone = day; moments.push({ kind: 'key', day }) }
    }
  }
  const release = (key: string, day: string, pick = 0) => {
    const h = held.get(key)
    if (!h) return
    held.delete(key)
    credit(h.choice ? { ...h, ...h.choice[pick === 1 ? 1 : 0] } : h, day)
  }
  /** version 15: a reward that is a choice of two waits like any other; unchosen, the first pays itself after CLAIM_AUTO days */
  const holdChoice = (key: string, day: string, title: string, choice: [Option, Option]) => {
    const h: Held = { key, day, title, coins: 0, gems: 0, items: [], choice }
    if (opts.instant || claimedEarly.delete(key)) credit({ ...h, ...choice[0] }, day)
    else held.set(key, h)
  }
  /** earned now, collected later: today's tally rises at once, the wallet when it is claimed */
  const hold = (key: string, day: string, title: string, coins: number, gems: number, items: [string, number][] = []) => {
    if (coins <= 0 && gems <= 0 && !items.length) return
    wallet.coinsToday += coins; wallet.gemsToday += gems
    const h: Held = { key, day, title, coins, gems, items }
    if (opts.instant || claimedEarly.delete(key)) credit(h, day)
    else held.set(key, h)
  }
  /** the three the wild Pokemon after this one can be chosen from: of any type, or of one domain's types for a domain incense */
  const wishOptions = (tag: Tag | null): string[] => [0, 1, 2].map((k) => roll(`wish:${spawns + 1}:${tag ?? 'any'}:${k}`, 'any', tag))
  /** the day being folded: the team's rules depend on it (TEAM_OPEN_FROM) */
  let teamDay = ''
  /** who stands on the team: the ones you chose, or the latest fully trained; from TEAM_OPEN_FROM any Pokemon you own can be chosen, and empty places fill with the oldest in My Pokemon */
  const teamNow = (): Mon[] => {
    if (teamDay < TEAM_OPEN_FROM) return (teamPick ? teamPick.flatMap((u) => graduates.filter((m) => m.uid === u)) : graduates.slice(-TEAM_SIZE).reverse()).slice(0, TEAM_SIZE)
    const owned = [...graduates, ...queue]
    const picked = (teamPick ? teamPick.flatMap((u) => owned.filter((m) => m.uid === u)) : graduates.slice(-TEAM_SIZE).reverse()).slice(0, TEAM_SIZE)
    const taken = new Set(picked.map((m) => m.uid))
    return [...picked, ...queue.filter((m) => !taken.has(m.uid)).slice(0, TEAM_SIZE - picked.length)]
  }
  /** the fully trained among the team: the only ones that count towards the boss's party of six */
  const trainedTeam = (): Mon[] => teamNow().filter((m) => m.graduated)
  /** version 14: the Professor's research desk: the ones chosen, else the strongest in the Box. Nobody in the party, and never the partner */
  const deskNow = (): Mon[] => {
    const party = new Set([partner.uid, ...teamNow().map((m) => m.uid)])
    const free = [...graduates, ...queue].filter((m) => !party.has(m.uid))
    const worth = (m: Mon) => studyPoints(levelOf(m.xp), (rec(m.form).r ?? 'C') as Rarity, m.shiny)
    const picked = deskPick ? deskPick.flatMap((u) => free.filter((m) => m.uid === u)) : [...free].sort((a, b) => worth(b) - worth(a) || b.xp - a.xp)
    return picked.slice(0, RESEARCH_SLOTS)
  }
  /** What a day of the desk's study adds (studyPoints in rules.ts) */
  const studyOf = (desk: Mon[]): number => desk.reduce((n, m) => n + studyPoints(levelOf(m.xp), (rec(m.form).r ?? 'C') as Rarity, m.shiny), 0)
  /** Fully trained Pokemon, counting a partner that was fully trained and leads again (version 14) */
  const trainedCount = (): number => graduates.length + (partner.graduated ? 1 : 0)
  /** the types the partner fights with: its own, and the TMs it carries */
  const typesOf = (m: Mon): (string | undefined)[] => [rec(m.form).t, rec(m.form).t2, ...(m.moves ?? []).map((id) => tmType(id) ?? undefined)]
  const notes: Notes = { codeDays: 0, arborDays: 0, guitarDays: 0, workouts: 0, records: 0, clean: 0, owned: 0, steps: 0, stepDays: 0 }
  /** how each Pokemon did on each tag over all its days as the partner: its nature */
  const raised = new Map<string, Share>()

  /** the wild Pokemon in front of you, and the one caught today if there was one */
  let wild: Wild | null = null
  let caughtToday: Wild | null = null

  // the league: who is up, and their HP
  const lg = { index: 0, slot: 0, hp: LEADER_HP, max: LEADER_HP, beaten: 0, slipped: 0, lap: 0 }
  /** what kind of leader stands in a slot: a gym, the Elite Four, or the Champion */
  const kindAt = (league: number, slot: number): 'gym' | 'elite' | 'champion' => {
    const l = LEAGUES[league]
    return !l || slot < l.gyms.length ? 'gym' : slot >= lineup(l).length - 1 ? 'champion' : 'elite'
  }
  /** a new leader steps up: their HP is set by where they stand (version 13), or the old flat 2,000 */
  const freshLeader = (day: string) => {
    lg.max = v13On(day) ? leaderHp(lg.index, kindAt(lg.index, lg.slot), lg.lap) : LEADER_HP
    lg.hp = lg.max
  }

  const see = (form: string, day: string, shiny: boolean, own = true) => {
    if (!dex[form]) dex[form] = { first: day }
    if (own && !dex[form].own) dex[form].own = day
    if (shiny) dex[form].shiny = true
  }
  /** Species and day name a Pokemon, so a choice made on it still finds it if an earlier day is ticked late. */
  const make = (base: string, origin: Mon['origin'], day: string, shiny = false): Mon => {
    let uid = `${base}.${day}`
    for (let n = 2; uids.has(uid); n++) uid = `${base}.${day}.${n}`
    uids.add(uid)
    return { uid, base, form: base, xp: 0, shiny, origin, from: day, path: [base] }
  }
  const owned = () => new Set([partner.base, ...queue.map((m) => m.base), ...graduates.map((m) => m.base)])
  /** Regions only ever open: enough trained partners, and the league before it beaten. */
  const reopen = (day: string) => {
    const n = regionsOpen(trainedCount(), lg.beaten)
    if (n > regions) {
      regions = n
      moments.push({ kind: 'region', day, n })
    }
  }

  /** One first-stage species from the open regions. New lines first; repeats only when there is nothing new. */
  const roll = (seed: string, want: 'any' | 'R' | 'L', lure: Tag | null = null): string => {
    const r = rng(seed)
    const open = regions
    let rarity: string = want
    if (want === 'any') {
      const x = r() * (CATCH_WEIGHTS.C + CATCH_WEIGHTS.U + CATCH_WEIGHTS.R)
      rarity = x < CATCH_WEIGHTS.C ? 'C' : x < CATCH_WEIGHTS.C + CATCH_WEIGHTS.U ? 'U' : 'R'
    }
    const have = owned()
    // nothing new of that rarity in the open regions: try the neighbouring ones before repeating
    const chain: Record<string, string[]> = { C: ['C', 'U', 'R'], U: ['U', 'C', 'R'], R: ['R', 'U', 'C'], L: ['L', 'R', 'U', 'C'] }
    const pools = chain[rarity].map((x) => FIRST_STAGES.filter(([, s]) => (s.g ?? 9) <= open && s.r === x))
    // a lure: its domain's types first, new species before repeats
    const ts = lure ? lureTypes(lure) : []
    const lured = lure ? pools.map((p) => p.filter(([, s]) => ts.includes(s.t) || (s.t2 !== undefined && ts.includes(s.t2)))) : []
    for (const pool of [...lured.map((p) => p.filter(([id]) => !have.has(id))), ...lured, ...pools.map((p) => p.filter(([id]) => !have.has(id))), ...pools])
      if (pool.length) return pool[Math.floor(r() * pool.length)][0]
    return START_SPECIES
  }

  let partner = make(START_SPECIES, 'starter', facts[0]?.day ?? '')
  partner.started = partner.from
  see(partner.form, partner.from, false)
  /** how the partner did on each tag since its last evolution: picks the branch */
  let stage = emptyShare()

  const branchScores = (m: Mon): number[] => {
    const score = (tag: string): number =>
      tag === 'balanced' ? Math.min(ratio(stage, 'code'), ratio(stage, 'fitness'), ratio(stage, 'guitar'))
      : tag === 'health' ? -1 // waits for the health tracker
      : ratio(stage, tag as Tag)
    return (rec(m.form).bt ?? []).map(score)
  }
  const pickBranch = (m: Mon, day: string): { form: string; tag?: string; picked?: true } => {
    const r = rec(m.form)
    const evos = r.e ?? []
    // a branch was chosen by hand: that is the one
    if (m.pick && evos.includes(m.pick)) return { form: m.pick, picked: true }
    if (evos.length === 1 || !r.bt) return { form: evos[0] }
    const scores = branchScores(m)
    const best = Math.max(...scores)
    const tied = evos.map((_, i) => i).filter((i) => scores[i] === best)
    const i = tied[Math.floor(rng(`branch:${m.uid}:${day}`)() * tied.length)]
    return { form: evos[i], tag: r.bt[i] }
  }

  /** Best domain up, worst domain down; nothing to tell them apart is one of the five that change nothing. */
  const natureOf = (m: Mon): Mon['nature'] => {
    const sh = raised.get(m.uid)
    const on = NATURE_STATS.filter((st) => sh && sh[NATURE_DOMAIN[st]].max > 0)
    if (!sh || !on.length) return { name: NATURES.spe.spe }
    const r = (st: NatureStat) => ratio(sh, NATURE_DOMAIN[st])
    const up = on.reduce((a, b) => (r(b) > r(a) ? b : a))
    const down = on.reduce((a, b) => (r(b) < r(a) ? b : a))
    if (r(up) === r(down)) return { name: NATURES[up][up] }
    return { name: NATURES[up][down], up: NATURE_DOMAIN[up], down: NATURE_DOMAIN[down] }
  }

  /** The partner has stepped aside: the one chosen, else the oldest in the Box, else an egg so the loop never stalls. `over` is the XP it had past the line. */
  const nextPartner = (day: string, over: number) => {
    const at = chosenNext ? queue.findIndex((m) => m.uid === chosenNext) : -1
    partner = (at >= 0 ? queue.splice(at, 1)[0] : queue.shift()) ?? make(roll(`egg:${day}:${graduates.length}`, 'any'), 'starter', day)
    chosenNext = null
    partner.started = day
    partner.xp += over
    see(partner.form, day, partner.shiny)
    stage = emptyShare()
    moments.push({ kind: 'partner', day, uid: partner.uid, form: partner.form, origin: partner.origin })
  }

  const gain = (xp: number, day: string) => {
    const before = levelOf(partner.xp)
    const who = partner.uid
    partner.xp += xp
    for (;;) {
      const r = rec(partner.form)
      const stages = stagesOf(partner)
      const level = levelOf(partner.xp)
      const evo = evolveAt(stages, r.s)
      // an Everstone keeps the form (version 13): it goes on levelling and evolves the day the stone comes off
      const stone = partner.held === 'everstone' && v13On(day)
      if (evo !== null && level >= evo && r.e?.length && !stone) {
        const to = pickBranch(partner, day)
        earn(0, GEMS.evolve)
        moments.push({ kind: 'evolve', day, uid: partner.uid, from: partner.form, form: to.form, ...(to.tag ? { tag: to.tag } : {}), ...(to.picked ? { picked: true as const } : {}) })
        partner.form = to.form
        partner.path.push(to.form)
        delete partner.pick
        delete partner.megas // a Mega belongs to the form it has just left
        delete partner.show
        see(to.form, day, partner.shiny)
        stage = emptyShare()
        continue
      }
      // version 14: a fully trained Pokemon leading again goes on to the last level, and there it steps aside for the next
      if (partner.graduated && v14On(day)) {
        if (level < MAX_LEVEL) break
        const over = partner.xp - xpForLevel(MAX_LEVEL)
        partner.xp = xpForLevel(MAX_LEVEL)
        if (partner.held) { inv[partner.held] = (inv[partner.held] ?? 0) + 1; delete partner.held }
        graduates.push(partner)
        moments.push({ kind: 'master', day, uid: partner.uid, form: partner.form })
        nextPartner(day, over)
        continue
      }
      const grad = graduateAt(stages)
      if (level >= grad) {
        const over = partner.xp - xpForLevel(grad)
        partner.xp = xpForLevel(grad)
        partner.graduated = day
        partner.nature = natureOf(partner)
        if (partner.held) { inv[partner.held] = (inv[partner.held] ?? 0) + 1; delete partner.held }
        graduates.push(partner)
        earn(0, GEMS.graduate)
        moments.push({ kind: 'graduate', day, uid: partner.uid, form: partner.form })
        reopen(day)
        nextPartner(day, over)
        continue
      }
      break
    }
    if (partner.uid === who && levelOf(partner.xp) > before) {
      moments.push({ kind: 'level', day, uid: partner.uid, form: partner.form, level: levelOf(partner.xp) })
      // version 15: every MILESTONE_EVERY levels, a choice of two rewards
      if (v15On(day)) for (let lv = before + 1; lv <= levelOf(partner.xp); lv++) {
        if (lv % MILESTONE_EVERY !== 0) continue
        const key = `level:${partner.uid}:${lv}`
        holdChoice(key, day, `${nameOf(partner.form)} reached Lv ${lv}`, milestoneOptions(key, lv, inv))
      }
    }
  }

  /** The wild Pokemon is caught: into the Box, and the next one appears tomorrow. */
  const catchWild = (w: Wild, day: string, shiny: boolean, ball: Ball, how: 'perfect' | 'worn' | 'ball'): Mon => {
    const mon = make(w.form, 'catch', day, shiny)
    mon.ball = ball
    queue.push(mon)
    catches++
    see(mon.form, day, shiny)
    earn(0, GEMS.catch + (shiny ? GEMS.shiny : 0))
    weekCatch[weekOf(day)] = (weekCatch[weekOf(day)] ?? 0) + 1
    moments.push({ kind: 'catch', day, uid: mon.uid, form: mon.form, shiny, n: catches, how })
    caughtToday = { ...w, hp: 0, shiny, caught: true }
    wild = null
    if (shiny) bump('shiny')
    if (rec(mon.form).r === 'L') bump('legend')
    return mon
  }

  /** What a feat hands over. The Key Stone also starts the Mega road. */
  const grant = (r: Reward, day: string, key: string, title: string) => {
    hold(key, day, title, Math.round((r.coins ?? 0) * (r.coins && inv['amulet-coin'] ? AMULET_MULT : 1)), r.gems ?? 0, Object.entries(r.items ?? {}))
  }
  const evalFeats = (day: string) => {
    cn.workouts = notes.workouts; cn.records = notes.records; cn.owned = notes.owned
    cn.perfect = perfectDays; cn.grads = trainedCount()
    cn['run:any'] = Math.max(0, ...Object.keys(runs).map((k) => runs[k].best))
    cn.dex = Object.keys(dex).filter((id) => dex[id].own && !SPECIES[id]?.f).length
    cn.hearts = Math.max(0, ...[partner, ...queue, ...graduates].map((m) => (m.together ?? 0) + (m.fed ?? 0)))
    for (const ft of FEATS) {
      if (gotFeat.has(ft.id) || (cn[ft.key] ?? 0) < ft.n) continue
      gotFeat.add(ft.id)
      feats.push({ id: ft.id, day })
      grant(ft.reward, day, `feat:${ft.id}`, ft.name)
      moments.push({ kind: 'feat', day, id: ft.id, name: ft.name, coins: ft.reward.coins ?? 0, gems: ft.reward.gems ?? 0, items: Object.keys(ft.reward.items ?? {}) })
    }
  }

  /**
   * Something done by hand in the Pokedex: buying, throwing, feeding, equipping, choosing.
   * Whatever does not apply is ignored, so a stale tap costs nothing. None of it gives XP.
   */
  const spend = (u: { item: string; uid: string; what: string; to?: string }, day: string) => {
    const item = u.item === 'berry' ? 'oran-berry' : u.item === 'incense' ? 'full-incense' : u.item
    const today = days[days.length - 1]
    switch (u.what) {
      case 'buy': {
        const named = u.to && (u.to === 'mart' || u.to === 'rare' || isMarkTag(u.to)) ? (u.to as ShopId) : undefined
        const hit = offerFor(named, item, day, dealsFor(inv))
        if (!hit) return
        const { shop, offer } = hit
        if (shop === 'mart' && sold.has(`${day}:${item}`)) return
        if (ONCE.has(item) && (inv[item] || partner.held === item)) return
        const marks = isMarkTag(shop) ? wallet.marks[shop] : shop === 'bp' ? wallet.bp : 0
        if ((offer.coins ?? 0) > wallet.coins || (offer.gems ?? 0) > wallet.gems || (offer.marks ?? 0) > marks) return
        wallet.coins -= offer.coins ?? 0; wallet.gems -= offer.gems ?? 0
        if (isMarkTag(shop)) wallet.marks[shop] -= offer.marks ?? 0
        if (shop === 'bp') wallet.bp -= offer.marks ?? 0
        if (shop === 'mart') sold.add(`${day}:${item}`)
        if (item === 'chest') {
          // opened on the spot: the same chest always holds the same thing, on every device
          chests++
          bump('chests')
          let x = rng(`chest:${chests}`)() * 100
          const got = CHEST.find((c) => (x -= c.odds) < 0) ?? CHEST[0]
          wallet.coins += got.coins ?? 0
          if (got.item) inv[got.item] = (inv[got.item] ?? 0) + (got.n ?? 1)
          moments.push({ kind: 'chest', day, n: chests, coins: got.coins ?? 0, item: got.item ?? '', count: got.n ?? 0 })
          return
        }
        inv[item] = (inv[item] ?? 0) + 1
        return
      }
      case 'throw': {
        const w: Wild | null = wild
        const b = BALLS[item]
        if (!b || !inv[item] || !w) return
        const r = rec(w.form)
        const hp = Math.round(throwHp(item, { types: [r.t, r.t2], from: w.from, owned: Boolean(dex[w.form]?.own) }, day) * (v13On(day) && partner.held === 'wide-lens' ? 1.25 : 1))
        inv[item]--
        const took = Math.min(w.hp, hp)
        w.hp -= took
        if (today) today.hit += took
        if (w.hp <= 0) {
          const mon = catchWild(w, day, false, ballClass(item), 'ball')
          mon.thrown = item
          if (b.hearts) mon.fed = (mon.fed ?? 0) + b.hearts
        }
        return
      }
      case 'repel': {
        const w: Wild | null = wild
        if (item !== 'max-repel' || !inv[item] || !w || w.caught || w.repel) return
        inv[item]--
        w.repel = REPEL_DAYS
        return
      }
      case 'revive': {
        if (item !== 'revive' || !inv[item] || lg.slipped <= 0 || !leaderOf(lg.index, lg.slot)) return
        inv[item]--
        const back = Math.min(lg.slipped, lg.hp - 1)
        lg.hp -= back
        lg.slipped -= back
        return
      }
      case 'feed': {
        const hearts = BERRY_HEARTS[item] ?? 0
        if (!hearts || !inv[item]) return
        // version 14: any Pokemon you own can be fed (a party member's bond adds to every strike), and never past the last bond level
        const m = v14On(day) && u.uid ? [partner, ...queue, ...graduates].find((x) => x.uid === u.uid) : partner
        if (!m || (v14On(day) && heartsOf(m) >= HEART_CAP)) return
        inv[item]--
        m.fed = (m.fed ?? 0) + hearts
        return
      }
      case 'train': {
        const tag = u.to ?? ''
        if (!isMarkTag(tag) || mastery[tag] >= MASTERY_MAX) return
        const cost = masteryCost(mastery[tag])
        if (wallet.marks[tag] < cost) return
        wallet.marks[tag] -= cost
        mastery[tag]++
        bump('mastery')
        return
      }
      case 'wish': {
        // any incense: Full Incense offers three of any type, a domain incense three of that domain's types
        const tag = item === 'full-incense' ? null : (LURES[item] ?? undefined)
        if (tag === undefined || wishFor || !inv[item] || !u.to || !wishOptions(tag).includes(u.to)) return
        inv[item]--
        wishFor = u.to
        return
      }
      case 'hold': {
        const to = u.to ?? ''
        if (to && !(HELD[to] && (inv[to] || partner.held === to))) return
        if (partner.held) { inv[partner.held] = (inv[partner.held] ?? 0) + 1; delete partner.held }
        if (to) { inv[to]--; partner.held = to }
        return
      }
      case 'move': {
        const ids = [...new Set((u.to ?? '').split(',').filter((id) => tmType(id) && inv[id]))].slice(0, TM_SLOTS)
        if (ids.length) partner.moves = ids
        else delete partner.moves
        return
      }
      case 'forge': {
        const m = [partner, ...queue, ...graduates].find((x) => x.uid === u.uid)
        if (!keyStone || !m || !u.to) return
        const megas = rec(m.form).m ?? []
        if (!megas.includes(u.to) || m.megas?.includes(u.to)) return
        if (v13On(day)) {
          // version 13: three shards of three different colours, and the X or Y is yours
          const use = forgeFair(inv, u.item || undefined)
          if (!use) return
          for (const id of use) inv[id]--
        } else {
          const shard = forgeShard(megas.length, megas.indexOf(u.to), m.nature?.up, inv)
          if (!shard) return
          inv[shard] -= FORGE_COST
        }
        m.megas = [...(m.megas ?? []), u.to]
        see(u.to, day, m.shiny)
        bump('megas')
        moments.push({ kind: 'mega', day, uid: m.uid, form: u.to })
        return
      }
      case 'transfer': {
        // version 14: nobody is sold. The Box is the Professor's, and the ones he studies earn research (see 'study')
        if (v14On(day)) return
        const i = queue.findIndex((m) => m.uid === u.uid)
        if (i < 0) return
        const [gone] = queue.splice(i, 1)
        if (chosenNext === gone.uid) chosenNext = null
        const coins = SELL[rec(gone.form).r ?? 'C'] ?? SELL.C
        earn(coins, 0)
        moments.push({ kind: 'transfer', day, form: gone.form, coins })
        return
      }
      case 'claim': {
        // a reward collected by hand; one that is not waiting (or was never earned) is ignored
        if (!u.to) return
        if (held.has(u.to)) release(u.to, day, u.item === '1' ? 1 : 0)
        else claimedEarly.add(u.to)
        return
      }
      case 'boss-throw': {
        // a ball at the boss: only once it is weak enough, three in a week, and never a sure thing
        const b = boss
        if (!b || b.caught || b.fled || b.throws >= THROWS || !BALLS[item] || !inv[item]) return
        const hpLeft = 1 - b.taken
        if (hpLeft > THROW_AT + 1e-9) return
        inv[item]--
        b.throws++
        const chance = catchChance(item, trainedTeam().length, cardDone(b.card, b.p), hpLeft, b.strike) + (v13On(day) && partner.held === 'zoom-lens' ? 0.05 : 0)
        if (rng(`boss-catch:${b.card.week}:${b.throws}`)() < chance) {
          const shiny = rng(`boss-shiny:${b.card.week}`)() < 1 / BOSS_SHINY
          const mon = make(b.card.species, 'catch', day, shiny)
          mon.thrown = item
          queue.push(mon)
          catches++
          see(mon.form, day, shiny)
          b.caught = true
          earn(0, BOSS_CATCH_GEMS)
          bump('bosses')
          // a catch is a catch: it counts for the week's quest and for the legendary feat like a wild one does
          weekCatch[weekOf(day)] = (weekCatch[weekOf(day)] ?? 0) + 1
          if (rec(mon.form).r === 'L') bump('legend')
          if (shiny) bump('shiny')
          moments.push({ kind: 'boss', day, week: b.card.week, form: b.card.form, level: b.card.level, what: 'catch', shiny, uid: mon.uid })
        } else {
          moments.push({ kind: 'boss', day, week: b.card.week, form: b.card.form, level: b.card.level, what: 'miss', n: b.throws })
          if (b.throws >= THROWS) b.fled = true
        }
        return
      }
      case 'team': {
        const ids = (u.to ?? '').split(',').filter((id) => graduates.some((m) => m.uid === id) || (day >= TEAM_OPEN_FROM && queue.some((m) => m.uid === id)))
        teamPick = [...new Set(ids)].slice(0, TEAM_SIZE)
        return
      }
      case 'theme': {
        if (!u.to || inv[u.to]) theme = u.to ?? ''
        return
      }
      case 'next': {
        // choosing who is next is free, and can be changed as often as you like
        if (queue.some((m) => m.uid === u.uid)) chosenNext = u.uid
        return
      }
      case 'show': {
        // which registered form to draw. Changes nothing but the picture
        const m = [partner, ...queue].find((x) => x.uid === u.uid)
        if (m && u.to && (u.to === 'base' || m.megas?.includes(u.to))) m.show = u.to
        return
      }
      case 'branch': {
        const m = [partner, ...queue].find((x) => x.uid === u.uid)
        if (m && u.to && (rec(m.form).e?.length ?? 0) > 1 && rec(m.form).e!.includes(u.to)) {
          m.pick = u.to
          moments.push({ kind: 'use', day, uid: m.uid, form: m.form, what: 'branch', to: u.to })
        }
        return
      }
      // ── version 13 ──
      case 'boost':
        // X items and Dire Hits are used before the day's strike, in the day itself (see the leader below)
        return
      case 'guard': {
        if (!v13On(day) || item !== 'guard-spec' || !inv[item] || guard) return
        inv[item]--
        guard = true
        return
      }
      case 'honey': {
        if (!v13On(day) || item !== 'honey' || !inv[item] || wishFor) return
        inv[item]--
        wishFor = roll(`honey:${day}:${spawns}`, 'R')
        return
      }
      case 'summon': {
        if (!v13On(day) || !LEGEND_KEYS[item] || !inv[item] || wishFor) return
        const form = legendFor(item, cn.summons ?? 0)
        if (!form || !SPECIES[form]) return
        inv[item]--
        bump('summons')
        wishFor = form
        moments.push({ kind: 'summon', day, key: item, form })
        return
      }
      case 'fossil': {
        const f = FOSSILS[item]
        if (!v13On(day) || !f || !inv[item] || wallet.coins < REVIVE_COST || !SPECIES[f.species]) return
        inv[item]--
        wallet.coins -= REVIVE_COST
        const mon = make(f.species, 'fossil', day)
        queue.push(mon)
        see(mon.form, day, false)
        bump('fossils')
        moments.push({ kind: 'fossil', day, uid: mon.uid, form: mon.form, item })
        return
      }
      case 'evolve': {
        const e = EVO_ITEMS[item]
        const m = queue.find((x) => x.uid === u.uid)
        if (!v13On(day) || !e || !inv[item] || !m) return
        const into = (rec(m.form).e ?? []).find((f) => SPECIES[f] && (e.types.includes(rec(f).t) || (rec(f).t2 !== undefined && e.types.includes(rec(f).t2!))) && (!u.to || u.to === f))
        if (!into) return
        inv[item]--
        moments.push({ kind: 'itemevo', day, uid: m.uid, from: m.form, form: into, item })
        m.form = into
        m.path.push(into)
        delete m.pick
        see(into, day, m.shiny)
        earn(0, GEMS.evolve)
        bump('itemevos')
        return
      }
      case 'candy': {
        // version 14: a fully trained Pokemon takes a candy too, up to the last level
        const m = queue.find((x) => x.uid === u.uid) ?? (v14On(day) ? graduates.find((x) => x.uid === u.uid) : undefined)
        if (!v13On(day) || item !== 'rare-candy' || !inv[item] || !m || levelOf(m.xp) >= MAX_LEVEL) return
        inv[item]--
        m.xp = Math.max(m.xp, xpForLevel(levelOf(m.xp) + 1))
        return
      }
      case 'vitamin': {
        const tag = VITAMINS[item]
        const m = u.uid ? [partner, ...queue, ...graduates].find((x) => x.uid === u.uid) : partner
        if (!v13On(day) || !tag || !inv[item] || !m || (m.vits?.[tag] ?? 0) >= VITAMIN_MAX) return
        inv[item]--
        m.vits = { ...(m.vits ?? {}), [tag]: (m.vits?.[tag] ?? 0) + 1 }
        bump('vitamins')
        return
      }
      case 'sell': {
        const t = TREASURE[item]
        if (!v13On(day) || !t || !inv[item]) return
        const n = Math.max(1, Math.min(inv[item], Number.parseInt(u.to ?? '1', 10) || 1))
        inv[item] -= n
        // version 14: the Collector pays double for what is on today's wanted list
        const price = v14On(day) ? treasurePrice(item, day) : t[1]
        earn(price * n, 0)
        bump('sold', price * n)
        return
      }
      case 'study': {
        // version 14: who the Professor studies. 'auto' gives the desk back to the strongest in the Box
        if (!v14On(day)) return
        if (u.to === 'auto') { deskPick = null; return }
        const ids = (u.to ?? '').split(',').filter((id) => id && id !== partner.uid && [...graduates, ...queue].some((m) => m.uid === id))
        deskPick = [...new Set(ids)].slice(0, RESEARCH_SLOTS)
        return
      }
      case 'lead': {
        const i = queue.findIndex((x) => x.uid === u.uid)
        // version 14: a fully trained Pokemon can lead again, to go on to the last level
        const g = i < 0 && v14On(day) ? graduates.findIndex((x) => x.uid === u.uid && levelOf(x.xp) < MAX_LEVEL) : -1
        if (i < 0 && g < 0) return
        const [next] = i >= 0 ? queue.splice(i, 1) : graduates.splice(g, 1)
        if (partner.graduated) graduates.push(partner)
        else queue.unshift(partner)
        partner = next
        if (chosenNext === next.uid) chosenNext = null
        partner.started ??= day
        stage = emptyShare()
        moments.push({ kind: 'use', day, uid: partner.uid, form: partner.form, what: 'lead' })
        return
      }
    }
  }

  const leagueOpen = (): boolean => {
    const l = LEAGUES[lg.index]
    return Boolean(l) && (lg.lap > 0 || l.region === null || l.region <= regions)
  }

  /** The task that stood for the most of the boss's HP: its colour is the shard a kill pays. */
  const hardest = (card: BossCard): BossTask => card.tasks.reduce((a, t) => (t.share > a.share ? t : a), card.tasks[0])
  /** A boss whose week is over: it goes into the log, and if it was not caught it has left. */
  const closeBoss = (day: string) => {
    const b = boss
    if (!b) return
    bossLog.push({ week: b.card.week, form: b.card.form, level: b.card.level, taken: b.taken, killed: b.killed, caught: b.caught })
    if (!b.caught) moments.push({ kind: 'boss', day, week: b.card.week, form: b.card.form, level: b.card.level, what: 'left' })
    boss = null
  }

  /** What the strike is raised by right now. */
  const powerOf = (v13 = false, v14 = false): Power => {
    const members = teamNow()
    const domain = {} as Power['domain']
    for (const t of TAGS) domain[t] = { held: heldBonus(partner.held, t), mastery: isMarkTag(t) ? MASTERY_STEP * mastery[t] : 0, nature: TEAM_NATURE * members.filter((m) => m.nature?.up === t).length, vitamin: v13 && isMarkTag(t) ? VITAMIN_STEP * ((partner.vits?.[t] ?? 0) + (v14 ? PARTY_VITAMIN * members.reduce((n, m) => n + (m.vits?.[t] ?? 0), 0) : 0)) : 0 }
    const bond = bondLevel(heartsOf(partner))
    return {
      team: members.reduce((sum, m) => sum + TEAM_BONUS + BOND_PARTY * bondLevel(heartsOf(m)) + (v13 ? TEAM_LEVEL * levelOf(m.xp) : 0), 0),
      bond: BOND_STEP * bond,
      // version 13: a forged stone is worth more the closer the two of you are
      mega: partner.megas?.length ? MEGA_BONUS + (v13 ? MEGA_BOND * bond : 0) : 0,
      item: heldCommon(partner.held),
      level: v13 ? LEVEL_POWER * levelOf(partner.xp) : 0,
      domain,
    }
  }

  let display = partner.form
  let aura: Game['aura'] = null
  let asleep = false
  let momentum = { days: 0, mult: 1 }
  /** the partner, and its XP, as today began: what the bar showed before anything was ticked */
  let dayStart = { uid: partner.uid, xp: partner.xp }

  facts.forEach((f, i) => {
    teamDay = f.day
    const v13 = v13On(f.day)
    wallet.coinsToday = 0; wallet.gemsToday = 0; wallet.marksToday = zeroMarks(); wallet.bpToday = 0
    caughtToday = null
    fledToday = null
    slipToday = null
    const stakes = f.day >= STAKES_FROM
    for (const h of [...held.values()]) if (dayGap(h.day, f.day) >= CLAIM_AUTO) release(h.key, f.day)
    // a month-end review pays a Comet Shard, one for each made today
    for (let r = 0; r < (f.reviews ?? 0); r++) {
      bump('reviews')
      hold(`review:${cn.reviews}`, f.day, 'Month reviewed', 0, REVIEW_GEMS, [[COMET_SHARD, 1]])
      moments.push({ kind: 'review', day: f.day, n: cn.reviews })
    }

    // ── stakes: what two days ago cost, settled now ──
    // A day can still be ticked until the end of the next day, so an empty day is only
    // settled once that grace is over, and only the work still in progress pays for it.
    const gone = facts[i - 2]
    // version 13: the bond's Endure (one empty day a week), the Focus Sash, or a Guard Spec standing guard: the day costs nothing
    const shield = !(stakes && gone && gone.day >= STAKES_FROM && dayGap(gone.day, f.day) === 2 && emptyDay(gone)) || !v13 ? null
      : partner.held === 'focus-sash' ? 'sash' as const
        : hasPerk(bondLevel(heartsOf(partner)), 'endure') && (!lastEndure || dayGap(lastEndure, f.day) >= ENDURE_DAYS) ? 'endure' as const
          : guard ? 'guard' as const : null
    if (shield && gone) {
      if (shield === 'endure') lastEndure = f.day
      if (shield === 'guard') guard = false
      moments.push({ kind: 'endure', day: f.day, empty: gone.day, how: shield })
    } else if (stakes && gone && gone.day >= STAKES_FROM && dayGap(gone.day, f.day) === 2 && emptyDay(gone)) {
      let leader = 0, wildBack = 0
      const lead = leaderOf(lg.index, lg.slot)
      if (lead && leagueOpen()) { leader = Math.min(SLIP.leader, lg.max - lg.hp); lg.hp += leader; lg.slipped += leader }
      const w: Wild | null = wild
      if (w && !w.caught) { wildBack = Math.min(SLIP.wild, w.max - w.hp); w.hp += wildBack }
      // only into the level being worked on: a level reached, an evolution and a graduation stay
      const floor = levelOf(partner.xp) <= 1 ? 0 : xpForLevel(levelOf(partner.xp))
      const xpLost = Math.floor((partner.xp - floor) * SLIP.xp)
      partner.xp -= xpLost
      slipToday = { empty: gone.day, leader, wild: wildBack, xp: xpLost }
      moments.push({ kind: 'slip', day: f.day, ...slipToday })
    }
    dayStart = { uid: partner.uid, xp: partner.xp }

    const pillarTotal = f.habits.filter((h) => h.pillar).length
    const doneAll = f.habits.filter((h) => h.pillar && (h.frac >= 1 || h.done))
    // version 15: Sleep alone does not make a day. With no other pillar done, the day has none (a night's rest still pays its XP)
    const pillars = v15On(f.day) && !doneAll.some((h) => h.tag !== 'sleep') ? 0 : doneAll.length
    const needed = Math.min(PILLARS_FOR_A_DAY, pillarTotal)
    const counts = needed > 0 && pillars >= needed
    // a perfect day is everything you can still do today: last night's measured sleep pays XP, but cannot spoil it
    const yours = f.habits.filter((h) => !h.measured)
    const done = yours.filter((h) => h.done).length
    const total = yours.length
    const perfect = total > 0 && done === total
    const ticked = total > 0 ? done / total : 0

    // momentum looks back, so the multiplier is known the moment the day starts
    const back = days.slice(Math.max(0, i - MOMENTUM_WINDOW), i)
    const mDays = back.filter((d) => d.counts).length
    const mult = momentumMult(mDays)
    momentum = { days: mDays, mult }

    // dozing: nothing at all on the last two days, and nothing yet today
    const dry = days.length >= SLEEP_AFTER && days.slice(-SLEEP_AFTER).every((d) => d.pillars === 0)
    if (pillars > 0) partner.together = (partner.together ?? 0) + 1
    // version 13: a heart for every pillar done as partner, not one a day (the days together are still counted on their own), and one more with a Shell Bell
    if (v13 && pillars > 0) partner.fed = (partner.fed ?? 0) + (pillars - 1) + (partner.held === 'shell-bell' ? 1 : 0)
    asleep = dry && pillars === 0

    const base = f.habits.reduce((s, h) => s + h.worth * h.frac, 0)
    const full = f.habits.reduce((s, h) => s + h.worth, 0)
    // version 13: best friends (bond level 4) earn a tenth more
    const bondNow = bondLevel(heartsOf(partner))
    const xp = Math.round(base * mult * (v13 && hasPerk(bondNow, 'friends') ? FRIENDS_XP : 1))
    let mine = raised.get(partner.uid)
    if (!mine) raised.set(partner.uid, (mine = emptyShare()))
    for (const h of f.habits) {
      stage[h.tag].got += h.worth * h.frac
      stage[h.tag].max += h.worth
      mine[h.tag].got += h.worth * h.frac
      mine[h.tag].max += h.worth
    }
    // the field notes: each domain in its own unit
    if (f.habits.some((h) => h.tag === 'code' && h.pillar && h.frac >= 1)) notes.codeDays++
    if (f.habits.some((h) => h.tag === 'arbor' && h.frac >= 1)) notes.arborDays++
    if (f.habits.some((h) => h.tag === 'guitar' && h.frac >= 1)) notes.guitarDays++
    notes.workouts += f.marks?.workouts ?? 0
    notes.records += f.marks?.records ?? 0
    notes.clean += f.marks?.clean ?? 0
    notes.owned += f.marks?.owned ?? 0
    // Strong: each routine in the split drops its own piece of gear; one of all seven turns into a Red Shard
    for (const routine of f.marks?.gear ?? []) {
      const piece = GEAR[routine]
      if (!piece) continue
      inv[piece] = (inv[piece] ?? 0) + 1
      moments.push({ kind: 'gear', day: f.day, item: piece })
    }
    while (GEAR_ITEMS.every((g) => (inv[g] ?? 0) > 0)) {
      for (const g of GEAR_ITEMS) inv[g]--
      bump('sets')
      earn(0, GEMS.kit)
      // every third full set is a Red Shard; the others pay Iron, so a set is never nothing
      const shard = cn.sets % KIT_SHARD_EVERY === 0
      if (shard) inv['red-shard'] = (inv['red-shard'] ?? 0) + 1
      else { wallet.marks.fitness += KIT_IRON; wallet.marksToday.fitness += KIT_IRON }
      moments.push({ kind: 'kit', day: f.day, n: cn.sets, shard })
    }
    if (typeof f.body?.steps === 'number') {
      notes.steps += Math.max(0, Math.min(STEPS_GOAL, f.body.steps))
      notes.stepDays++
    }
    // each domain's own unit-day pays one mark, and counts toward feats and runs
    const did = (t: Tag): boolean => f.habits.some((h) => h.tag === t && (h.frac >= 1 || h.done))
    const unit: Record<MarkTag, boolean> = {
      code: did('code'), fitness: did('fitness') || (f.marks?.workouts ?? 0) > 0, guitar: did('guitar'), arbor: did('arbor'),
      sleep: f.habits.some((h) => h.tag === 'sleep' && h.measured === true && h.done),
    }
    for (const t of MARK_TAGS) {
      if (!unit[t]) continue
      bump(`days:${t}`)
      runDay(t, f.day)
      wallet.marks[t]++; wallet.marksToday[t]++
    }
    if (counts) runDay('work', f.day)
    if (pillarTotal > 0 && pillars >= Math.min(3, pillarTotal)) runDay('work3', f.day)
    const extra = (t: MarkTag, n: number) => { wallet.marks[t] += n; wallet.marksToday[t] += n }
    extra('fitness', MARK_RECORD * (f.marks?.records ?? 0))
    // a day of 10,000 steps pays an Iron mark of its own, whatever else the day was
    if (typeof f.body?.steps === 'number' && f.body.steps >= STEPS_GOAL) { extra('fitness', 1); bump('walk') }
    extra('guitar', MARK_OWNED * (f.marks?.owned ?? 0))
    // a deep night (90 or more) pays a second Bell
    if (unit.sleep && (f.body?.sleepScore ?? 0) >= SLEEP_DEEP) extra('sleep', 1)
    // 90 minutes or more of deep sleep pays a Bell of its own, whatever the score
    if (f.day >= DEEP_SLEEP_FROM && typeof f.body?.sleepScore === 'number' && (f.body.deepMin ?? 0) >= DEEP_SLEEP_MIN) { extra('sleep', 1); bump('deep') }

    const share = full > 0 ? base / full : 0
    const ball = ballFor(ticked)
    const amulet = inv['amulet-coin'] ? AMULET_MULT : 1
    // coins for showing up: the best bar the day's ticks reached
    const pay = [...DAILY_PAY].reverse().find((t) => ticked >= t.share)?.coins ?? 0
    // two days running at the streak bar adds a little on top
    const prevDay = days[days.length - 1]
    const streak = pay > 0 && ticked >= PAY_STREAK.share && prevDay && prevDay.ticked >= PAY_STREAK.share ? PAY_STREAK.coins : 0
    hold(`pay:${f.day}`, f.day, streak ? 'Showing up, again' : 'Showing up', Math.round((pay + streak) * amulet), 0)
    const result: DayResult = { day: f.day, base: Math.round(base), mult, xp, pillars, pillarTotal, done, total, counts, perfect, share, ticked, ball, hit: 0, strike: 0, pay }
    days.push(result)

    // ── how much: the partner's XP ──
    gain(xp, f.day)
    if (v13 && xp > 0) {
      // bond level 5: everyone in the party still being raised gets a share; an Exp. Share held gives the next one up a fifth
      // version 14: everyone below the last level, the fully trained as well, and never past it
      const v14d = v14On(f.day)
      if (hasPerk(bondNow, 'share')) for (const m of teamNow()) if ((v14d ? levelOf(m.xp) < MAX_LEVEL : !m.graduated) && m.uid !== partner.uid) m.xp = v14d ? Math.min(xpForLevel(MAX_LEVEL), m.xp + Math.round(xp * SHARE_XP)) : m.xp + Math.round(xp * SHARE_XP)
      if (partner.held === 'exp-share') {
        const next = (chosenNext && queue.find((m) => m.uid === chosenNext)) || queue[0]
        if (next) next.xp += Math.round(xp * 0.2)
      }
    }
    // version 14: on a day with a pillar the Professor studies whoever is on the desk; each rank takes HP off every wild Pokemon to come, and pays
    research.today = 0
    if (v14On(f.day) && pillars > 0) {
      // version 15: the party studies too, at a share of a desk place, so research runs before there is anyone to spare for the desk
      const onDesk = new Set(deskNow().map((m) => m.uid))
      research.today = studyOf(deskNow()) + (v15On(f.day) ? Math.round(RESEARCH_PARTY * studyOf(teamNow().filter((m) => !onDesk.has(m.uid) && m.uid !== partner.uid))) : 0)
      research.points += research.today
      while (research.points >= researchCost(research.rank)) {
        research.points -= researchCost(research.rank)
        research.rank++
        const r = researchReward(research.rank)
        hold(`research:${research.rank}`, f.day, `Research rank ${research.rank}`, r.coins ?? 0, r.gems ?? 0, r.items)
        moments.push({ kind: 'research', day: f.day, rank: research.rank })
      }
    }

    // ── how many: the wild Pokemon ──
    // stakes: one that has stayed its days is gone by morning, and the next one stands in its place
    if (stakes && wild && !wild.caught && dayGap(wild.from, f.day) >= WILD_STAY[wild.rarity] + (wild.repel ?? 0)) {
      moments.push({ kind: 'flee', day: f.day, form: wild.form, rarity: wild.rarity })
      fledToday = wild.form
      bump('fled')
      wild = null
    }
    if (!wild) {
      spawns++
      const want = spawns % LEGENDARY_EVERY_WILD === 0 ? 'L' : 'any'
      // incense: the one that was chosen turns up
      const form = wishFor ?? roll(`wild:${f.day}`, want)
      wishFor = null
      const rarity = (rec(form).r ?? 'C') as Rarity
      // version 14: what the Professor has learnt takes some of its HP off before it is met
      const wildHp = Math.round(WILD_HP[rarity] * (v14On(f.day) ? 1 - researchCut(research.rank) : 1))
      wild = { form, rarity, hp: wildHp, max: wildHp, from: f.day, shiny: false, caught: false }
      see(form, f.day, false, false)
      moments.push({ kind: 'appear', day: f.day, form, rarity })
    }
    const w: Wild = wild
    result.hit = perfect ? w.hp : Math.min(w.hp, Math.round(wildHit(ticked, BALL_MULT[ball]) * (v13 && partner.held === 'quick-claw' ? 1.25 : 1)))
    w.hp -= result.hit
    if (w.hp <= 0) {
      const shiny = perfect ? rng(`shiny:${f.day}`)() < 1 / SHINY_ODDS : rng(`shiny-worn:${f.day}`)() < 1 / (inv['lucky-egg'] ? SHINY_ODDS_WORN / 2 : SHINY_ODDS_WORN)
      catchWild(w, f.day, shiny, ball, perfect ? 'perfect' : 'worn') // the next one appears tomorrow morning
    }
    if (perfect) { perfectDays++; earn(0, GEMS.perfect) }

    // ── what kind: the gym leader ──
    // version 13: every league beaten, so the Rematch begins: Kanto again, one rank up
    if (v13 && lg.index >= LEAGUES.length) {
      lg.lap++
      lg.index = 0
      lg.slot = 0
      lg.slipped = 0
      freshLeader(f.day)
      moments.push({ kind: 'lap', day: f.day, lap: lg.lap })
    }
    // version 13: today's X items and Dire Hits, used before the day's work
    const boost: Partial<Record<Tag, number>> = {}
    let critAdd = 0
    if (v13) for (const u of f.uses ?? []) {
      if (u.what !== 'boost' || !inv[u.item]) continue
      const b = BOOST[u.item]
      if (b) { inv[u.item]--; boost[b.tag] = Math.max(boost[b.tag] ?? 0, b.add) }
      else if (DIRE_HIT[u.item]) { inv[u.item]--; critAdd = Math.max(critAdd, DIRE_HIT[u.item]) }
    }
    if (Object.keys(boost).length) result.boost = boost
    const megaDay = !partner.megas?.length && mDays >= MOMENTUM_WINDOW && pillarTotal > 0 && pillars === pillarTotal
    const leader = leaderOf(lg.index, lg.slot)
    if (leader && leagueOpen()) {
      const weak = weakDomains(leader.type)
      const edge = beats(typesOf(partner), leader.type)
      // the team, the bond, a Mega, the held item, mastery and natures are all added, then applied once (see Power)
      const pw = powerOf(v13, v14On(f.day))
      // version 13: the partner's level, a Mega for the day, and an Expert Belt against a leader its type beats
      const common = pw.team + pw.bond + pw.mega + pw.item + pw.level + (v13 && megaDay ? MEGA_DAY : 0) + (v13 && edge && partner.held === 'expert-belt' ? 0.2 : 0) + (partner.held && PLATES[partner.held]?.type === leader.type ? PLATE_BONUS : 0)
      let strike = 0
      for (const h of f.habits) {
        const d = pw.domain[h.tag]
        strike += h.worth * h.frac * (weak.includes(h.tag) ? WEAK_MULT : 1) * (edge ? ADVANTAGE_MULT : 1) * (1 + common + d.held + d.mastery + d.nature + d.vitamin + (boost[h.tag] ?? 0))
      }
      if (v13 && strike > 0) {
        // a critical hit: the bond's Focus (level 3), the Scope Lens, and today's Dire Hit
        const chance = (hasPerk(bondNow, 'focus') ? CRIT_BASE : 0) + (partner.held === 'scope-lens' ? 0.1 : 0) + critAdd
        if (chance > 0 && rng(`crit:${f.day}`)() < chance) { strike *= CRIT_MULT; result.crit = true; bump('crits') }
        // a perfect day Dynamaxes the partner; one with a Gigantamax form hits harder still
        if (perfect) {
          const g = Boolean(rec(partner.form).gm)
          strike *= g ? GIGANTAMAX : DYNAMAX
          result.max = g ? 'gigantamax' : 'dynamax'
          bump('dynamax')
        }
      }
      result.strike = Math.min(lg.hp, Math.round(strike))
      lg.hp -= result.strike
      if (lg.hp <= 0) {
        const l = LEAGUES[lg.index]
        const gym = isGym(lg.index, lg.slot)
        const champ = kindAt(lg.index, lg.slot) === 'champion'
        earn(0, gym ? GEMS.gym : GEMS.elite)
        // a badge is won once; a Rematch win pays Battle Points instead, and a Rematch Champion a Legend key
        if (gym && lg.lap === 0) bump('badges')
        // the Elite Four and the Champions hand over a Type Plate, once each, never a badge
        if (!gym && lg.lap === 0) {
          const plate = plateFor(`${lg.index}:${lg.slot}`, platesGot)
          if (plate) {
            platesGot.add(plate)
            hold(`elite:${lg.index}:${lg.slot}`, f.day, `${lineup(l)[lg.slot].name}: ${PLATES[plate].name}`, 0, 0, [[plate, 1]])
          }
        }
        if (lg.lap > 0) {
          bpEarn(REMATCH_BP * (champ ? 5 : 1))
          if (champ) {
            const key = REMATCH_KEYS[((lg.lap - 1) * LEAGUES.length + lg.index) % REMATCH_KEYS.length]
            hold(`rematch:${lg.lap}:${lg.index}`, f.day, `Rematch: ${l.name} Champion`, 0, 0, [[key, 1]])
            bump('rematch')
          }
        }
        moments.push({ kind: 'gym', day: f.day, league: lg.index, slot: lg.slot })
        lg.slot++
        lg.slipped = 0
        if (lg.slot < lineup(l).length) freshLeader(f.day)
        if (lg.slot >= lineup(l).length) {
          earn(0, GEMS.league)
          moments.push({ kind: 'league', day: f.day, league: lg.index })
          hall.push({
            league: lg.index, lap: lg.lap, day: f.day, partner: { form: partner.form, shiny: partner.shiny },
            team: graduates.slice(-5).reverse().map((m) => ({ form: m.form, shiny: m.shiny })),
            stats: statsOf(facts.slice(0, i + 1)),
          })
          if (l.region !== null && lg.lap === 0) lg.beaten++
          lg.index++
          lg.slot = 0
          if (lg.index < LEAGUES.length) freshLeader(f.day)
          else if (!v13) lg.hp = LEADER_HP
          reopen(f.day)
        }
      }
    }

    // ── the week, the season, quests ──
    const wk = weekOf(f.day)
    weekXp[wk] = (weekXp[wk] ?? 0) + Math.round(base)
    if (counts) weekDays[wk] = (weekDays[wk] ?? 0) + 1
    // the season: every SEASON_STEP XP of the month's work is a step, and the step hands something over
    const ym = f.day.slice(0, 7)
    monthXp[ym] = (monthXp[ym] ?? 0) + Math.round(base)
    while ((monthStep[ym] ?? 0) < Math.floor(monthXp[ym] / SEASON_STEP)) {
      const step = (monthStep[ym] = (monthStep[ym] ?? 0) + 1)
      const r = seasonReward(step)
      hold(`season:${ym}:${step}`, f.day, `Season step ${step}`, r.coins ?? 0, r.gems ?? 0, r.item ? [[r.item, 1]] : [])
      moments.push({ kind: 'season', day: f.day, step, coins: r.coins ?? 0, gems: r.gems ?? 0, item: r.item ?? '' })
    }

    // ── the weekly boss: the card's work, taken off its HP ──
    if (boss && (!f.boss || f.boss.card.week !== boss.card.week)) closeBoss(f.day)
    if (f.boss && !boss && !bossWeeks.has(f.boss.card.week)) {
      const card = f.boss.card
      bossWeeks.add(card.week)
      boss = { card, from: f.day, taken: 0, dealt: 0, work: 0, p: card.tasks.map(() => 0), throws: 0, killed: false, caught: false, fled: false, paid: new Set(), done: new Set(), strike: 0, common: 0 }
      see(card.form, f.day, false, false)
      moments.push({ kind: 'boss', day: f.day, week: card.week, form: card.form, level: card.level, what: 'appear' })
    }
    if (boss && f.boss) {
      const b: BossRun = boss
      const members = [partner, ...teamNow()]
      const party: Member[] = members.map((m) => ({ level: levelOf(m.xp), rarity: rec(m.base).r ?? 'C', mega: Boolean(m.megas?.length) }))
      const pw = powerOf()
      const type = rec(b.card.form).t
      b.strike = strikeOf(party, b.card)
      b.common = pw.team + pw.bond + pw.mega + pw.item + TYPE_EDGE * members.filter((m) => beats(typesOf(m), type)).length + (v13 && partner.held === 'rocky-helmet' ? 0.2 : 0)
      const work = cardWork(b.card, f.boss.p)
      const moved = work - b.work
      if (!b.caught && !b.fled) {
        // progress takes HP (and work undone gives it back); a day with none lets it heal
        if (Math.abs(moved) > 1e-9) b.dealt += b.strike * (1 + b.common) * moved
        else if (f.day > b.from && !b.killed) b.dealt -= BOSS_HEAL
        b.dealt = Math.max(0, b.dealt)
        // the last of its HP only falls once every task is done; what was dealt past the cap still counts then
        b.taken = Math.min(cardDone(b.card, f.boss.p) ? 1 : KILL_CAP, b.dealt)
      }
      b.work = work
      b.p = f.boss.p
      // a finished task pays in its own kind
      b.card.tasks.forEach((t, k) => {
        if ((b.p[k] ?? 0) < 1 || b.done.has(k)) return
        b.done.add(k)
        const tag = BOSS_TAG[t.kind]
        if (isMarkTag(tag)) { wallet.marks[tag] += BOSS_TASK_MARKS; wallet.marksToday[tag] += BOSS_TASK_MARKS }
        else hold(`boss:${b.card.week}:task${k}`, f.day, 'Boss task done', BOSS_TASK_COINS, 0)
      })
      BOSS_MILESTONES.forEach((m, k) => {
        if (b.taken + 1e-9 < m.at || b.paid.has(k)) return
        b.paid.add(k)
        hold(`boss:${b.card.week}:${Math.round(m.at * 100)}`, f.day, `Boss at ${Math.round((1 - m.at) * 100)}% HP`, m.coins ?? 0, m.gems ?? 0, m.items ?? [])
      })
      if (b.taken >= 1 - 1e-9 && !b.killed) {
        b.killed = true
        const shard = isMarkTag(BOSS_TAG[hardest(b.card).kind]) ? MARKS[BOSS_TAG[hardest(b.card).kind] as MarkTag].shard : undefined
        hold(`boss:${b.card.week}:kill`, f.day, 'Boss beaten', 0, BOSS_KILL_GEMS, [...(shard ? [[shard, 1] as [string, number]] : []), ['rare-egg', 1] as [string, number]])
        bump('bosskills')
        moments.push({ kind: 'boss', day: f.day, week: b.card.week, form: b.card.form, level: b.card.level, what: 'kill' })
      }
    }

    /** the week's quests, paid as soon as they are met: before the day's own actions as well as after, so what was won this evening can be collected this evening */
    const payQuests = () => {
      const met: Record<string, boolean> = { 'five-days': (weekDays[wk] ?? 0) >= WEEK_DAYS, catch: (weekCatch[wk] ?? 0) >= 1 }
      for (const q of WEEKLY_QUESTS) {
        if (!met[q.id] || paid.has(`${wk}:${q.id}`)) continue
        paid.add(`${wk}:${q.id}`)
        const coins = Math.round((q.coins ?? 0) * amulet)
        hold(`quest:${wk}:${q.id}`, f.day, q.name, coins, q.gems ?? 0)
        moments.push({ kind: 'quest', day: f.day, id: q.id, name: q.name, coins, gems: q.gems ?? 0 })
      }
    }
    // ── version 13: Pickup, and the Battle Frontier ──
    if (v13 && pillars > 0 && hasPerk(bondNow, 'pickup')) {
      const chance = Math.min(0.95, (PICKUP_BASE + PICKUP_STEP * (bondNow - 1)) * (partner.held === 'lucky-punch' ? 2 : 1))
      if (rng(`pickup:${f.day}`)() < chance) {
        const tier = Math.min(PICKUP_TIERS, Math.floor(lg.index / 2) + lg.lap)
        const found = pickupFind(`pickup-item:${f.day}`, tier)
        inv[found] = (inv[found] ?? 0) + 1
        result.find = found
        bump('pickups')
        moments.push({ kind: 'pickup', day: f.day, item: found, form: partner.form })
      }
    }
    if (v13) {
      const won: Record<string, boolean> = { tower: counts, code: unit.code, fitness: unit.fitness, guitar: unit.guitar, arbor: unit.arbor, sleep: unit.sleep, perfect }
      for (const fac of FACILITIES) {
        if (!won[fac.win]) continue
        const r = fr[fac.id]
        r.cur = fac.gap === 0 || (r.last && dayGap(r.last, f.day) <= fac.gap) ? r.cur + 1 : 1
        r.last = f.day
        r.wins++
        r.best = Math.max(r.best, r.cur)
        bpEarn(bpFor(r.cur, fac.gap === 0))
        const reach = fac.gap === 0 ? r.wins : r.cur
        if (reach >= fac.silver && !r.silver) {
          r.silver = f.day
          bpEarn(SILVER_BP)
          hold(`symbol:${fac.id}:silver`, f.day, `${fac.name}: Silver Symbol`, 0, SILVER_GEMS, [[fac.silverItem, 1]])
          bump('symbols')
          moments.push({ kind: 'symbol', day: f.day, facility: fac.id, tier: 'silver' })
        }
        if (reach >= fac.gold && !r.gold) {
          r.gold = f.day
          bpEarn(GOLD_BP)
          hold(`symbol:${fac.id}:gold`, f.day, `${fac.name}: Gold Symbol`, 0, GOLD_GEMS, [[fac.goldKey, 1]])
          bump('golds')
          moments.push({ kind: 'symbol', day: f.day, facility: fac.id, tier: 'gold' })
        }
      }
    }

    payQuests()
    evalFeats(f.day)
    for (const u of f.uses ?? []) {
      spend(u, f.day)
      payQuests()
      evalFeats(f.day)
    }

    // an egg: one kept warm at a time, a day nearer on each day with two pillars
    if (!egg && inv['rare-egg']) { inv['rare-egg']--; egg = { have: 0, since: f.day } }
    else if (egg) egg.have += Math.max(0, Math.min(STEPS_GOAL, f.body?.steps ?? 0))
    if (egg && egg.have >= (inv['old-charm'] ? EGG_STEPS_OLD_CHARM : EGG_STEPS)) {
      bump('hatched')
      const mon = make(roll(`rare-egg:${f.day}`, 'R'), 'egg', f.day)
      queue.push(mon)
      see(mon.form, f.day, false)
      moments.push({ kind: 'hatch', day: f.day, uid: mon.uid, form: mon.form })
      egg = null
    }

    payQuests()
    // feats last, so everything the day did is counted
    evalFeats(f.day)

    // temporary forms, for whoever is the partner at the end of the day
    display = partner.form
    aura = null
    const r = rec(partner.form)
    const show = (form: string, what: 'mega' | 'gmax') => {
      display = form
      if (!dex[form]) moments.push({ kind: 'form', day: f.day, uid: partner.uid, form, what })
      see(form, f.day, partner.shiny)
    }
    if (partner.megas?.length) {
      // registered for good: drawn every day, unless the plain form was asked for
      if (partner.show !== 'base') {
        aura = 'mega'
        show(partner.show && partner.megas.includes(partner.show) ? partner.show : partner.megas[0], 'mega')
      }
    } else if (megaDay) {
      // full momentum and every pillar done today: Mega on its own, for the day
      aura = 'mega'
      if (r.m?.length) {
        // X for a week led by the gym, Y for one led by code or guitar
        const week = emptyShare()
        for (const d of facts.slice(Math.max(0, i - MOMENTUM_WINDOW), i))
          for (const h of d.habits) { week[h.tag].got += h.worth * h.frac; week[h.tag].max += h.worth }
        const fit = ratio(week, 'fitness') >= Math.max(ratio(week, 'code'), ratio(week, 'guitar'))
        show(r.m.length > 1 && !fit ? r.m[1] : r.m[0], 'mega')
      }
    }
    if (perfect) {
      aura = 'gmax'
      if (r.gm) show(r.gm, 'gmax')
    }
  })

  const last = days[days.length - 1]
  /** This week's boss as the screens show it: only while the last day is still inside its week. */
  const bossView = (): BossView | null => {
    const b = boss
    if (!b || !last || weekOf(last.day) !== b.card.week) return null
    const max = b.card.level * BOSS_HP_PER_LEVEL
    const hpLeft = Math.max(0, 1 - b.taken)
    return {
      week: b.card.week, species: b.card.species, form: b.card.form, rarity: b.card.rarity, mega: b.card.mega, level: b.card.level,
      max, hp: Math.round(hpLeft * max), taken: b.taken, hpLeft, strike: b.strike, common: b.common,
      tasks: b.card.tasks.map((t, k) => ({ ...t, p: b.p[k] ?? 0 })), allDone: cardDone(b.card, b.p),
      daysLeft: Math.max(0, 6 - dayGap(b.card.week, last.day)),
      throws: b.throws, throwsLeft: Math.max(0, THROWS - b.throws),
      canThrow: !b.caught && !b.fled && b.throws < THROWS && hpLeft <= THROW_AT + 1e-9,
      trained: trainedTeam().length, killed: b.killed, caught: b.caught, fled: b.fled,
    }
  }
  // the quests as they stand today
  const lastFacts = facts[facts.length - 1]
  const wkNow = last ? weekOf(last.day) : ''
  const progress: Record<string, [number, number]> = { 'five-days': [weekDays[wkNow] ?? 0, WEEK_DAYS], catch: [weekCatch[wkNow] ?? 0, 1] }
  const quest = (key: string) => (q: (typeof WEEKLY_QUESTS)[number]): Quest => ({
    id: q.id, name: q.name, coins: q.coins ?? 0, gems: q.gems ?? 0, done: paid.has(`${key}:${q.id}`),
    have: Math.min(progress[q.id][0], progress[q.id][1]), need: progress[q.id][1],
  })
  const team = teamNow()
  const leaderNow = leaderOf(lg.index, lg.slot)
  // a pillar the game takes for a chore: its domain was never set
  const warnings = (lastFacts?.habits ?? [])
    .filter((h) => h.pillar && h.tag === 'routine')
    .map((h) => `${h.name ?? h.id} is a pillar with no domain, so it counts as a chore for the gym leaders, branching and natures. Set its domain in Life OS.`)
  let shown: Wild | null = caughtToday ?? wild
  if (last && last.day >= STAKES_FROM) {
    const sw = shown as Wild | null
    if (sw && !sw.caught) shown = { ...sw, leavesIn: Math.max(0, WILD_STAY[sw.rarity] + (sw.repel ?? 0) - 1 - dayGap(sw.from, last.day)) }
  }

  const level = levelOf(partner.xp)
  const stages = stagesOf(partner)
  const evo = evolveAt(stages, rec(partner.form).s)
  const canEvolve = evo !== null && Boolean(rec(partner.form).e?.length)
  const floor = level <= 1 ? 0 : xpForLevel(level)
  // today's share of the bar: from where the partner stood this morning, but never below this level's floor
  const before = dayStart.uid === partner.uid ? dayStart.xp : 0

  // which way a branching partner is leaning, so the choice its habits are making can be seen
  const pr = rec(partner.form)
  let lean: Game['lean'] = []
  if (canEvolve && pr.bt && (pr.e?.length ?? 0) > 1) {
    const scores = branchScores(partner).map((s) => Math.max(0, s))
    const sum = scores.reduce((a, b) => a + b, 0)
    lean = pr.e!.map((form, k) => ({ form, tag: pr.bt![k], pct: Math.round(sum > 0 ? (scores[k] / sum) * 100 : 100 / pr.e!.length) }))
    if (partner.pick) lean = lean.map((x) => ({ ...x, pct: x.form === partner.pick ? 100 : 0 }))
    lean.sort((a, b) => b.pct - a.pct)
  }

  const bondLvl = bondLevel((partner.together ?? 0) + (partner.fed ?? 0))
  return {
    partner,
    level,
    into: partner.xp - floor,
    intoBeforeToday: Math.min(partner.xp, Math.max(floor, before)) - floor,
    need: xpForLevel(level + 1) - floor,
    next: canEvolve ? { level: evo as number, what: 'evolve' } : partner.graduated ? { level: MAX_LEVEL, what: 'master' } : { level: graduateAt(stages), what: 'graduate' },
    lean,
    display,
    aura,
    asleep,
    queue,
    nextUp: (chosenNext && queue.some((m) => m.uid === chosenNext) ? chosenNext : queue[0]?.uid) ?? null,
    graduates,
    dex,
    days,
    today: last ?? { day: '', base: 0, mult: 1, xp: 0, pillars: 0, pillarTotal: 0, done: 0, total: 0, counts: false, perfect: false, share: 0, ticked: 0, ball: 'poke', hit: 0, strike: 0, pay: 0 },
    momentum,
    perfectDays,
    regions,
    league: {
      index: lg.index, slot: lg.slot, hp: leaderNow ? lg.hp : 0, max: lg.max,
      weak: leaderNow ? weakDomains(leaderNow.type) : [],
      edge: leaderNow ? beats(typesOf(partner), leaderNow.type) : false,
      waiting: Boolean(leaderNow) && !leagueOpen(),
      beaten: lg.beaten,
      slipped: lg.slipped,
      lap: lg.lap,
    },
    hall,
    wallet,
    held: [...held.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)),
    inv,
    theme,
    team,
    power: powerOf(Boolean(last && v13On(last.day)), Boolean(last && v14On(last.day))),
    quests: last ? { weekly: WEEKLY_QUESTS.map(quest(wkNow)) } : { weekly: [] },
    season: (() => {
      const ym = last ? last.day.slice(0, 7) : ''
      const xp = monthXp[ym] ?? 0, step = monthStep[ym] ?? 0
      return { month: ym, step, into: xp - step * SEASON_STEP, need: SEASON_STEP, next: seasonReward(step + 1) }
    })(),
    egg: egg ? { since: (egg as { since: string }).since, have: Math.min((egg as { have: number }).have, inv['old-charm'] ? EGG_STEPS_OLD_CHARM : EGG_STEPS), need: inv['old-charm'] ? EGG_STEPS_OLD_CHARM : EGG_STEPS } : null,
    wish: { options: Object.fromEntries(['full-incense', ...Object.keys(LURES)].map((id) => [id, wishOptions(id === 'full-incense' ? null : LURES[id])])), chosen: wishFor },
    sleep: (() => {
      const h = lastFacts?.habits.find((x) => x.id === SLEEP_HABIT && x.tag === 'sleep')
      return { band: facts.some((f) => f.habits.some((x) => x.measured) || typeof f.body?.sleepScore === 'number'), state: h?.measured ? 'measured' as const : h?.selfReported ? 'self' as const : 'off' as const, score: typeof lastFacts?.body?.sleepScore === 'number' ? lastFacts.body.sleepScore : null, xp: h ? Math.round(h.worth * h.frac) : 0 }
    })(),
    mart: { deals: last ? martDeals(last.day, dealsFor(inv)) : [], bought: last ? [...sold].filter((k) => k.startsWith(last.day + ':')).map((k) => k.slice(11)) : [], standing: STANDING },
    mastery: { ...mastery },
    bond: { level: bondLvl, mult: 1 + BOND_STEP * bondLvl },
    runs: Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, { cur: last && dayGap(r.last, last.day) <= 2 ? r.cur : 0, best: r.best }])),
    counters: cn,
    feats,
    keyStone,
    fled: fledToday,
    slip: slipToday,
    boss: bossView(),
    bossLog,
    // version 13: the boss comes once the party is six, whoever stands in it; the fully trained still make a throw more likely
    bossParty: 1 + (last && v13On(last.day) ? teamNow().length : trainedTeam().length),
    bossTrained: trainedTeam().length,
    notes,
    warnings,
    stats: statsOf(facts),
    moments,
    wild: shown,
    frontier: FACILITIES.map((x) => {
      const r = fr[x.id]
      const alive = x.gap === 0 || (last && r.last && dayGap(r.last, last.day) <= x.gap)
      return { id: x.id, cur: alive ? r.cur : 0, best: r.best, wins: r.wins, silver: r.silver, gold: r.gold }
    }),
    guard,
    endure: { ready: !lastEndure || !last || dayGap(lastEndure, last.day) >= ENDURE_DAYS, from: lastEndure ? addDays(lastEndure, ENDURE_DAYS) : null },
    v13: Boolean(last && v13On(last.day)),
    v14: Boolean(last && v14On(last.day)),
    research: { rank: research.rank, points: research.points, need: researchCost(research.rank), desk: deskNow(), chosen: deskPick !== null, perDay: studyOf(deskNow()), today: research.today, cut: researchCut(research.rank) },
  }
}

/** The trainer's own six numbers, from what was actually done and measured over the last STAT_DAYS days. */
export function statsOf(facts: DayFacts[]): Stats {
  const recent = facts.slice(-STAT_DAYS)
  const share = (tag: Tag): number | null => {
    let got = 0, max = 0
    for (const d of recent) for (const h of d.habits) if (h.tag === tag) { got += h.worth * h.frac; max += h.worth }
    return max > 0 ? Math.round((got / max) * 100) : null
  }
  const mean = (xs: number[]): number | null => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const recovery = recent.flatMap((d) => (typeof d.body?.recovery === 'number' ? [d.body.recovery] : []))
  // HP is the average of the nights the band measured; a night it did not is left out, not counted as nothing
  const nights = recent.flatMap((d) => (typeof d.body?.sleepScore === 'number' ? [d.body.sleepScore] : []))
  const steps = recent.flatMap((d) => (typeof d.body?.steps === 'number' ? [Math.min(100, (d.body.steps / STEPS_GOAL) * 100)] : []))
  return {
    hp: nights.length ? mean(nights) : share('sleep'),
    atk: share('fitness'),
    // recovery once the band reports it; the morning mobility block stands in until then
    def: recovery.length ? mean(recovery) : share('arbor'),
    spa: share('code'),
    spd: share('guitar'),
    spe: mean(steps),
  }
}

/** Where a sprite lives under the Pokedex site: animated when there is one, a still otherwise. */
export function spritePath(form: string, shiny = false): string {
  const still = SPECIES[form]?.st === 1
  return `/sprites/${still ? 'static' : 'ani'}${shiny ? '-shiny' : ''}/${form}.${still ? 'png' : 'gif'}`
}

export const nameOf = (form: string): string => SPECIES[form]?.n ?? form
