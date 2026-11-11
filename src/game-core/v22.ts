// Version 22's arithmetic (GAME-SPEC-V22.md), as small pure functions the fold calls. No state, no dates: the fold decides when they apply.
import type { HabitFact } from './facts.ts'
import { BERRY_FAVOURITE, BERRY_PLAIN, DAY_HIT_MULT, EFFORT_TAGS, LAB_FINAL, LAB_SHINY, MAX_DAY_CHORES, PILLAR_HIT, POWER_HEART, POWER_LEVEL, POWER_MEGA_X, POWER_PARTNER_X, POWER_TRAINER, POWER_TYPE_X, WEAK_HIT, trainerLevelV22, v22On, type Tag } from './rules.ts'
import { BERRY_HEARTS, BERRY_OF, FRIEND_BERRY } from './economy.ts'
import { BERRY_DOMAIN_MULT, signatureOf } from './bond.ts'

const done = (h: HabitFact): boolean => h.done || h.frac >= 1

/**
 * The day's pillars (spec section 2). Effort pillars are the listed pillars that are not Sleep. A good night is a pillar only beside an effort
 * pillar: on a day with none it pays its own XP and counts for nothing else, here or anywhere.
 */
export function pillarsOf(habits: HabitFact[]): { effort: Tag[]; sleep: boolean; done: Tag[]; listed: number } {
  const pillars = habits.filter((h) => h.pillar)
  const effort = pillars.filter((h) => EFFORT_TAGS.includes(h.tag) && done(h)).map((h) => h.tag)
  const sleep = effort.length > 0 && pillars.some((h) => h.tag === 'sleep' && done(h))
  return { effort, sleep, done: sleep ? [...effort, 'sleep'] : effort, listed: pillars.length }
}

/** The tier: pillars done, 1 to 3; Max (4) is every pillar on the list done and three-quarters of the chores. 0 with no effort pillar. */
export function tierOf(habits: HabitFact[]): number {
  const p = pillarsOf(habits)
  if (!p.effort.length) return 0
  const chores = habits.filter((h) => !h.pillar && h.measured !== true)
  const choreShare = chores.length ? chores.filter(done).length / chores.length : 0
  return p.done.length >= p.listed && choreShare >= MAX_DAY_CHORES ? 4 : Math.min(3, p.done.length)
}

/** One member of the party, as party power reads it. */
export interface Fighter { level: number; hearts: number; /** bond level, 0 to 5 */ bond: number; beats: boolean; mega: boolean; partner: boolean; /** the partner holds an Expert Belt: a type that beats the foe counts three times, not two */ belt?: boolean }
/** One member's share (5.3): level and bond, doubled for a type that beats the foe, doubled again for a Mega, the partner's counted twice. */
export const shareOf = (m: Fighter): number =>
  (m.level * POWER_LEVEL + m.bond * POWER_HEART) * (m.beats ? (m.belt ? POWER_TYPE_X + 1 : POWER_TYPE_X) : 1) * (m.mega ? POWER_MEGA_X : 1) * (m.partner ? POWER_PARTNER_X : 1)
/** Party power: the sum of the six, plus the Trainer's levels. */
export const partyPower = (party: Fighter[], trainerHearts: number): number => party.reduce((n, m) => n + shareOf(m), 0) + POWER_TRAINER * trainerLevelV22(trainerHearts)

/**
 * The gym leader's hit (3.4): each pillar done is PILLAR_HIT, or WEAK_HIT if the leader is weak to it, times (1 + party power). The caller applies the day's tier
 * multiplier (DAY_HIT_MULT) once, to the whole. Chores do not hit.
 */
export const leaderHit = (pillars: Tag[], weak: Tag[], power: number): number =>
  pillars.reduce((n, t) => n + (weak.includes(t) ? WEAK_HIT : PILLAR_HIT), 0) * (1 + power)
/** What a Pokemon is worth to the Lab (spec 5.4): its level (to 50), LAB_FINAL more in its last form, half as much again when shiny. */
export const labWorth = (level: number, final: boolean, shiny: boolean): number => (Math.min(level, 50) + (final ? LAB_FINAL : 0)) * (shiny ? LAB_SHINY : 1)
export const tierHit = (tier: number): number => DAY_HIT_MULT[tier] ?? 1

/**
 * Hearts one berry gives one Pokemon (spec 4.2), the same answer for the fold's rule and for every screen that previews it. From V22_START one of the six
 * berries is BERRY_PLAIN, or BERRY_FAVOURITE for the Pokemon that likes it best; before it, the berry's own hearts, doubled on a day of its kind of work.
 */
export function berryGain(item: string, form: string, day: string, workedToday: boolean): number {
  if (v22On(day) && FRIEND_BERRY[item]) return BERRY_OF[signatureOf(form).tag] === item ? BERRY_FAVOURITE : BERRY_PLAIN
  return (BERRY_HEARTS[item] ?? 0) * (workedToday ? BERRY_DOMAIN_MULT : 1)
}
/** Is this berry this Pokemon's favourite? (From V22_START only.) */
export const likesBerry = (item: string, form: string, day: string): boolean => v22On(day) && BERRY_OF[signatureOf(form).tag] === item
