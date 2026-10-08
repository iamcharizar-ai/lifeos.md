// The whole game, as one pure function of the days so far.
//
// Nothing here is stored anywhere: partner, Box, collection, the wild Pokemon,
// the league and the Bag are recomputed from the day list every time, which is
// why two devices (and two apps) always show the same thing.
//
// A day's work does three different things:
//   how MUCH you did      → the partner's XP
//   how WHOLE the day was → the wild Pokemon's HP (catching)
//   what KIND of work     → the gym leader's HP (the league)
import type { DayFacts } from './facts.ts'
import { addDays } from './facts.ts'
import { LEAGUES, lineup, type Leader } from './gyms.ts'
import {
  ADVANTAGE_MULT, BADGE_DAYS, BALL_MULT, CATCH_WEIGHTS, CHEST, DAILY_QUESTS, EGG_DAYS, GEMS, KEY_STONE_BADGES, LEADER_HP, LEGENDARY_EVERY, LEGENDARY_EVERY_WILD, MEGA_DAYS, MILESTONE_STONES,
  MOMENTUM_WINDOW, NATURES, NATURE_DOMAIN, NATURE_STATS, PILLARS_FOR_A_DAY, RARE_EVERY, SHINY_EVERY, SHINY_ODDS, SLEEP_AFTER, START_SPECIES, STAT_DAYS, STEPS_GOAL, STONE_FOR_TAG, TAGS, TEAM_BONUS, TEAM_SIZE, THROW_HP, V3_START, V4_START, V5_START, V6_START, WEEKLY_QUESTS, WEEK_DAYS, WEEK_XP,
  SEASON_STEP, WEAK_MULT, WILD_HP, SHOP, ballFor, isShopItem, seasonReward, evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, regionsOpenV2, rulesOn, wildHit, wildHit5, xpForLevel,
  type Ball, type NatureStat, type Rarity, type Tag,
} from './rules.ts'
import { SPECIES, type SpeciesRec } from './species.ts'
import {
  BALLS, CHEST6, DAILY_QUESTS6, EGG_DAYS_OLD_CHARM, FEATS, FORGE_COST, HELD, LURES, MARK_OWNED, MARK_RECORD, MARK_TAGS, ONCE, SELL, TM_SLOTS, WEEKLY_QUESTS6,
  ballClass, dayGap, forgeShard, heldMult, isMarkTag, lureTypes, martDeals, offerFor, rng, seasonReward6, throwHp, tmType,
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
  origin: 'starter' | 'catch' | 'egg'
  /** day it was caught or hatched */
  from: string
  /** day it became the partner */
  started?: string
  graduated?: string
  /** still true if it never dozed off while it was the partner. From version 4 it cannot be lost */
  bond: boolean
  /** days it was the partner on which at least one pillar was done. Only ever counts up */
  together?: number
  /** every form it has been, oldest first */
  path: string[]
  /** a stone was spent on a Mega Evolution: the form, and the last day it lasts */
  mega?: { form: string; until: string }
  /** how it will evolve, when that was chosen by hand */
  pick?: string
  /** version 4: Mega forms it has registered for good */
  megas?: string[]
  /** which form to draw once it has one registered: 'base', or one of `megas`. Absent = the first Mega */
  show?: string
  /** the ball it was caught in: the chores of that day */
  ball?: Ball
  /** version 5: berries it was fed. With `together` they are its hearts */
  fed?: number
  /** given when it finished training, from what it was raised on */
  nature?: { name: string; up?: Tag; down?: Tag }
  /** version 6: the one item it holds (partner only), the TMs equipped, and the exact ball it was thrown with */
  held?: string
  moves?: string[]
  thrown?: string
}

export type Moment =
  | { kind: 'level'; day: string; uid: string; form: string; level: number }
  | { kind: 'evolve'; day: string; uid: string; from: string; form: string; tag?: string; picked?: true }
  | { kind: 'graduate'; day: string; uid: string; form: string; bond: boolean }
  | { kind: 'partner'; day: string; uid: string; form: string; origin: Mon['origin'] }
  /** `how`: 'perfect' = caught on the spot by a perfect day; 'worn' = its HP ran out. Absent on version 1 days. */
  | { kind: 'catch'; day: string; uid: string; form: string; shiny: boolean; n: number; how?: 'perfect' | 'worn' | 'ball' }
  | { kind: 'appear'; day: string; form: string; rarity: Rarity }
  | { kind: 'form'; day: string; uid: string; form: string; what: 'mega' | 'gmax' }
  | { kind: 'badge'; day: string; n: number }
  | { kind: 'region'; day: string; n: number }
  /** `league` indexes LEAGUES; `slot` indexes that league's lineup (gyms, then Elite Four, then Champion) */
  | { kind: 'gym'; day: string; league: number; slot: number }
  | { kind: 'league'; day: string; league: number }
  | { kind: 'item'; day: string; item: string; why: 'gym' | 'perfect' | 'league' }
  | { kind: 'use'; day: string; uid: string; form: string; item: string; what: 'mega' | 'branch' | 'lead'; to?: string }
  /** version 4: the Key Stone, and a Mega form registered for good */
  | { kind: 'key'; day: string }
  | { kind: 'mega'; day: string; uid: string; form: string }
  /** version 5: a Pokemon sent to the Professor, and a quest finished */
  | { kind: 'transfer'; day: string; form: string; gems: number; coins?: number }
  /** version 6: a feat reached, and what it paid. `items` are item ids */
  | { kind: 'feat'; day: string; id: string; name: string; coins: number; gems: number; items: string[] }
  | { kind: 'quest'; day: string; id: string; name: string; coins: number; gems: number }
  | { kind: 'season'; day: string; step: number; coins: number; gems: number; item: string }
  | { kind: 'hatch'; day: string; uid: string; form: string }
  /** `n` counts chests opened for life, so each one is told apart */
  | { kind: 'chest'; day: string; n: number; coins: number; item: string; count: number }

export interface DayResult {
  day: string
  /** XP before the multiplier */
  base: number
  mult: number
  xp: number
  pillars: number
  pillarTotal: number
  done: number
  total: number
  /** enough pillars to count toward momentum */
  counts: boolean
  perfect: boolean
  /** share of the day's XP done, 0..1: how whole the day was */
  share: number
  ball: Ball
  /** what the day did to the wild Pokemon, and to the gym leader */
  hit: number
  strike: number
}

