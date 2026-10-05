// The whole game, as one pure function of the days so far.
//
// Nothing here is stored anywhere: partner, queue, collection, badges and the
// Bag are recomputed from the day list every time, which is why two devices
// (and two apps) always show the same thing.
import type { DayFacts } from './facts.ts'
import { addDays } from './facts.ts'
import { LEAGUES } from './gyms.ts'
import {
  BADGES_PER_REGION, BADGE_DAYS, CATCH_WEIGHTS, LEAGUE_STEPS, LEGENDARY_EVERY, MEGA_DAYS, MILESTONE_STONES,
  MOMENTUM_WINDOW, PILLARS_FOR_A_DAY, RARE_EVERY, REGIONS, SHINY_EVERY, SLEEP_AFTER, START_SPECIES, STAT_DAYS, STEPS_GOAL, STONE_FOR_TAG, TAGS, V2_START,
  evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, regionsOpenV2, xpForLevel,
  type Tag,
} from './rules.ts'
import { SPECIES, type SpeciesRec } from './species.ts'

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
  | { kind: 'catch'; day: string; uid: string; form: string; shiny: boolean; n: number }
  | { kind: 'form'; day: string; uid: string; form: string; what: 'mega' | 'gmax' }
  | { kind: 'badge'; day: string; n: number }
  | { kind: 'region'; day: string; n: number }
  /** region is 1-based; slot 0-7 is a gym, 8-11 the Elite Four, 12 the Champion */
  | { kind: 'gym'; day: string; region: number; slot: number }
  | { kind: 'league'; day: string; region: number }
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
  /** enough pillars to count toward momentum and the week's badge */
  counts: boolean
  perfect: boolean
}

export interface DexEntry {
  first: string
  shiny?: true
}

