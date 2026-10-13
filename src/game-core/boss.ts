// GAME CORE: the weekly boss (rules version 10). See BOSS-DESIGN.md.
//
// A boss is a week-long fight against a card of five tasks. This file is the
// shapes and the arithmetic only; the fold (fold.ts) keeps its state.
//
// The card and each day's progress are DECIDED OUTSIDE the core and written to
// the ledger (`boss_card`, `boss_day`), the way a day's habit list is: the
// Pokedex plans the card with the coaches and measures the week from the raw
// events, and both apps then fold the same numbers. So this file never needs
// to know what a workout or a guitar log is.
import { BALLS } from './economy.ts'
import type { GameEvent } from './events.ts'
import type { Rarity, Tag } from './rules.ts'

export const CARD_EVENT = 'boss_card'
export const BOSS_DAY_EVENT = 'boss_day'

// ── the numbers (every one is a first pass, tuned by tools/boss-sim.mjs) ────
/** The party has to be full (the partner and five trained) before a boss will come. */
export const BOSS_PARTY = 6
/** Boss level from the party: 13 + 0.18 × the six levels added. */
export const bossLevel = (levelSum: number): number => Math.round(13 + 0.18 * levelSum)
/** How much a line's rarity is worth in a fight. */
export const RARITY_POWER: Record<Rarity, number> = { C: 1.0, U: 1.1, R: 1.25, L: 1.5 }
/** A member with a Mega registered counts this much more. */
export const MEGA_POWER = 1.15
/** A boss's own weight: a legendary is harder than a rare one, and a Mega harder still. */
export const BOSS_FACTOR: Record<'R' | 'L', number> = { R: 1.0, L: 1.35 }
export const BOSS_MEGA_FACTOR = 1.15
/** strike = ratio ^ this, kept between the two bounds */
export const STRIKE_CURVE = 1.2
export const STRIKE_MIN = 0.12
/** For each party member whose type beats the boss's, added to every strike. */
export const TYPE_EDGE = 0.04
/** Without every task done, no more than this share of its HP can fall. */
export const KILL_CAP = 0.95
/** A boss day with no progress on the card gives this share of its HP back. */
export const BOSS_HEAL = 0.03
/** Boss HP per level, for showing. */
export const BOSS_HP_PER_LEVEL = 100
/** Every Nth boss is a legendary. */
export const LEGENDARY_EVERY_BOSS = 8

/** Balls may be thrown once this share of its HP or less is left, and this many times. */
export const THROW_AT = 0.4
export const THROWS = 3
// One throw's chance. There are three throws, so a week's chance is far above one throw's:
// these are sized so that only a finished card with a strong party is close to sure.
export const CATCH_BASE = 0.05
export const CATCH_PER_TRAINED = 0.03
/** A finished card is most of the chance: the throw is earned by the week, not bought with a ball. */
export const CATCH_ALL_TASKS = 0.3
export const CATCH_BALL: Record<string, number> = { 'great-ball': 0.04, 'ultra-ball': 0.08 }
/** A boss resists even a Master Ball. */
export const CATCH_MASTER = 0.9
/** How much the HP still standing costs the throw: chance × (1 − this × HP left). */
export const CATCH_HP_COST = 1.2
/** A party it is too strong for throws worse: chance × (this + (1 − this) × strike). */
export const CATCH_STRIKE_FLOOR = 0.6
/** A caught boss is shiny one time in this many. */
export const BOSS_SHINY = 5

/** Share of HP taken at which a milestone pays, and what it pays. */
export const BOSS_MILESTONES: { at: number; coins?: number; gems?: number; items?: [string, number][] }[] = [
  { at: 0.25, coins: 100, items: [['great-ball', 1]] },
  { at: 0.5, gems: 10, items: [['oran-berry', 1]] },
  { at: 0.75, gems: 25, items: [['ultra-ball', 1]] },
]
export const BOSS_KILL_GEMS = 50
export const BOSS_CATCH_GEMS = 30
/** Marks of its own kind for a finished task (the Life task pays coins instead). */
export const BOSS_TASK_MARKS = 3
export const BOSS_TASK_COINS = 60

// ── the card ────────────────────────────────────────────────────────────────
export type BossKind = 'gym' | 'arbor' | 'shed' | 'sleep' | 'life'
export const BOSS_KINDS: BossKind[] = ['gym', 'arbor', 'shed', 'sleep', 'life']
/** The share of the boss's HP each kind of task stands for. */
export const BOSS_SHARE: Record<BossKind, number> = { gym: 0.3, arbor: 0.25, shed: 0.2, sleep: 0.15, life: 0.1 }
/** The game's own domain for each kind. */
export const BOSS_TAG: Record<BossKind, Tag> = { gym: 'fitness', arbor: 'arbor', shed: 'guitar', sleep: 'sleep', life: 'routine' }
export const BOSS_WHERE: Record<BossKind, string> = { gym: 'Strong', arbor: 'Arbor', shed: 'Woodshed', sleep: 'Vitals', life: 'Life OS' }