export interface DexEntry {
  /** first day it stood in front of you, or was yours */
  first: string
  /** day it first became yours (caught, hatched, or evolved into). Absent = seen only */
  own?: string
  shiny?: true
}

/** The Pokemon in front of you. It stays until it is caught. */
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
}

export interface HallEntry {
  league: number
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

export interface Game {
  partner: Mon
  level: number
  /** XP into the current level, and what the level needs */
  into: number
  need: number
  /** how much of `into` was already there when today began (the rest is today's); 0 for a partner that started today */
  intoBeforeToday: number
  /** next level something happens at, and what */
  next: { level: number; what: 'evolve' | 'graduate' }
  /** for a partner whose next evolution branches: which way its habits are leaning, percentages that add to about 100 */
  lean: { form: string; tag: string; pct: number }[]
  /** what to draw today: the Mega or Gigantamax form when one is earned */
  display: string
  aura: 'mega' | 'gmax' | null
  asleep: boolean
  /** the Box: caught and not yet raised, oldest first. Nothing in it is waiting for anything */
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
  /** version 1 only: Monday of each week that earned a badge */
  badges: string[]
  regions: number
  league: LeagueState
  hall: HallEntry[]
  /** stone → how many are in the Bag. From version 4 they are keepsakes: none is earned and none is needed */
  bag: Record<string, number>
  /** version 5: what has been earned and not yet spent */
  wallet: { coins: number; gems: number; coinsToday: number; gemsToday: number; marks: Record<MarkTag, number>; marksToday: Record<MarkTag, number> }
  /** item → how many are held (balls, berries, incense), and the themes owned */
  inv: Record<string, number>
  /** the scene theme in use, '' for the ordinary one */
  theme: string
  /** up to TEAM_SIZE fully trained Pokemon standing behind the partner, and how many of them beat the leader up now */
  team: Mon[]
  teamEdge: number
  /** today's and this week's quests */
  quests: { daily: Quest[]; weekly: Quest[] }
  /** this month's ladder: steps reached, XP into the next one, and what the next one hands over */
  season: { month: string; step: number; into: number; need: number; next: { coins?: number; gems?: number; item?: string } }
  /** the egg being kept warm, if there is one */
  egg: { have: number; need: number } | null
  /** the three the next wild Pokemon can be chosen from with incense, and the one chosen */
  wish: { options: string[]; chosen: string | null }
  /** version 6: today's Mart deals and which are already bought, runs (now, best), the counters feats read, the feats reached, and a lure waiting */
  mart: { deals: Offer[]; bought: string[] }
  runs: Record<string, { cur: number; best: number }>
  counters: Record<string, number>
  feats: { id: string; day: string }[]
  lure: MarkTag | null
  /** the rules today is played under */
  version: 1 | 3 | 4 | 5 | 6
  /** day the Key Stone was earned */
  keyStone: string | null
  /** each domain counted in its own unit, for life */
  notes: Notes
  /** things about the habit list the game cannot make sense of, in plain words */
  warnings: string[]
  stats: Stats
  moments: Moment[]
  wild: Wild | null
}

export interface Quest { id: string; name: string; coins: number; gems: number; done: boolean; have: number; need: number }

/** Each domain in its own unit. Nothing in the game hangs on these yet. */
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

export interface FoldOptions {
  /** first day of rules version 3; tests move it to exercise one version alone */
  v3From?: string
  /** first day of rules version 4 */
  v4From?: string
  /** first day of rules version 5 */
  v5From?: string
  /** first day of rules version 6 */
  v6From?: string
}

export function foldGame(facts: DayFacts[], opts: FoldOptions = {}): Game {
  const v3From = opts.v3From ?? V3_START
  const v4From = opts.v4From ?? V4_START
  const v5From = opts.v5From ?? V5_START
  const v6From = opts.v6From ?? V6_START
  const moments: Moment[] = []
  const dex: Record<string, DexEntry> = {}
  const queue: Mon[] = []
  const graduates: Mon[] = []
  const badges: string[] = []
  const days: DayResult[] = []
  const hall: HallEntry[] = []
  const weekCount: Record<string, number> = {}
  const bag: Record<string, number> = {}
  const uids = new Set<string>()
  let milestones = 0
  let regions = 1
  let perfectDays = 0
  let catches = 0
  let spawns = 0
  /** who follows the partner, when one was chosen by hand */
  let chosenNext: string | null = null
  let keyStone: string | null = null
  // version 5: the wallet, what is held, the team, quests already paid
  const zeroMarks = (): Record<MarkTag, number> => ({ code: 0, fitness: 0, guitar: 0, arbor: 0, sleep: 0 })
  const wallet = { coins: 0, gems: 0, coinsToday: 0, gemsToday: 0, marks: zeroMarks(), marksToday: zeroMarks() }
  const inv: Record<string, number> = {}
  // version 6: the Mart's sales, runs, counters and feats
  const sold = new Set<string>()
  const runs: Record<string, { cur: number; best: number; last: string }> = {}
  const cn: Record<string, number> = {}
  const feats: { id: string; day: string }[] = []
  const gotFeat = new Set<string>()
  let lureFor: MarkTag | null = null
  let v6Day = false
  const bump = (k: string, n = 1) => { cn[k] = (cn[k] ?? 0) + n }
  const runDay = (key: string, day: string) => {
    const r = (runs[key] ??= { cur: 0, best: 0, last: '' })
    r.cur = r.last && dayGap(r.last, day) <= 2 ? r.cur + 1 : 1
    r.last = day
    r.best = Math.max(r.best, r.cur)
    cn[`run:${key}`] = r.best
  }
  let theme = ''
  let teamPick: string[] | null = null
  let wishFor: string | null = null
  const paid = new Set<string>()
  const monthXp: Record<string, number> = {}, monthStep: Record<string, number> = {}
  let egg: { have: number } | null = null
  let chests = 0
  const weekXp: Record<string, number> = {}, weekDays: Record<string, number> = {}, weekCatch: Record<string, number> = {}
  let v5Day = false
  const earn = (coins: number, gems: number) => {
    if (!v5Day) return
    wallet.coins += coins; wallet.gems += gems; wallet.coinsToday += coins; wallet.gemsToday += gems
  }
  /** the three the wild Pokemon after this one can be chosen from */
  const wishOptions = (): string[] => [0, 1, 2].map((k) => roll(`wish:${spawns + 1}:${k}`, 'any'))
  const teamCap = (): number => TEAM_SIZE + (inv['exp-share'] ? 1 : 0)
  const teamNow = (): Mon[] => (teamPick ? teamPick.flatMap((u) => graduates.filter((m) => m.uid === u)) : graduates.slice(-teamCap()).reverse()).slice(0, teamCap())
  /** the types the partner fights with: its own, and from version 6 the TMs it carries */
  const typesOf = (m: Mon): (string | undefined)[] => [rec(m.form).t, rec(m.form).t2, ...(v6Day ? (m.moves ?? []).map((id) => tmType(id) ?? undefined) : [])]
  const notes: Notes = { codeDays: 0, arborDays: 0, guitarDays: 0, workouts: 0, records: 0, clean: 0, owned: 0, steps: 0, stepDays: 0 }
  /** how each Pokemon did on each tag over all its days as the partner: its nature */
  const raised = new Map<string, Share>()

  /** the wild Pokemon in front of you, and the one caught today if there was one */
  let wild: Wild | null = null
  let caughtToday: Wild | null = null

  // the league: who is up, their HP, and how much each domain has hit them
  const lg = { index: 0, slot: 0, hp: LEADER_HP, beaten: 0 }
  let hitBy: Partial<Record<Tag, number>> = {}

  const see = (form: string, day: string, shiny: boolean, own = true) => {
    if (!dex[form]) dex[form] = { first: day }
    if (own && !dex[form].own) dex[form].own = day
    if (shiny) dex[form].shiny = true
  }
  /** Species and day name a Pokemon, so a stone used on it still finds it if an earlier day is ticked late. */
  const make = (base: string, origin: Mon['origin'], day: string, shiny = false): Mon => {
    let uid = `${base}.${day}`
    for (let n = 2; uids.has(uid); n++) uid = `${base}.${day}.${n}`
    uids.add(uid)
    return { uid, base, form: base, xp: 0, shiny, origin, from: day, bond: true, path: [base] }
  }
  const owned = () => new Set([partner.base, ...queue.map((m) => m.base), ...graduates.map((m) => m.base)])
  const give = (item: string, day: string, why: Extract<Moment, { kind: 'item' }>['why']) => {
    bag[item] = (bag[item] ?? 0) + 1
    moments.push({ kind: 'item', day, item, why })
  }
  /** Regions only ever open: version 1 counted trained partners, version 3 also wants the league beaten. */
  const reopen = (day: string, v3: boolean) => {
    const n = v3 ? regionsOpenV2(graduates.length, lg.beaten) : regionsOpen(graduates.length)
    if (n > regions) {
      regions = n
      moments.push({ kind: 'region', day, n })
    }
  }

  /** One first-stage species from the open regions. New lines first; repeats only when there is nothing new. */
  const roll = (seed: string, want: 'any' | 'R' | 'L', lure: MarkTag | null = null): string => {
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
    // a stone was spent on choosing: that is the one
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
  /** With the Key Stone, a Pokemon's Mega forms become its own for good. */
  const register = (m: Mon, day: string) => {
    const megas = rec(m.form).m ?? []
    if (!keyStone || !megas.length || m.megas?.length) return
    m.megas = [...megas]
    delete m.mega // a week bought with a stone is no longer needed
    for (const form of megas) see(form, day, m.shiny)
    moments.push({ kind: 'mega', day, uid: m.uid, form: megas[0] })
  }

  const gain = (xp: number, day: string, ver: number) => {
    const v3 = ver >= 3
    const before = levelOf(partner.xp)
    const who = partner.uid
    partner.xp += xp
    for (;;) {
      const r = rec(partner.form)
      const stages = stagesOf(partner)
      const level = levelOf(partner.xp)
      const evo = evolveAt(stages, r.s)
      if (evo !== null && level >= evo && r.e?.length) {
        const to = pickBranch(partner, day)
        earn(0, GEMS.evolve)
        moments.push({ kind: 'evolve', day, uid: partner.uid, from: partner.form, form: to.form, ...(to.tag ? { tag: to.tag } : {}), ...(to.picked ? { picked: true as const } : {}) })
        partner.form = to.form
        partner.path.push(to.form)
        delete partner.pick
        delete partner.mega // the Mega was of the form it has just left
        delete partner.megas
        delete partner.show
        see(to.form, day, partner.shiny)
        stage = emptyShare()
        continue
      }
      const grad = graduateAt(stages)
      if (level >= grad) {
        const over = partner.xp - xpForLevel(grad)
        partner.xp = xpForLevel(grad)
        partner.graduated = day
        if (ver >= 4) {
          if (ver < 6) register(partner, day) // at the latest: nothing with a Mega leaves without it
          partner.nature = natureOf(partner)
        }
        if (partner.held) { inv[partner.held] = (inv[partner.held] ?? 0) + 1; delete partner.held }
        graduates.push(partner)
        earn(0, GEMS.graduate)
        moments.push({ kind: 'graduate', day, uid: partner.uid, form: partner.form, bond: partner.bond })
        reopen(day, v3)
        // the one chosen, else the oldest in the Box, else an egg so the loop never stalls
        const at = chosenNext ? queue.findIndex((m) => m.uid === chosenNext) : -1
        partner = (at >= 0 ? queue.splice(at, 1)[0] : queue.shift()) ?? make(roll(`egg:${day}:${graduates.length}`, 'any'), 'egg', day)
        chosenNext = null
        partner.started = day
        partner.xp += over
        see(partner.form, day, partner.shiny)
        stage = emptyShare()
        moments.push({ kind: 'partner', day, uid: partner.uid, form: partner.form, origin: partner.origin })
        continue
      }
      break
    }
    if (partner.uid === who && levelOf(partner.xp) > before)
      moments.push({ kind: 'level', day, uid: partner.uid, form: partner.form, level: levelOf(partner.xp) })
  }

  /**
   * Something done by hand in the Pokedex. Nothing here gives XP or is needed
   * for anything: it only changes how things look or who is out in front.
   * Whatever does not apply is ignored and the stone stays in the Bag, so a
   * stale tap costs nothing.
   */
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

  /** Version 6: what a feat or a chest hands over. The Key Stone also starts the Mega road. */
  const grant = (r: Reward, day: string) => {
    earn(Math.round((r.coins ?? 0) * (r.coins && inv['amulet-coin'] ? 1.25 : 1)), r.gems ?? 0)
    for (const [id, n] of Object.entries(r.items ?? {})) {
      inv[id] = (inv[id] ?? 0) + n
      if (id === 'key-stone' && !keyStone) { keyStone = day; moments.push({ kind: 'key', day }) }
    }
  }
  const evalFeats = (day: string) => {
    cn.workouts = notes.workouts; cn.records = notes.records; cn.owned = notes.owned
    cn.perfect = perfectDays; cn.grads = graduates.length
    cn['run:any'] = Math.max(0, ...Object.keys(runs).map((k) => runs[k].best))
    cn.dex = Object.keys(dex).filter((id) => dex[id].own && !SPECIES[id]?.f).length
    cn.hearts = Math.max(0, ...[partner, ...queue, ...graduates].map((m) => (m.together ?? 0) + (m.fed ?? 0)))
    for (const ft of FEATS) {
      if (gotFeat.has(ft.id) || (cn[ft.key] ?? 0) < ft.n) continue
      gotFeat.add(ft.id)
      feats.push({ id: ft.id, day })
      grant(ft.reward, day)
      moments.push({ kind: 'feat', day, id: ft.id, name: ft.name, coins: ft.reward.coins ?? 0, gems: ft.reward.gems ?? 0, items: Object.keys(ft.reward.items ?? {}) })
    }
  }

  /** Version 6: the Mart, the domain shops, balls with conditions, held items, TMs, lures, the Smithy. What it does not handle falls through to version 5's. */
  const act6 = (u: { item: string; uid: string; what: string; to?: string }, day: string): boolean => {
    const item = u.item === 'berry' ? 'oran-berry' : u.item === 'incense' ? 'full-incense' : u.item
    const today = days[days.length - 1]
    if (u.what === 'buy') {
      const named = u.to && (u.to === 'mart' || u.to === 'rare' || isMarkTag(u.to)) ? (u.to as ShopId) : undefined
      const hit = offerFor(named, item, day, inv['coin-case'] ? 4 : 3)
      if (!hit) return true
      const { shop, offer } = hit
      if (shop === 'mart' && sold.has(`${day}:${item}`)) return true
      if (ONCE.has(item) && inv[item]) return true
      const marks = isMarkTag(shop) ? wallet.marks[shop] : 0
      if ((offer.coins ?? 0) > wallet.coins || (offer.gems ?? 0) > wallet.gems || (offer.marks ?? 0) > marks) return true
      wallet.coins -= offer.coins ?? 0; wallet.gems -= offer.gems ?? 0
      if (isMarkTag(shop)) wallet.marks[shop] -= offer.marks ?? 0
      if (shop === 'mart') sold.add(`${day}:${item}`)
      if (item === 'chest') {
        chests++
        bump('chests')
        let x = rng(`chest:${chests}`)() * 100
        const got = CHEST6.find((c) => (x -= c.odds) < 0) ?? CHEST6[0]
        wallet.coins += got.coins ?? 0
        if (got.item) inv[got.item] = (inv[got.item] ?? 0) + (got.n ?? 1)
        moments.push({ kind: 'chest', day, n: chests, coins: got.coins ?? 0, item: got.item ?? '', count: got.n ?? 0 })
        return true
      }
      inv[item] = (inv[item] ?? 0) + 1
      return true
    }
    if (u.what === 'throw') {
      const w: Wild | null = wild
      const b = BALLS[item]
      if (!b || !inv[item] || !w) return true
      const r = rec(w.form)
      const hp = throwHp(item, { types: [r.t, r.t2], from: w.from, owned: Boolean(dex[w.form]?.own) }, day)
      inv[item]--
      const took = Math.min(w.hp, hp)
      w.hp -= took
      if (today) today.hit += took
      if (w.hp <= 0) {
        const mon = catchWild(w, day, false, ballClass(item), 'ball')
        mon.thrown = item
        if (b.hearts) mon.fed = (mon.fed ?? 0) + b.hearts
      }
      return true
    }
    if (u.what === 'feed') {
      const hearts = item === 'sitrus-berry' ? 3 : item === 'oran-berry' ? 1 : 0
      if (!hearts || !inv[item]) return true
      inv[item]--
      partner.fed = (partner.fed ?? 0) + hearts
      return true
    }
    if (u.what === 'wish') {
      if (wishFor || !inv['full-incense'] || !u.to || !wishOptions().includes(u.to)) return true
      inv['full-incense']--
      wishFor = u.to
      return true
    }
    if (u.what === 'lure') {
      if (lureFor || !LURES[item] || !inv[item]) return true
      inv[item]--
      lureFor = LURES[item]
      return true
    }
    if (u.what === 'hold') {
      const to = u.to ?? ''
      if (to && !(HELD[to] && (inv[to] || partner.held === to))) return true
      if (partner.held) { inv[partner.held] = (inv[partner.held] ?? 0) + 1; delete partner.held }
      if (to) { inv[to]--; partner.held = to }
      return true
    }
    if (u.what === 'move') {
      const ids = [...new Set((u.to ?? '').split(',').filter((id) => tmType(id) && inv[id]))].slice(0, TM_SLOTS)
      if (ids.length) partner.moves = ids
      else delete partner.moves
      return true
    }
    if (u.what === 'forge') {
      const m = [partner, ...queue, ...graduates].find((x) => x.uid === u.uid)
      if (!keyStone || !m || !u.to) return true
      const megas = rec(m.form).m ?? []
      if (!megas.includes(u.to) || m.megas?.includes(u.to)) return true
      const shard = forgeShard(megas.length, megas.indexOf(u.to), m.nature?.up, inv)
      if (!shard) return true
      inv[shard] -= FORGE_COST
      m.megas = [...(m.megas ?? []), u.to]
      delete m.mega
      see(u.to, day, m.shiny)
      bump('megas')
      moments.push({ kind: 'mega', day, uid: m.uid, form: u.to })
      return true
    }
    if (u.what === 'transfer') {
      const i = queue.findIndex((m) => m.uid === u.uid)
      if (i < 0) return true
      const [gone] = queue.splice(i, 1)
      if (chosenNext === gone.uid) chosenNext = null
      const coins = SELL[rec(gone.form).r ?? 'C'] ?? SELL.C
      earn(coins, 0)
      moments.push({ kind: 'transfer', day, form: gone.form, gems: 0, coins })
      return true
    }
    return false
  }

  /** Version 5: buying, throwing, feeding, choosing. All of it spends what the work earned; none of it gives XP. */
  const act = (u: { item: string; uid: string; what: string; to?: string }, day: string): boolean => {
    if (u.what === 'buy') {
      if (!isShopItem(u.item)) return true
      const e = SHOP[u.item]
      if (e.once && inv[u.item]) return true
      if ((e.coins ?? 0) > wallet.coins || (e.gems ?? 0) > wallet.gems) return true
      wallet.coins -= e.coins ?? 0; wallet.gems -= e.gems ?? 0
      if (u.item === 'chest') {
        // opened on the spot: the same chest always holds the same thing, on every device
        chests++
        let x = rng(`chest:${chests}`)() * 100
        const got = CHEST.find((c) => (x -= c.odds) < 0) ?? CHEST[0]
        wallet.coins += got.coins ?? 0
        if (got.item) inv[got.item] = (inv[got.item] ?? 0) + (got.n ?? 1)
        moments.push({ kind: 'chest', day, n: chests, coins: got.coins ?? 0, item: got.item ?? '', count: got.n ?? 0 })
        return true
      }
      inv[u.item] = (inv[u.item] ?? 0) + 1
      return true
    }
    if (u.what === 'throw') {
      const hp = isShopItem(u.item) ? THROW_HP[u.item] : undefined
      const w: Wild | null = wild
      if (!hp || !inv[u.item] || !w) return true
      inv[u.item]--
      const took = Math.min(w.hp, hp)
      w.hp -= took
      const today = days[days.length - 1]
      if (today) today.hit += took
      if (w.hp <= 0) catchWild(w, day, false, u.item === 'ultra-ball' ? 'ultra' : 'great', 'ball')
      return true
    }
    if (u.what === 'feed') {
      if (!inv.berry) return true
      inv.berry--
      partner.fed = (partner.fed ?? 0) + 1
      return true
    }
    if (u.what === 'wish') {
      if (wishFor || !inv.incense || !u.to || !wishOptions().includes(u.to)) return true
      inv.incense--
      wishFor = u.to
      return true
    }
    if (u.what === 'team') {
      const ids = (u.to ?? '').split(',').filter((id) => graduates.some((m) => m.uid === id))
      teamPick = [...new Set(ids)].slice(0, teamCap())
      return true
    }
    if (u.what === 'transfer') {
      const i = queue.findIndex((m) => m.uid === u.uid)
      if (i < 0) return true
      const [gone] = queue.splice(i, 1)
      if (chosenNext === gone.uid) chosenNext = null
      earn(0, GEMS.transfer)
      moments.push({ kind: 'transfer', day, form: gone.form, gems: GEMS.transfer })
      return true
    }
    if (u.what === 'theme') {
      if (!u.to || inv[u.to]) theme = u.to ?? ''
      return true
    }
    return false
  }

  const spend = (u: { item: string; uid: string; what: string; to?: string }, day: string, v4: boolean) => {
    if (v6Day && act6(u, day)) return
    if (v5Day && act(u, day)) return
    // choosing who is next is free: no stone, and it can be changed as often as you like
    if (u.what === 'next') {
      if (queue.some((m) => m.uid === u.uid)) chosenNext = u.uid
      return
    }
    // version 4: which registered form to draw. Changes nothing but the picture
    if (u.what === 'show') {
      const m = v4 ? [partner, ...queue].find((x) => x.uid === u.uid) : undefined
      if (m && u.to && (u.to === 'base' || m.megas?.includes(u.to))) m.show = u.to
      return
    }
    // version 4: a branch and a change of partner are free, and a week of Mega is no longer sold
    if (v4 ? u.what === 'mega' : !bag[u.item]) return
    let ok = false
    if (u.what === 'mega' && u.uid === partner.uid) {
      const megas = rec(partner.form).m ?? []
      const form = u.to && megas.includes(u.to) ? u.to : megas[0]
      if (form) { partner.mega = { form, until: addDays(day, MEGA_DAYS - 1) }; ok = true }
    } else if (u.what === 'branch') {
      const m = [partner, ...queue].find((x) => x.uid === u.uid)
      if (m && u.to && (rec(m.form).e?.length ?? 0) > 1 && rec(m.form).e!.includes(u.to)) { m.pick = u.to; ok = true }
    } else if (u.what === 'lead') {
      const i = queue.findIndex((x) => x.uid === u.uid)
      if (i >= 0) {
        const [next] = queue.splice(i, 1)
        queue.unshift(partner)
        partner = next
        if (chosenNext === next.uid) chosenNext = null
        partner.started ??= day
        stage = emptyShare()
        ok = true
      }
    }
    if (!ok) return
    if (!v4) bag[u.item]--
    moments.push({ kind: 'use', day, uid: partner.uid, form: partner.form, item: v4 ? '' : u.item, what: u.what as 'mega' | 'branch' | 'lead', ...(u.to ? { to: u.to } : {}) })
  }

  const leagueOpen = (): boolean => {
    const l = LEAGUES[lg.index]
    return Boolean(l) && (l.region === null || l.region <= regions)
  }

  let display = partner.form
  let aura: Game['aura'] = null
  let asleep = false
  let momentum = { days: 0, mult: 1 }

  /** the partner, and its XP, as today began: what the bar showed before anything was ticked */
  let dayStart = { uid: partner.uid, xp: partner.xp }

  facts.forEach((f, i) => {
    const ver = rulesOn(f.day, v3From, v4From, v5From, v6From)
    const v3 = ver >= 3, v4 = ver >= 4, v5 = ver >= 5, v6 = ver >= 6
    v5Day = v5
    v6Day = v6
    wallet.coinsToday = 0; wallet.gemsToday = 0; wallet.marksToday = zeroMarks()
    dayStart = { uid: partner.uid, xp: partner.xp }
    caughtToday = null
    const pillarTotal = f.habits.filter((h) => h.pillar).length
    const pillars = f.habits.filter((h) => h.pillar && (h.frac >= 1 || h.done)).length
    const needed = Math.min(PILLARS_FOR_A_DAY, pillarTotal)
    const counts = needed > 0 && pillars >= needed
    // a perfect day is everything you can still do today: last night's measured sleep pays XP, but cannot spoil it
    const yours = f.habits.filter((h) => !h.measured)
    const done = yours.filter((h) => h.done).length
    const total = yours.length
    const perfect = total > 0 && done === total

    // momentum looks back, so the multiplier is known the moment the day starts
    const back = days.slice(Math.max(0, i - MOMENTUM_WINDOW), i)
    const mDays = back.filter((d) => d.counts).length
    const mult = momentumMult(mDays)
    momentum = { days: mDays, mult }

    // dozing: nothing at all on the last two days, and nothing yet today
    const dry = days.length >= SLEEP_AFTER && days.slice(-SLEEP_AFTER).every((d) => d.pillars === 0)
    if (dry && !v4) partner.bond = false
    if (pillars > 0) partner.together = (partner.together ?? 0) + 1
    asleep = dry && pillars === 0

    const base = f.habits.reduce((s, h) => s + h.worth * h.frac, 0)
    const full = f.habits.reduce((s, h) => s + h.worth, 0)
    const xp = Math.round(base * mult)
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
    if (typeof f.body?.steps === 'number') {
      notes.steps += Math.max(0, Math.min(STEPS_GOAL, f.body.steps))
      notes.stepDays++
    }
    // version 6: each domain's own unit-day. Counted for every day (history counts toward feats); marks are paid only from version 6
    const did = (t: Tag): boolean => f.habits.some((h) => h.tag === t && (h.frac >= 1 || h.done))
    const unit: Record<MarkTag, boolean> = { code: did('code'), fitness: did('fitness') || (f.marks?.workouts ?? 0) > 0, guitar: did('guitar'), arbor: did('arbor'), sleep: did('sleep') }
    for (const t of MARK_TAGS) {
      if (!unit[t]) continue
      bump(`days:${t}`)
      runDay(t, f.day)
      if (v6) { wallet.marks[t]++; wallet.marksToday[t]++ }
    }
    if (counts) runDay('work', f.day)
    if (v6) {
      const extra = (t: MarkTag, n: number) => { wallet.marks[t] += n; wallet.marksToday[t] += n }
      extra('fitness', MARK_RECORD * (f.marks?.records ?? 0))
      extra('guitar', MARK_OWNED * (f.marks?.owned ?? 0))
    }
    const share = full > 0 ? base / full : 0
    const chores = f.habits.filter((h) => h.tag === 'routine')
    const ball = ballFor(chores.length ? chores.filter((h) => h.done).length / chores.length : 0)
    const result: DayResult = { day: f.day, base: Math.round(base), mult, xp, pillars, pillarTotal, done, total, counts, perfect, share, ball, hit: 0, strike: 0 }
    days.push(result)

    // ── how much: the partner's XP ──
    gain(xp, f.day, ver)

    if (v3) {
      // ── how whole: the wild Pokemon ──
      if (!wild) {
        spawns++
        const want = spawns % LEGENDARY_EVERY_WILD === 0 ? 'L' : 'any'
        // incense: the one that was chosen turns up
        const form = wishFor ?? roll(`wild:${f.day}`, want, lureFor)
        if (!wishFor) lureFor = null
        wishFor = null
        const rarity = (rec(form).r ?? 'C') as Rarity
        wild = { form, rarity, hp: WILD_HP[rarity], max: WILD_HP[rarity], from: f.day, shiny: false, caught: false }
        see(form, f.day, false, false)
        moments.push({ kind: 'appear', day: f.day, form, rarity })
      }
      const w: Wild = wild
      result.hit = perfect ? w.hp : Math.min(w.hp, (v5 ? wildHit5 : wildHit)(share, BALL_MULT[ball]))
      w.hp -= result.hit
      if (w.hp <= 0) {
        // a perfect day is the only way to a shiny
        const shiny = perfect && rng(`shiny:${f.day}`)() < 1 / SHINY_ODDS
        catchWild(w, f.day, shiny, ball, perfect ? 'perfect' : 'worn') // the next one appears tomorrow morning
      }
      if (perfect) {
        perfectDays++
        if (!v4 && perfectDays % RARE_EVERY === 0) give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'perfect')
      }

      // ── what kind: the gym leader ──
      const leader = leaderOf(lg.index, lg.slot)
      if (leader && leagueOpen()) {
        const weak = weakDomains(leader.type)
        const edge = beats(typesOf(partner), leader.type)
        // version 5: the team behind the partner. Each one whose type beats the leader's adds to every strike
        const backing = v5 ? 1 + TEAM_BONUS * teamNow().filter((m) => beats([rec(m.form).t, rec(m.form).t2], leader.type)).length : 1
        let strike = 0
        for (const h of f.habits) {
          const d = h.worth * h.frac * (weak.includes(h.tag) ? WEAK_MULT : 1) * (edge ? ADVANTAGE_MULT : 1) * backing * (v6 ? heldMult(partner.held, h.tag) : 1)
          strike += d
          hitBy[h.tag] = (hitBy[h.tag] ?? 0) + d
        }
        result.strike = Math.min(lg.hp, Math.round(strike))
        lg.hp -= result.strike
        if (lg.hp <= 0) {
          const l = LEAGUES[lg.index]
          const gym = isGym(lg.index, lg.slot)
          earn(0, gym ? GEMS.gym : GEMS.elite)
          if (gym) bump('badges')
          moments.push({ kind: 'gym', day: f.day, league: lg.index, slot: lg.slot })
          // version 3: a stone from every second gym, and from each of the Elite Four and the Champion.
          // From version 4 the badge is the reward, the Key Stone comes with the eighth of the first
          // league, and whoever was out in front when a leader fell keeps its Mega for good
          if (v6) {
            // version 6: nothing is handed over here. The Key Stone is a feat and a Mega is forged
          } else if (v4) {
            if (!keyStone && (lg.index > 0 || lg.slot + 1 >= KEY_STONE_BADGES)) {
              keyStone = f.day
              moments.push({ kind: 'key', day: f.day })
            }
            register(partner, f.day)
          } else if (gym) {
            if (lg.slot % 2 === 1) {
              const top = (Object.entries(hitBy) as [Tag, number][]).sort((a, b) => b[1] - a[1])[0]?.[0]
              give((top && STONE_FOR_TAG[top]) || MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'gym')
            }
          } else give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'league')
          lg.slot++
          lg.hp = LEADER_HP
          hitBy = {}
          if (lg.slot >= lineup(l).length) {
            earn(0, GEMS.league)
            moments.push({ kind: 'league', day: f.day, league: lg.index })
            hall.push({
              league: lg.index, day: f.day, partner: { form: partner.form, shiny: partner.shiny },
              team: graduates.slice(-5).reverse().map((m) => ({ form: m.form, shiny: m.shiny })),
              stats: statsOf(facts.slice(0, i + 1)),
            })
            if (l.region !== null) lg.beaten++
            lg.index++
            lg.slot = 0
            reopen(f.day, true)
          }
        }
      }

      // the eighth badge was already won when version 4 began: the Key Stone is waiting
      if (v4 && !v6 && !keyStone && (lg.index > 0 || lg.slot >= KEY_STONE_BADGES)) {
        keyStone = f.day
        moments.push({ kind: 'key', day: f.day })
      }

      if (v5) {
        // a coin for each XP of the day's work, and the quests the day finished
        if (!v6) earn(Math.round(base), 0) // version 6: coins are not XP again
        const wk = weekOf(f.day)
        weekXp[wk] = (weekXp[wk] ?? 0) + Math.round(base)
        if (counts) weekDays[wk] = (weekDays[wk] ?? 0) + 1
      }

      if (v5) {
        // the season: every SEASON_STEP XP of the month's work is a step, and the step hands something over
        const ym = f.day.slice(0, 7)
        monthXp[ym] = (monthXp[ym] ?? 0) + Math.round(base)
        while ((monthStep[ym] ?? 0) < Math.floor(monthXp[ym] / SEASON_STEP)) {
          const step = (monthStep[ym] = (monthStep[ym] ?? 0) + 1)
          const r = v6 ? seasonReward6(step) : seasonReward(step)
          earn(r.coins ?? 0, r.gems ?? 0)
          if (r.item) inv[r.item] = (inv[r.item] ?? 0) + 1
          moments.push({ kind: 'season', day: f.day, step, coins: r.coins ?? 0, gems: r.gems ?? 0, item: r.item ?? '' })
        }
      }

      for (const u of f.uses ?? []) spend(u, f.day, v4)

      if (v5) {
        // an egg: one kept warm at a time, a day nearer on each day with two pillars
        if (!egg && inv['rare-egg']) { inv['rare-egg']--; egg = { have: 0 } }
        else if (egg && counts && ++egg.have >= (v6 && inv['old-charm'] ? EGG_DAYS_OLD_CHARM : EGG_DAYS)) {
          bump('hatched')
          const mon = make(roll(`rare-egg:${f.day}`, 'R'), 'egg', f.day)
          queue.push(mon)
          see(mon.form, f.day, false)
          moments.push({ kind: 'hatch', day: f.day, uid: mon.uid, form: mon.form })
          egg = null
        }
      }

      if (v5) {
        const wk = weekOf(f.day)
        const met: Record<string, boolean> = {
          'two-pillars': counts, 'all-pillars': pillarTotal > 0 && pillars === pillarTotal, chores: ball === 'ultra', perfect,
          'five-days': (weekDays[wk] ?? 0) >= WEEK_DAYS, 'week-xp': (weekXp[wk] ?? 0) >= WEEK_XP, catch: (weekCatch[wk] ?? 0) >= 1,
        }
        for (const [list, key] of [[v6 ? DAILY_QUESTS6 : DAILY_QUESTS, f.day], [v6 ? WEEKLY_QUESTS6 : WEEKLY_QUESTS, wk]] as const)
          for (const q of list) {
            if (!met[q.id] || paid.has(`${key}:${q.id}`)) continue
            paid.add(`${key}:${q.id}`)
            const coins = Math.round((q.coins ?? 0) * (v6 && inv['amulet-coin'] ? 1.25 : 1))
            earn(coins, q.gems ?? 0)
            moments.push({ kind: 'quest', day: f.day, id: q.id, name: q.name, coins, gems: q.gems ?? 0 })
          }
        // version 6: feats, last, so everything the day did is counted
        if (v6) evalFeats(f.day)
      }
    } else {
      // ── version 1: a perfect day catches, and a week of counting days is a badge ──
      if (perfect) {
        perfectDays++
        const n = perfectDays
        const want = n % LEGENDARY_EVERY === 0 ? 'L' : n % RARE_EVERY === 0 ? 'R' : 'any'
        const mon = make(roll(`catch:${f.day}`, want), 'catch', f.day, n % SHINY_EVERY === 0)
        queue.push(mon)
        catches++
        see(mon.form, f.day, mon.shiny)
        moments.push({ kind: 'catch', day: f.day, uid: mon.uid, form: mon.form, shiny: mon.shiny, n })
      }
      if (counts) {
        const w = weekOf(f.day)
        weekCount[w] = (weekCount[w] ?? 0) + 1
        if (weekCount[w] === BADGE_DAYS) {
          badges.push(w)
          moments.push({ kind: 'badge', day: f.day, n: badges.length })
        }
      }
    }

    // temporary forms, for whoever is the partner at the end of the day
    display = partner.form
    aura = null
    const r = rec(partner.form)
    const show = (form: string, what: 'mega' | 'gmax') => {
      display = form
      if (!dex[form]) moments.push({ kind: 'form', day: f.day, uid: partner.uid, form, what })
      see(form, f.day, partner.shiny)
    }
    const kept = v4 && partner.megas?.length ? partner.megas : null
    if (kept) {
      // registered for good: drawn every day, unless the plain form was asked for
      if (partner.show !== 'base') {
        aura = 'mega'
        show(partner.show && kept.includes(partner.show) ? partner.show : kept[0], 'mega')
      }
    } else if (partner.mega && f.day <= partner.mega.until && r.m?.includes(partner.mega.form)) {
      // a stone was spent on it: Mega for its week, whatever momentum is doing
      aura = 'mega'
      show(partner.mega.form, 'mega')
    } else if (mDays >= MOMENTUM_WINDOW && (!v3 || (pillarTotal > 0 && pillars === pillarTotal))) {
      // full momentum, and from version 3 every pillar done today as well: Mega on its own
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
  const v3Now = Boolean(last && last.day >= v3From)
  const version = last ? rulesOn(last.day, v3From, v4From, v5From, v6From) : 6
  // the quests as they stand today
  const lastFacts = facts[facts.length - 1]
  const wkNow = last ? weekOf(last.day) : ''
  const chores = (lastFacts?.habits ?? []).filter((h) => h.tag === 'routine')
  const progress: Record<string, [number, number]> = {
    'two-pillars': [last?.pillars ?? 0, Math.min(PILLARS_FOR_A_DAY, last?.pillarTotal ?? 0) || PILLARS_FOR_A_DAY],
    'all-pillars': [last?.pillars ?? 0, last?.pillarTotal || 1],
    chores: [chores.filter((h) => h.done).length, Math.max(1, Math.ceil(chores.length * 0.8))],
    perfect: [last?.done ?? 0, last?.total || 1],
    'five-days': [weekDays[wkNow] ?? 0, WEEK_DAYS], 'week-xp': [weekXp[wkNow] ?? 0, WEEK_XP], catch: [weekCatch[wkNow] ?? 0, 1],
  }
  const quest = (key: string) => (q: (typeof DAILY_QUESTS)[number]): Quest => ({
    id: q.id, name: q.name, coins: q.coins ?? 0, gems: q.gems ?? 0, done: paid.has(`${key}:${q.id}`),
    have: Math.min(progress[q.id][0], progress[q.id][1]), need: progress[q.id][1],
  })
  const team = teamNow()
  const leaderNow = leaderOf(lg.index, lg.slot)
  // a pillar the game takes for a chore: its domain was never set
  const warnings = (facts[facts.length - 1]?.habits ?? [])
    .filter((h) => h.pillar && h.tag === 'routine')
    .map((h) => `${h.name ?? h.id} is a pillar with no domain, so it counts as a chore for the gym leaders, branching and natures. Set its domain in Life OS.`)
  // version 1 days: what a perfect day today would catch, shown with "habits left" as its HP
  let shown: Wild | null = caughtToday ?? wild
  if (!v3Now && last && last.total > 0) {
    const got = moments.find((m) => m.kind === 'catch' && m.day === last.day)
    if (got?.kind === 'catch') shown = { form: got.form, rarity: (rec(got.form).r ?? 'C') as Rarity, hp: 0, max: last.total, from: last.day, shiny: got.shiny, caught: true }
    else {
      const n = perfectDays + 1
      const want = n % LEGENDARY_EVERY === 0 ? 'L' : n % RARE_EVERY === 0 ? 'R' : 'any'
      const form = roll(`catch:${last.day}`, want)
      shown = { form, rarity: (rec(form).r ?? 'C') as Rarity, hp: last.total - last.done, max: last.total, from: last.day, shiny: n % SHINY_EVERY === 0, caught: false }
    }
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

  const leader = leaderOf(lg.index, lg.slot)
  return {
    partner,
    level,
    into: partner.xp - floor,
    intoBeforeToday: Math.min(partner.xp, Math.max(floor, before)) - floor,
    need: xpForLevel(level + 1) - floor,
    next: canEvolve ? { level: evo as number, what: 'evolve' } : { level: graduateAt(stages), what: 'graduate' },
    lean,
    display,
    aura,
    asleep,
    queue,
    nextUp: (chosenNext && queue.some((m) => m.uid === chosenNext) ? chosenNext : queue[0]?.uid) ?? null,
    graduates,
    dex,
    days,
    today: last ?? { day: '', base: 0, mult: 1, xp: 0, pillars: 0, pillarTotal: 0, done: 0, total: 0, counts: false, perfect: false, share: 0, ball: 'poke', hit: 0, strike: 0 },
    momentum,
    perfectDays,
    badges,
    regions,
    league: {
      index: lg.index, slot: lg.slot, hp: leader ? lg.hp : 0, max: LEADER_HP,
      weak: leader ? weakDomains(leader.type) : [],
      edge: leader ? beats(typesOf(partner), leader.type) : false,
      waiting: Boolean(leader) && !leagueOpen(),
      beaten: lg.beaten,
    },
    hall,
    bag,
    wallet,
    inv,
    theme,
    team,
    teamEdge: leaderNow ? team.filter((m) => beats([rec(m.form).t, rec(m.form).t2], leaderNow.type)).length : 0,
    quests: version >= 5 && last ? { daily: (version >= 6 ? DAILY_QUESTS6 : DAILY_QUESTS).map(quest(last.day)), weekly: (version >= 6 ? WEEKLY_QUESTS6 : WEEKLY_QUESTS).map(quest(wkNow)) } : { daily: [], weekly: [] },
    season: (() => {
      const ym = last ? last.day.slice(0, 7) : ''
      const xp = monthXp[ym] ?? 0, step = monthStep[ym] ?? 0
      return { month: ym, step, into: xp - step * SEASON_STEP, need: SEASON_STEP, next: version >= 6 ? seasonReward6(step + 1) : seasonReward(step + 1) }
    })(),
    egg: egg ? { have: (egg as { have: number }).have, need: version >= 6 && inv['old-charm'] ? EGG_DAYS_OLD_CHARM : EGG_DAYS } : null,
    wish: { options: version >= 5 ? wishOptions() : [], chosen: wishFor },
    version,
    mart: { deals: last && version >= 6 ? martDeals(last.day, inv['coin-case'] ? 4 : 3) : [], bought: last ? [...sold].filter((k) => k.startsWith(last.day + ':')).map((k) => k.slice(11)) : [] },
    runs: Object.fromEntries(Object.entries(runs).map(([k, r]) => [k, { cur: last && dayGap(r.last, last.day) <= 2 ? r.cur : 0, best: r.best }])),
    counters: cn,
    feats,
    lure: lureFor,
    keyStone,
    notes,
    warnings,
    stats: statsOf(facts),
    moments,
    wild: shown,
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
  const steps = recent.flatMap((d) => (typeof d.body?.steps === 'number' ? [Math.min(100, (d.body.steps / STEPS_GOAL) * 100)] : []))
  return {
    hp: share('sleep'),
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
