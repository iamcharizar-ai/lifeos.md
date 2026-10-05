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
  ADVANTAGE_MULT, BADGE_DAYS, BALL_MULT, CATCH_WEIGHTS, LEADER_HP, LEGENDARY_EVERY, LEGENDARY_EVERY_WILD, MEGA_DAYS, MILESTONE_STONES,
  MOMENTUM_WINDOW, PILLARS_FOR_A_DAY, RARE_EVERY, SHINY_EVERY, SHINY_ODDS, SLEEP_AFTER, START_SPECIES, STAT_DAYS, STEPS_GOAL, STONE_FOR_TAG, TAGS, V3_START,
  WEAK_MULT, WILD_HP, ballFor, evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, regionsOpenV2, wildHit, xpForLevel,
  type Ball, type Rarity, type Tag,
} from './rules.ts'
import { SPECIES, type SpeciesRec } from './species.ts'
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
  /** still true if it never dozed off while it was the partner */
  bond: boolean
  /** every form it has been, oldest first */
  path: string[]
  /** a stone was spent on a Mega Evolution: the form, and the last day it lasts */
  mega?: { form: string; until: string }
  /** a stone was spent on choosing how it evolves */
  pick?: string
}

export type Moment =
  | { kind: 'level'; day: string; uid: string; form: string; level: number }
  | { kind: 'evolve'; day: string; uid: string; from: string; form: string; tag?: string; picked?: true }
  | { kind: 'graduate'; day: string; uid: string; form: string; bond: boolean }
  | { kind: 'partner'; day: string; uid: string; form: string; origin: Mon['origin'] }
  /** `how`: 'perfect' = caught on the spot by a perfect day; 'worn' = its HP ran out. Absent on version 1 days. */
  | { kind: 'catch'; day: string; uid: string; form: string; shiny: boolean; n: number; how?: 'perfect' | 'worn' }
  | { kind: 'appear'; day: string; form: string; rarity: Rarity }
  | { kind: 'form'; day: string; uid: string; form: string; what: 'mega' | 'gmax' }
  | { kind: 'badge'; day: string; n: number }
  | { kind: 'region'; day: string; n: number }
  /** `league` indexes LEAGUES; `slot` indexes that league's lineup (gyms, then Elite Four, then Champion) */
  | { kind: 'gym'; day: string; league: number; slot: number }
  | { kind: 'league'; day: string; league: number }
  | { kind: 'item'; day: string; item: string; why: 'gym' | 'perfect' | 'league' }
  | { kind: 'use'; day: string; uid: string; form: string; item: string; what: 'mega' | 'branch' | 'lead'; to?: string }

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
  /** stone → how many are in the Bag */
  bag: Record<string, number>
  stats: Stats
  moments: Moment[]
  wild: Wild | null
}

// ── seeded randomness: the same day always rolls the same thing ──
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
}