export interface BossTask {
  kind: BossKind
  /** which of the kind's templates was drawn */
  template: string
  /** the number to reach, in the template's own unit */
  target: number
  /** the skills or pieces it names, when it names any */
  items?: string[]
  /** share of the boss's HP */
  share: number
  /** what to do, as one line */
  text: string
}
export interface BossCard {
  /** the Monday of its week */
  week: string
  /** the first stage of its line: what is caught */
  species: string
  /** the form it is shown and fought as (its last stage, or a Mega) */
  form: string
  rarity: 'R' | 'L'
  mega: boolean
  level: number
  tasks: BossTask[]
}

const isKind = (x: unknown): x is BossKind => typeof x === 'string' && (BOSS_KINDS as string[]).includes(x)
function parseCard(week: string, raw: unknown): BossCard | null {
  try {
    const c = JSON.parse(String(raw)) as Partial<BossCard>
    if (typeof c.species !== 'string' || typeof c.form !== 'string' || typeof c.level !== 'number' || !Array.isArray(c.tasks)) return null
    const tasks = c.tasks
      .filter((t) => isKind(t?.kind) && typeof t.target === 'number' && typeof t.share === 'number' && typeof t.text === 'string')
      .map((t) => ({ kind: t.kind, template: String(t.template ?? ''), target: t.target, share: t.share, text: t.text, ...(Array.isArray(t.items) ? { items: t.items.map(String) } : {}) }))
    if (!tasks.length) return null
    return { week, species: c.species, form: c.form, rarity: c.rarity === 'L' ? 'L' : 'R', mega: c.mega === true, level: Math.max(1, Math.round(c.level)), tasks }
  } catch {
    return null // a malformed card is no card: that week has no boss
  }
}

export interface BossInput {
  /** week (its Monday) → the card. The first one written for a week stands. */
  cards: Record<string, BossCard>
  /** day → each task's progress so far that week, 0 to 1, in the card's order. The last one written for a day stands. */
  days: Record<string, number[]>
}

/** Pass events oldest first. */
export function bossOf(events: GameEvent[]): BossInput {
  const out: BossInput = { cards: {}, days: {} }
  for (const ev of events) {
    if (ev.type === CARD_EVENT) {
      if (out.cards[ev.day]) continue // the first card of a week stands: a second device cannot redraw it
      const card = parseCard(ev.day, ev.payload?.card)
      if (card) out.cards[ev.day] = card
    } else if (ev.type === BOSS_DAY_EVENT) {
      try {
        const p = JSON.parse(String(ev.payload?.p)) as unknown[]
        if (Array.isArray(p)) out.days[ev.day] = p.map((x) => Math.max(0, Math.min(1, Number(x) || 0)))
      } catch { /* a malformed day is no day */ }
    }
  }
  return out
}

/** Would writing these numbers for a day change what stands? Asked before writing, so the same progress is not sent over and over. */
export function bossDayChanged(stands: number[] | undefined, p: number[]): boolean {
  if (!stands) return p.some((x) => x > 0) // nothing written yet, and nothing to say: leave it unwritten
  if (stands.length !== p.length) return true
  return p.some((x, i) => Math.abs(x - stands[i]) > 0.0005)
}

// ── the arithmetic ──────────────────────────────────────────────────────────
export interface Member { level: number; rarity: Rarity; mega: boolean }
export const memberPower = (m: Member): number => m.level * RARITY_POWER[m.rarity] * (m.mega ? MEGA_POWER : 1)
export const bossFactor = (card: Pick<BossCard, 'rarity' | 'mega'>): number => BOSS_FACTOR[card.rarity] * (card.mega ? BOSS_MEGA_FACTOR : 1)
/** How hard this party hits this boss, 0.12 to 1: the six powers against six of the boss. */
export function strikeOf(party: Member[], card: Pick<BossCard, 'level' | 'rarity' | 'mega'>): number {
  const power = party.reduce((sum, m) => sum + memberPower(m), 0)
  const ratio = power / (BOSS_PARTY * card.level * bossFactor(card))
  return Math.max(STRIKE_MIN, Math.min(1, Math.pow(ratio, STRIKE_CURVE)))
}
/** The work on the card so far: each task's share times how far it is. */
export const cardWork = (card: BossCard, p: number[]): number => card.tasks.reduce((sum, t, i) => sum + t.share * Math.max(0, Math.min(1, p[i] ?? 0)), 0)
export const cardDone = (card: BossCard, p: number[]): boolean => card.tasks.every((_, i) => (p[i] ?? 0) >= 1)

/** The chance one throw catches it: what the party and the week earned, less for the HP it still has and for being outmatched. */
export function catchChance(item: string, trained: number, allTasks: boolean, hpLeft: number, strike = 1): number {
  if (!BALLS[item]) return 0
  if (item === 'master-ball') return CATCH_MASTER
  const base = Math.max(0.05, Math.min(1, CATCH_BASE + CATCH_PER_TRAINED * Math.min(5, trained) + (allTasks ? CATCH_ALL_TASKS : 0) + (CATCH_BALL[item] ?? 0)))
  const hp = Math.max(0, 1 - CATCH_HP_COST * Math.max(0, Math.min(1, hpLeft)))
  return base * hp * (CATCH_STRIKE_FLOOR + (1 - CATCH_STRIKE_FLOOR) * Math.max(0, Math.min(1, strike)))
}
/** What three throws come to: the chance of a catch in a week, for telling the player. */
export const weekChance = (one: number, throws = THROWS): number => 1 - Math.pow(1 - Math.max(0, Math.min(1, one)), throws)
