// The whole game, as one pure function of the days so far.
//
// Nothing here is stored anywhere: partner, queue, collection and badges are
// recomputed from the day list every time, which is why two devices (and two
// apps) always show the same thing.
import type { DayFacts } from './facts.ts'
import { addDays } from './facts.ts'
import {
  BADGE_DAYS, CATCH_WEIGHTS, LEGENDARY_EVERY, MOMENTUM_WINDOW, PILLARS_FOR_A_DAY, RARE_EVERY, SHINY_EVERY,
  SLEEP_AFTER, START_SPECIES, TAGS, evolveAt, graduateAt, levelOf, momentumMult, regionsOpen, xpForLevel,
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
}

export type Moment =
  | { kind: 'level'; day: string; uid: string; form: string; level: number }
  | { kind: 'evolve'; day: string; uid: string; from: string; form: string; tag?: string }
  | { kind: 'graduate'; day: string; uid: string; form: string; bond: boolean }
  | { kind: 'partner'; day: string; uid: string; form: string; origin: Mon['origin'] }
  | { kind: 'catch'; day: string; uid: string; form: string; shiny: boolean; n: number }
  | { kind: 'form'; day: string; uid: string; form: string; what: 'mega' | 'gmax' }
  | { kind: 'badge'; day: string; n: number }
  | { kind: 'region'; day: string; n: number }

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

export function foldGame(facts: DayFacts[]): Game {
  const moments: Moment[] = []
  const dex: Record<string, DexEntry> = {}
  const queue: Mon[] = []
  const graduates: Mon[] = []
  const badges: string[] = []
  const days: DayResult[] = []
  const weekCount: Record<string, number> = {}
  let perfectDays = 0
  let made = 0

  const see = (form: string, day: string, shiny: boolean) => {
    if (!dex[form]) dex[form] = { first: day }
    if (shiny) dex[form].shiny = true
  }
  const make = (base: string, origin: Mon['origin'], day: string, shiny = false): Mon => ({
    uid: `${base}.${day}.${made++}`, base, form: base, xp: 0, shiny, origin, from: day, bond: true, path: [base],
  })
  const owned = () => new Set([partner.base, ...queue.map((m) => m.base), ...graduates.map((m) => m.base)])

  /** One first-stage species from the open regions. New lines first; repeats only when there is nothing new. */
  const roll = (seed: string, want: 'any' | 'R' | 'L'): string => {
    const r = rng(seed)
    const open = regionsOpen(graduates.length)
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

  const pickBranch = (m: Mon, day: string): { form: string; tag?: string } => {
    const r = rec(m.form)
    const evos = r.e ?? []
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

  const gain = (xp: number, day: string) => {
    const before = levelOf(partner.xp)
    const who = partner.uid
    partner.xp += xp
    for (;;) {
      const r = rec(partner.form)
      const stages = stagesOf(partner)
      const level = levelOf(partner.xp)
      const evo = evolveAt(stages, r.s)
      if (evo !== null && level >= evo && r.e?.length) {
        const { form, tag } = pickBranch(partner, day)
        moments.push({ kind: 'evolve', day, uid: partner.uid, from: partner.form, form, tag })
        partner.form = form
        partner.path.push(form)
        see(form, day, partner.shiny)
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
        if (regionsOpen(graduates.length) > regionsOpen(graduates.length - 1))
          moments.push({ kind: 'region', day, n: regionsOpen(graduates.length) })
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

  let display = partner.form
  let aura: Game['aura'] = null
  let asleep = false
  let momentum = { days: 0, mult: 1 }

  /** the partner, and its XP, as today began: what the bar showed before anything was ticked */
  let dayStart = { uid: partner.uid, xp: partner.xp }

  facts.forEach((f, i) => {
    dayStart = { uid: partner.uid, xp: partner.xp }
    const pillarTotal = f.habits.filter((h) => h.pillar).length
    const pillars = f.habits.filter((h) => h.pillar && h.frac >= 1).length
    const needed = Math.min(PILLARS_FOR_A_DAY, pillarTotal)
    const counts = needed > 0 && pillars >= needed
    const done = f.habits.filter((h) => h.done).length
    const total = f.habits.length
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
    gain(xp, f.day)

    // temporary forms, for whoever is the partner at the end of the day
    display = partner.form
    aura = null
    const r = rec(partner.form)
    const show = (form: string, what: 'mega' | 'gmax') => {
      display = form
      if (!dex[form]) moments.push({ kind: 'form', day: f.day, uid: partner.uid, form, what })
      see(form, f.day, partner.shiny)
    }
    if (mDays >= MOMENTUM_WINDOW) {
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

    if (perfect) {
      perfectDays++
      const n = perfectDays
      const want = n % LEGENDARY_EVERY === 0 ? 'L' : n % RARE_EVERY === 0 ? 'R' : 'any'
      const mon = make(roll(`catch:${f.day}`, want), 'catch', f.day, n % SHINY_EVERY === 0)
      queue.push(mon)
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
    regions: regionsOpen(graduates.length),
    moments,
    wild,
  }
}

/** Where a sprite lives under the Pokedex site: animated when there is one, a still otherwise. */
export function spritePath(form: string, shiny = false): string {
  const still = SPECIES[form]?.st === 1
  return `/sprites/${still ? 'static' : 'ani'}${shiny ? '-shiny' : ''}/${form}.${still ? 'png' : 'gif'}`
}

export const nameOf = (form: string): string => SPECIES[form]?.n ?? form