/** Where the trainer stands in the gyms. `region` is 1-based and runs past the last one when every league is beaten. */
export interface LeagueState {
  region: number
  /** gyms beaten in that region, 0-8 */
  badges: number
  /** of the Elite Four and Champion, how many are beaten: 0-4 (the fifth ends the league) */
  run: number
  /** leagues beaten so far */
  beaten: number
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
  /** what to draw today: the Mega or Gigantamax form when one is earned */
  display: string
  aura: 'mega' | 'gmax' | null
  asleep: boolean
  queue: Mon[]
  graduates: Mon[]
  dex: Record<string, DexEntry>
  days: DayResult[]
  today: DayResult
  /** the multiplier in force today, and how many of the last seven days counted */
  momentum: { days: number; mult: number }
  perfectDays: number
  /** Monday of each week that earned a badge */
  badges: string[]
  regions: number
  league: LeagueState
  /** stone → how many are in the Bag */
  bag: Record<string, number>
  stats: Stats
  moments: Moment[]
  /**
   * What a perfect day today catches. Known in advance (the roll is seeded by
   * the day), so it can be shown as a shadow until every habit is ticked.
   * `caught` once today is perfect. A partner that graduates on the same day
   * can change the roll, so treat the shadow as a strong hint, not a promise.
   */
  wild: { form: string; shiny: boolean; caught: boolean } | null
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

export interface FoldOptions {
  /** first day of rules version 2; tests move it to exercise one version alone */
  v2From?: string
}

export function foldGame(facts: DayFacts[], opts: FoldOptions = {}): Game {
  const v2From = opts.v2From ?? V2_START
  const moments: Moment[] = []
  const dex: Record<string, DexEntry> = {}
  const queue: Mon[] = []
  const graduates: Mon[] = []
  const badges: string[] = []
  const days: DayResult[] = []
  const weekCount: Record<string, number> = {}
  const bag: Record<string, number> = {}
  const league: LeagueState = { region: 1, badges: 0, run: 0, beaten: 0 }
  let milestones = 0
  let regions = 1
  let perfectDays = 0
  const uids = new Set<string>()

  const see = (form: string, day: string, shiny: boolean) => {
    if (!dex[form]) dex[form] = { first: day }
    if (shiny) dex[form].shiny = true
  }
  /** Species and day name a Pokemon, so an item used on it still finds it if an earlier day is ticked late. */
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
  /** Regions only ever open: version 1 counted trained partners, version 2 also wants the league beaten. */
  const reopen = (day: string, v2: boolean) => {
    const n = v2 ? regionsOpenV2(graduates.length, league.beaten) : regionsOpen(graduates.length)
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

  const pickBranch = (m: Mon, day: string): { form: string; tag?: string; picked?: true } => {
    const r = rec(m.form)
    const evos = r.e ?? []
    // a stone was spent on choosing: that is the one
    if (m.pick && evos.includes(m.pick)) return { form: m.pick, picked: true }
    if (evos.length === 1 || !r.bt) return { form: evos[0] }
    const score = (tag: string): number =>
      tag === 'balanced' ? Math.min(ratio(stage, 'code'), ratio(stage, 'fitness'), ratio(stage, 'guitar'))
      : tag === 'health' ? -1 // waits for the health tracker
      : ratio(stage, tag as Tag)
    const scores = r.bt.map(score)
    const best = Math.max(...scores)
    const tied = evos.map((_, i) => i).filter((i) => scores[i] === best)
    const i = tied[Math.floor(rng(`branch:${m.uid}:${day}`)() * tied.length)]
    return { form: evos[i], tag: r.bt[i] }
  }

  const gain = (xp: number, day: string, v2: boolean) => {
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
        reopen(day, v2)
        // next in line, or an egg so the loop never stalls
        partner = queue.shift() ?? make(roll(`egg:${day}:${graduates.length}`, 'any'), 'egg', day)
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
   * A stone spent by hand. Nothing here gives XP or is needed for anything:
   * it only changes how things look or who is out in front. Whatever does not
   * apply is ignored and the stone stays in the Bag, so a stale tap costs nothing.
   */
  const spend = (u: { item: string; uid: string; what: string; to?: string }, day: string) => {
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
        partner.started ??= day
        stage = emptyShare()
        ok = true
      }
    }
    if (!ok) return
    bag[u.item]--
    moments.push({ kind: 'use', day, uid: partner.uid, form: partner.form, item: u.item, what: u.what as 'mega' | 'branch' | 'lead', ...(u.to ? { to: u.to } : {}) })
  }

  let display = partner.form
  let aura: Game['aura'] = null
  let asleep = false
  let momentum = { days: 0, mult: 1 }

  /** the partner, and its XP, as today began: what the bar showed before anything was ticked */
  let dayStart = { uid: partner.uid, xp: partner.xp }

  facts.forEach((f, i) => {
    const v2 = f.day >= v2From
    dayStart = { uid: partner.uid, xp: partner.xp }
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
    const xp = Math.round(base * mult)
    for (const h of f.habits) {
      stage[h.tag].got += h.worth * h.frac
      stage[h.tag].max += h.worth
    }
    days.push({ day: f.day, base: Math.round(base), mult, xp, pillars, pillarTotal, done, total, counts, perfect })
    gain(xp, f.day, v2)

    if (perfect) {
      perfectDays++
      const n = perfectDays
      const want = n % LEGENDARY_EVERY === 0 ? 'L' : n % RARE_EVERY === 0 ? 'R' : 'any'
      const mon = make(roll(`catch:${f.day}`, want), 'catch', f.day, n % SHINY_EVERY === 0)
      queue.push(mon)
      see(mon.form, f.day, mon.shiny)
      moments.push({ kind: 'catch', day: f.day, uid: mon.uid, form: mon.form, shiny: mon.shiny, n })
      if (v2 && n % RARE_EVERY === 0) give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'perfect')
    }

    if (counts) {
      const w = weekOf(f.day)
      weekCount[w] = (weekCount[w] ?? 0) + 1
      if (weekCount[w] === BADGE_DAYS) {
        badges.push(w)
        moments.push({ kind: 'badge', day: f.day, n: badges.length })
        // the next gym, when its region is open; then the Elite Four and the Champion, one badge week each
        if (v2 && league.region <= Math.min(regions, REGIONS.length)) {
          if (league.badges < BADGES_PER_REGION) {
            moments.push({ kind: 'gym', day: f.day, region: league.region, slot: league.badges })
            league.badges++
            // a badge comes with the stone of whatever led the week
            const week = emptyShare()
            for (const d of facts.slice(0, i + 1)) if (d.day >= w) for (const h of d.habits) { week[h.tag].got += h.worth * h.frac; week[h.tag].max += h.worth }
            const tags = Object.keys(STONE_FOR_TAG) as Tag[]
            const best = Math.max(...tags.map((t) => ratio(week, t)))
            const tied = tags.filter((t) => ratio(week, t) === best)
            give(STONE_FOR_TAG[tied[Math.floor(rng(`stone:${w}`)() * tied.length)]]!, f.day, 'gym')
          } else {
            moments.push({ kind: 'gym', day: f.day, region: league.region, slot: BADGES_PER_REGION + league.run })
            league.run++
            give(MILESTONE_STONES[milestones++ % MILESTONE_STONES.length], f.day, 'league')
            if (league.run >= LEAGUE_STEPS) {
              moments.push({ kind: 'league', day: f.day, region: league.region })
              league.beaten++
              league.region++
              league.badges = 0
              league.run = 0
              reopen(f.day, true)
            }
          }
        }
      }
    }

    if (v2) for (const u of f.uses ?? []) spend(u, f.day)

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
    } else if (mDays >= MOMENTUM_WINDOW) {
      // full momentum: Mega on its own, as it always was
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
  let wild: Game['wild'] = null
  if (last?.perfect) {
    const got = moments.find((m) => m.kind === 'catch' && m.day === last.day)
    if (got?.kind === 'catch') wild = { form: got.form, shiny: got.shiny, caught: true }
  } else if (last && last.total > 0) {
    const n = perfectDays + 1
    const want = n % LEGENDARY_EVERY === 0 ? 'L' : n % RARE_EVERY === 0 ? 'R' : 'any'
    wild = { form: roll(`catch:${last.day}`, want), shiny: n % SHINY_EVERY === 0, caught: false }
  }

  const level = levelOf(partner.xp)
  const stages = stagesOf(partner)
  const evo = evolveAt(stages, rec(partner.form).s)
  const canEvolve = evo !== null && Boolean(rec(partner.form).e?.length)
  const floor = level <= 1 ? 0 : xpForLevel(level)
  // today's share of the bar: from where the partner stood this morning, but never below this level's floor
  const before = dayStart.uid === partner.uid ? dayStart.xp : 0
  return {
    partner,
    level,
    into: partner.xp - floor,
    intoBeforeToday: Math.min(partner.xp, Math.max(floor, before)) - floor,
    need: xpForLevel(level + 1) - floor,
    next: canEvolve ? { level: evo as number, what: 'evolve' } : { level: graduateAt(stages), what: 'graduate' },
    display,
    aura,
    asleep,
    queue,
    graduates,
    dex,
    days,
    today: days[days.length - 1] ?? { day: '', base: 0, mult: 1, xp: 0, pillars: 0, pillarTotal: 0, done: 0, total: 0, counts: false, perfect: false },
    momentum,
    perfectDays,
    badges,
    regions,
    league,
    bag,
    stats: statsOf(facts),
    moments,
    wild,
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

/** The gym leader (slot 0-7), Elite Four member (8-11) or Champion (12) a `gym` moment stands for. */
export function leaderOf(region: number, slot: number) {
  const l = LEAGUES[region - 1]
  if (!l) return null
  return slot < BADGES_PER_REGION ? l.gyms[slot] : (l.four[slot - BADGES_PER_REGION] ?? l.champion)
}
