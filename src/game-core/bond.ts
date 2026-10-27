// Version 16: bonds that travel (RULES-V16.md).
//
// A bond is two things now. The five perks (Pickup, Endure, Focus, Best
// friends, Exp. Share) are the trainer's, from every heart across every
// Pokemon owned. And each Pokemon has a signature of its own, from its first
// type, in one of six families, one for each kind of work. Its strength is the
// Pokemon's bond level as partner, half that in the party; one family's
// strengths add up to SIG_CAP. Pure data and small functions: fold.ts applies them.
import type { HabitFact } from './facts.ts'
import { BOND_PERKS, HEART_LEVELS, type BondPerk, type Tag } from './rules.ts'
import { rng, type Option } from './economy.ts'
import { SPECIES } from './species.ts'
import { TYPE_DOMAIN } from './types.ts'

/** Trainer bond levels: hearts across every Pokemon owned. Each level unlocks the next perk in BOND_PERKS. */
export const TRAINER_LEVELS = [10, 40, 100, 200, 350] as const
export const trainerLevel = (hearts: number): number => TRAINER_LEVELS.filter((n) => hearts >= n).length

/** A party member's signature works at this share of its strength. */
export const SIG_PARTY = 0.5
/** One family's strengths add up to at most this. */
export const SIG_CAP = 10
/** What a point of strength does, family by family (see SIG_FAMILY). */
export const SIG_POWER = 0.04
export const SIG_INSIGHT = 8
export const SIG_CHARM = 6
export const SIG_FORAGE = 0.1
export const SIG_FLOW = 0.05
/** Hearts a Dream night gives: one each to this many of the party, partner first. */
export const dreamHearts = (s: number): number => Math.ceil(s / 2)
/** A berry fed on a day its Pokemon's kind of work was done counts this many times. */
export const BERRY_DOMAIN_MULT = 2

export type SigFamily = 'power' | 'insight' | 'charm' | 'forage' | 'dream' | 'flow'
/** Which family each kind of work gives. */
export const SIG_FAMILY: Record<Tag, SigFamily> = { fitness: 'power', code: 'insight', guitar: 'charm', arbor: 'forage', sleep: 'dream', routine: 'flow' }
export const FAMILY_NAME: Record<SigFamily, string> = { power: 'Power', insight: 'Insight', charm: 'Charm', forage: 'Forage', dream: 'Dream', flow: 'Flow' }

/** Each type's signature: its name (an ability of that type) and its picture (that type's own held item). */
export const SIGNATURES: Record<string, { name: string; icon: string }> = {
  Fighting: { name: 'Guts', icon: 'black-belt' }, Rock: { name: 'Sturdy', icon: 'hard-stone' }, Ground: { name: 'Sand Force', icon: 'soft-sand' },
  Steel: { name: 'Heavy Metal', icon: 'metal-coat' }, Fire: { name: 'Blaze', icon: 'charcoal' }, Dragon: { name: 'Rough Skin', icon: 'dragon-fang' },
  Psychic: { name: 'Forewarn', icon: 'twistedspoon' }, Electric: { name: 'Static', icon: 'magnet' }, Ghost: { name: 'Frisk', icon: 'spell-tag' },
  Fairy: { name: 'Cute Charm', icon: 'pink-scarf' }, Normal: { name: 'Serene Grace', icon: 'silk-scarf' }, Flying: { name: 'Keen Eye', icon: 'sharp-beak' },
  Grass: { name: 'Harvest', icon: 'miracle-seed' }, Dark: { name: 'Bad Dreams', icon: 'blackglasses' },
  Water: { name: 'Swift Swim', icon: 'mystic-water' }, Ice: { name: 'Snow Cloak', icon: 'nevermeltice' }, Bug: { name: 'Swarm', icon: 'silverpowder' }, Poison: { name: 'Stench', icon: 'poison-barb' },
}

export interface Signature { type: string; name: string; icon: string; tag: Tag; family: SigFamily }
/** A Pokemon's signature, from the first type of the form it is now. */
export function signatureOf(form: string): Signature {
  const type = SPECIES[form]?.t ?? 'Normal'
  const tag = TYPE_DOMAIN[type] ?? 'routine'
  const s = SIGNATURES[type] ?? SIGNATURES.Normal
  return { type, name: s.name, icon: s.icon, tag, family: SIG_FAMILY[tag] }
}