export function foldGame(facts: DayFacts[], opts: FoldOptions = {}): Game {
  const v3From = opts.v3From ?? V3_START
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
  const roll = (seed: string, want: 'any' | 'R' | 'L'): string => {
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
    for (const pool of [...pools.map((p) => p.filter(([id]) => !have.has(id))), ...pools])
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

  const gain = (xp: number, day: string, v3: boolean) => {
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
        moments.push({ kind: 'evolve', day, uid: partner.uid, from: partner.form, form: to.form, ...(to.tag ? { tag: to.tag } : {}), ...(to.picked ? { picked: true as const } : {}) })
        partner.form = to.form
        partner.path.push(to.form)
        delete partner.pick
        delete partner.mega // the Mega was of the form it has just left
        see(to.form, day, partner.shiny)
        stage = emptyShare()
        continue
      }
      const grad = graduateAt(stages)
      if (level >= grad) {
        const over = partner.xp - xpForLevel(grad)
        partner.xp = xpForLevel(grad)
        partner.graduated = day
        graduates.push(partner)
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
  const spend = (u: { item: string; uid: string; what: string; to?: string }, day: string) => {
    // choosing who is next is free: no stone, and it can be changed as often as you like
    if (u.what === 'next') {
      if (queue.some((m) => m.uid === u.uid)) chosenNext = u.uid
      return
    }
    if (!bag[u.item]) return
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
    bag[u.item]--
    moments.push({ kind: 'use', day, uid: partner.uid, form: partner.form, item: u.item, what: u.what as 'mega' | 'branch' | 'lead', ...(u.to ? { to: u.to } : {}) })
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
    const v3 = f.day >= v3From
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
    if (dry) partner.bond = false
    asleep = dry && pillars === 0

    const base = f.habits.reduce((s, h) => s + h.worth * h.frac, 0)
    const full = f.habits.reduce((s, h) => s + h.worth, 0)
    const xp = Math.round(base * mult)
    for (const h of f.habits) {
      stage[h.tag].got += h.worth * h.frac
      stage[h.tag].max += h.worth
    }
    const share = full > 0 ? base / full : 0
    const chores = f.habits.filter((h) => h.tag === 'routine')
    const ball = ballFor(chores.length ? chores.filter((h) => h.done).length / chores.length : 0)
    const result: DayResult = { day: f.day, base: Math.round(base), mult, xp, pillars, pillarTotal, done, total, counts, perfect, share, ball, hit: 0, strike: 0 }
    days.push(result)

    // ── how much: the partner's XP ──
    gain(xp, f.day, v3)

    if (v3) {
      // ── how whole: the wild Pokemon ──
      if (!wild) {
        spawns++
        const want = spawns % LEGENDARY_EVERY_WILD === 0 ? 'L' : 'any'
        const form = roll(`wild:${f.day}`, want)
        const rarity = (rec(form).r ?? 'C') as Rarity
        wild = { form, rarity, hp: WILD_HP[rarity], max: WILD_HP[rarity], from: f.day, shiny: false, caught: false }
        see(form, f.day, false, false)
        moments.push({ kind: 'appear', day: f.day, form, rarity })
      }
      const w: Wild = wild
      result.hit = perfect ? w.hp : Math.min(w.hp, wildHit(share, BALL_MULT[ball]))
      w.hp -= result.hit
      if (w.hp <= 0) {
        // a perfect day is the only way to a shiny
        const shiny = perfect && rng(`shiny:${f.day}`)() < 1 / SHINY_ODDS
        const mon = make(w.form, 'catch', f.day, shiny)
        queue.push(mon)
        catches++
        see(mon.form, f.day, shiny)
        moments.push({ kind: 'catch', day: f.day, uid: mon.uid, form: mon.form, shiny, n: catches, how: perfect ? 'perfect' : 'worn' })
        caughtToday = { ...w, hp: 0, shiny, caught: true }
        wild = null // the next one appears tomorrow morning
      }
      if (perfect) {
        perfectDays++
        if (perfectDays % RARE_EVERY === 0) give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'perfect')
      }

      // ── what kind: the gym leader ──
      const leader = leaderOf(lg.index, lg.slot)
      if (leader && leagueOpen()) {
        const weak = weakDomains(leader.type)
        const edge = beats([rec(partner.form).t, rec(partner.form).t2], leader.type)
        let strike = 0
        for (const h of f.habits) {
          const d = h.worth * h.frac * (weak.includes(h.tag) ? WEAK_MULT : 1) * (edge ? ADVANTAGE_MULT : 1)
          strike += d
          hitBy[h.tag] = (hitBy[h.tag] ?? 0) + d
        }
        result.strike = Math.min(lg.hp, Math.round(strike))
        lg.hp -= result.strike
        if (lg.hp <= 0) {
          const l = LEAGUES[lg.index]
          const gym = isGym(lg.index, lg.slot)
          moments.push({ kind: 'gym', day: f.day, league: lg.index, slot: lg.slot })
          // a stone from every second gym, and from each of the Elite Four and the Champion
          if (gym) {
            if (lg.slot % 2 === 1) {
              const top = (Object.entries(hitBy) as [Tag, number][]).sort((a, b) => b[1] - a[1])[0]?.[0]
              give((top && STONE_FOR_TAG[top]) || MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'gym')
            }
          } else give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'league')
          lg.slot++
          lg.hp = LEADER_HP
          hitBy = {}
          if (lg.slot >= lineup(l).length) {
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

      for (const u of f.uses ?? []) spend(u, f.day)
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
    if (partner.mega && f.day <= partner.mega.until && r.m?.includes(partner.mega.form)) {
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
      edge: leader ? beats([pr.t, pr.t2], leader.type) : false,
      waiting: Boolean(leader) && !leagueOpen(),
      beaten: lg.beaten,
    },
    hall,
    bag,
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