/** A signature's strength from a bond level: in full as partner, SIG_PARTY of it in the party. */
export const sigStrength = (bond: number, partner: boolean): number => (partner ? bond : bond * SIG_PARTY)

/** What a family does at strength `s`, in a line. */
export function sigText(family: SigFamily, s: number): string {
  const n = Math.round(s * 10) / 10
  switch (family) {
    case 'power': return `Gym work strikes the leader +${Math.round(SIG_POWER * s * 100)}%`
    case 'insight': return `A code day adds ${Math.round(SIG_INSIGHT * s)} research points`
    case 'charm': return `A guitar day takes ${Math.round(SIG_CHARM * s)} more HP off the wild Pokemon`
    case 'forage': return `An Arbor morning finds a berry ${Math.round(Math.min(0.9, SIG_FORAGE * s) * 100)}% of the time`
    case 'dream': return `A night of 80+ gives ${dreamHearts(s)} of the party a heart`
    case 'flow': return `Routine habits pay +${Math.round(SIG_FLOW * s * 100)}% XP`
  }
  return `${n}`
}

/**
 * Was this kind of work done on the day? A pillar of it done; for sleep, a
 * measured night that filled the pillar; for routine, at least half the
 * routine habits. It decides a party member's heart and a berry's double.
 */
export function didWork(tag: Tag, habits: HabitFact[]): boolean {
  if (tag === 'routine') {
    const r = habits.filter((h) => h.tag === 'routine')
    return r.length > 0 && r.filter((h) => h.done).length * 2 >= r.length
  }
  return habits.some((h) => h.pillar && h.tag === tag && (h.done || h.frac >= 1))
}

/** Hearts a bond level needs, for the next step from `hearts` (null at the last). */
export const nextHearts = (hearts: number): number | null => HEART_LEVELS.find((n) => hearts < n) ?? null

// ── past the last trainer level: Trainer stars ──
/** After the last trainer level, every this many hearts more is a Trainer star: a choice of two perks to rank up. */
export const STAR_EVERY = 150
/** No perk goes past this rank. */
export const STAR_MAX = 5
/** What a rank adds, perk by perk. Endure comes back a day sooner a rank, down to STAR_ENDURE_MIN days. */
export const STAR_PICKUP = 0.05
export const STAR_FOCUS = 0.03
export const STAR_FRIENDS = 0.03
export const STAR_SHARE = 0.03
export const STAR_ENDURE_MIN = 3
export const PERK_NAME: Record<BondPerk, string> = { pickup: 'Pickup', endure: 'Endure', focus: 'Focus', friends: 'Best friends', share: 'Exp. Share' }
/** How many stars these hearts have earned. */
export const starsFor = (hearts: number): number => Math.max(0, Math.floor((hearts - TRAINER_LEVELS[TRAINER_LEVELS.length - 1]) / STAR_EVERY))
/** The hearts the next star takes. */
export const nextStarAt = (hearts: number): number => TRAINER_LEVELS[TRAINER_LEVELS.length - 1] + (starsFor(hearts) + 1) * STAR_EVERY
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI']
/** "Focus III": a perk at a rank. Rank 0 is the perk as it unlocked. */
export const rankName = (perk: BondPerk, rank: number): string => `${PERK_NAME[perk]}${rank > 0 ? ` ${ROMAN[rank + 1] ?? rank + 1}` : ''}`
/** The two perks star `n` offers, from those not yet at STAR_MAX, seeded so every device offers the same. With every perk full, gems. */
export function starOptions(n: number, ranks: Record<BondPerk, number>): [Option, Option] {
  const open = BOND_PERKS.filter((p) => ranks[p] < STAR_MAX)
  const r = rng(`trainer-star:${n}`)
  const pick = [...open].sort(() => r() - 0.5).slice(0, 2)
  const opt = (p: BondPerk | undefined): Option => (p ? { name: rankName(p, ranks[p] + 1), coins: 0, gems: 0, items: [], perk: p } : { name: '25 gems', coins: 0, gems: 25, items: [] })
  return [opt(pick[0]), opt(pick[1])]
}
