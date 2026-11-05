// Turns what the apps know (habits, ticks, the Arbor and Woodshed blocks) into
// one plain list of days. The game itself (fold.ts) only ever sees this list,
// so Life OS and Pokedex cannot disagree about what happened on a day.
import { liveCard, type BossCard, type BossInput } from './boss.ts'
import type { ListedHabit } from './events.ts'
import { ARBOR_HABIT, GAME_START, GRACE_DAYS, GUITAR_HABIT, REVIEW_HABIT, SLEEP_DONE, SLEEP_HABIT, TIER_XP, V13_START, V14_START, V18_START, V21_START, VERIFIED_BY, isTag, tagOf, tierXp, type Tag } from './rules.ts'

export interface HabitLite {
  id: string
  tier: string
  /** shown by the Pokedex; the game itself never looks at it */
  name?: string
  emoji?: string
  /** the domain set on the habit in Life OS; without one the id decides (tagOf) */
  domain?: string
  /** `[from, to)` stretches the habit was on the checklist; `to: null` = still on */
  spans: { from: string; to: string | null }[]
}

/** date → habitId → ISO time it was ticked */
export type TickMap = Record<string, Record<string, string>>

/** What the band measured for a day. Only the Vitals sync writes these, so their presence means the band is in use. */
export interface BodyFacts {
  /** 0-100, for the sleep that ended on the morning of this day */
  sleepScore?: number
  steps?: number
  /** 0-100 */
  recovery?: number
  /** minutes of deep sleep in the night that ended on this day */
  deepMin?: number
}
/** A stone spent from the Bag on one Pokemon. */
export interface ItemUse {
  day: string
  item: string
  uid: string
  /** 'mega' | 'branch' | 'lead' (see StoneUse in rules.ts), 'next': who follows the partner, or 'show': which registered form to draw. From version 4 none of them costs anything */
  what: string
  /** the Mega form or the branch chosen */
  to?: string
}

export interface FactsInput {
  habits: HabitLite[]
  ticks: TickMap
  /** the day's frozen Arbor plan and what was practised (arbor-core's ArborState fits) */
  arbor?: {
    plans: Record<string, { morning: string[] }>
    practice: Record<string, Record<string, { done: boolean; at: string }>>
  }
  /** the day's frozen Woodshed session and its logs (woodshed-core's ShedState fits) */
  shed?: {
    plans: Record<string, { items: string[] }>
    logs: Record<string, Record<string, { done: boolean; at: string }>>
  }
  /** day → the habit list as it stood that day, written by Life OS on the day itself. A day without one falls back to the library and its spans. */
  lists?: Record<string, ListedHabit[]>
  /** day → what the band measured */
  body?: Record<string, BodyFacts>
  /** items used from the Bag, in the order they were used */
  uses?: ItemUse[]
  /** day → what the other apps recorded in their own units (see DayMarks) */
  marks?: Record<string, DayMarks>
  /** the weekly boss: each week's card and each day's progress on it, as written to the ledger (boss.ts) */
  boss?: BossInput
  today: string
}

/**
 * A day in each domain's own unit, for the field notes. Only the Pokedex fills
 * these in today (it reads the workouts and the guitar logs); nothing in the
 * game depends on them yet.
 */
export interface DayMarks {
  /** workouts finished */
  workouts?: number
  /** lifts that beat every earlier session */
  records?: number
  /** guitar items played clean at their target tempo */
  clean?: number
  /** song parts that became owned on this day */
  owned?: number
  /** the routine of each Strong workout finished on this day (a routine you made yourself is not listed), one entry per workout */
  gear?: string[]
}

export interface HabitFact {
  id: string
  name?: string
  emoji?: string
  tag: Tag
  /** XP this habit is worth when fully done */
  worth: number
  pillar: boolean
  /** 0..1 share done, in time */
  frac: number
  /** ticked, in time: what a perfect day needs */
  done: boolean
  /** set by the band, not by a tick */
  measured?: true
  /** version 6: the band is in use but has no reading for this morning, so the habit is a hand tick worth a core habit (SLEEP-DESIGN.md D2) */
  selfReported?: true
}

export interface DayFacts {
  day: string
  habits: HabitFact[]
  body?: BodyFacts
  uses?: ItemUse[]
  marks?: DayMarks
  /** month-end reviews ticked on this day (by the day the tick was made, not the month it closes) */
  reviews?: number
  /** this week's boss card, and how far each of its tasks is by the end of this day (from version 18 without the tasks of a shelved kind of work) */
  boss?: { card: BossCard; p: number[] }
  /** version 18: the kinds of work with a habit on this day's list. Absent before version 18 and while the list is empty (nothing is shelved then). */
  live?: Tag[]
}

/** The Monday of the week a day is in. */
export function mondayOf(day: string): string {
  const dow = new Date(day + 'T12:00:00').getDay() // 0 Sun
  return addDays(day, -((dow + 6) % 7))
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Was something stamped `at` done in time to count for `day`? */
export function inTime(at: string | undefined, day: string): boolean {
  if (!at) return false
  const t = Date.parse(at)
  if (Number.isNaN(t)) return true // an old tick without a usable stamp: take it
  return t < new Date(addDays(day, GRACE_DAYS + 1) + 'T00:00:00').getTime()
}

const activeOn = (h: HabitLite, day: string): boolean =>
  h.spans.some((s) => day >= s.from && (s.to === null || day < s.to))

const localDay = (t: number): string => {
  const d = new Date(t)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const reviewDays = new WeakMap<TickMap, Record<string, number>>()
/** Month-end reviews made on `day`. A review of month M sits under `M-01`, so it is found by the time of the tick. */
function reviewsOn(ticks: TickMap, day: string): number {
  let by = reviewDays.get(ticks)
  if (!by) {
    by = {}
    for (const [filed, habits] of Object.entries(ticks)) {
      const at = habits[REVIEW_HABIT]
      if (!at) continue
      const t = Date.parse(at)
      const made = Number.isNaN(t) ? filed : localDay(t)
      by[made] = (by[made] ?? 0) + 1
    }
    reviewDays.set(ticks, by)
  }
  return by[day] ?? 0
}

/** The first day the band reported a sleep score: from then on Sleep is measured, never ticked. null = no band yet. */
export function bandFrom(input: FactsInput): string | null {
  let first: string | null = null
  for (const [day, b] of Object.entries(input.body ?? {})) if (typeof b.sleepScore === 'number' && (first === null || day < first)) first = day
  return first
}

/** The habits on a day's list: its own frozen list when there is one (editing or deleting a habit later cannot change what that day was), else the library by spans. */
function listedOn(input: FactsInput, day: string): HabitLite[] {
  const frozen = input.lists?.[day]
  const byId = new Map(input.habits.map((h) => [h.id, h]))
  return frozen
    ? frozen.map((f) => ({ ...(byId.get(f.id) ?? { id: f.id, spans: [] }), id: f.id, tier: f.tier, domain: f.tag }))
    : input.habits.filter((h) => activeOn(h, day))
}
const tagOfListed = (h: HabitLite): Tag => (isTag(h.domain) ? h.domain : tagOf(h.id))

/**
 * Version 18: the kinds of work that have a habit on `day`'s list, or null when the list is empty (nothing loaded yet, so nothing can be
 * said to be shelved). Sleep also counts once the band is in use: its reading is the pillar even with the hand habit retired.
 */
export function liveTags(input: FactsInput, day: string, band: string | null = bandFrom(input)): Set<Tag> | null {
  const todays = listedOn(input, day)
  if (!todays.length) return null
  const out = new Set<Tag>(todays.map(tagOfListed))
  if (band !== null && day >= band) out.add('sleep')
  return out
}

export function factsFor(input: FactsInput, day: string, band: string | null = bandFrom(input)): DayFacts {
  const ticks = input.ticks[day] ?? {}
  const habits: HabitFact[] = []
  const body = input.body?.[day]
  const uses = input.uses?.filter((u) => u.day === day)
  const todays = listedOn(input, day)
  for (const h of todays) {
    // version 2, with a band: Sleep is a pillar paid on last night's score, and a hand tick no longer counts
    // from version 6, no reading is not a miss: that morning's habit is a hand tick, paid as a core habit and not a pillar
    const unread = h.id === SLEEP_HABIT && band !== null && day >= band && typeof body?.sleepScore !== 'number'
    // version 13: Sleep is the band's alone. With no reading it waits, and a day it never comes is simply not part of that day: never a miss
    // version 14: a night the band never read can be reported by hand, paid as a core habit (no Bells, no streaks). Unticked it is still not part of the day
    if (unread && day >= V13_START && (day < V14_START || !inTime(ticks[h.id], day))) continue
    if (h.id === SLEEP_HABIT && band !== null && day >= band && !unread) {
      const score = Math.max(0, Math.min(100, body?.sleepScore ?? 0))
      habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag: 'sleep', worth: TIER_XP.pillar, pillar: true, frac: score / 100, done: score >= SLEEP_DONE, measured: true })
      continue
    }
    const tag = isTag(h.domain) ? h.domain : tagOf(h.id)
    // version 21: a pillar with a verified source (rules.ts VERIFIED_BY: Gym is a logged Strong workout, any length) counts by that
    // source, not the tick; a tick without it is a basic habit
    const source = day >= V21_START && h.tier === 'pillar' ? VERIFIED_BY[tag] : undefined
    const verified = source ? (input.marks?.[day]?.[source] ?? 0) > 0 : false
    const done = source ? verified : inTime(ticks[h.id], day)
    let frac = done ? 1 : 0
    if (!done && h.id === ARBOR_HABIT) {
      const plan = input.arbor?.plans[day]?.morning ?? []
      const log = input.arbor?.practice[day] ?? {}
      if (plan.length) frac = plan.filter((id) => log[id]?.done && inTime(log[id].at, day)).length / plan.length
    }
    if (!done && h.id === GUITAR_HABIT) {
      const plan = input.shed?.plans[day]?.items ?? []
      const logs = input.shed?.logs ?? {}
      if (plan.length) frac = plan.filter((id) => logs[id]?.[day]?.done && inTime(logs[id][day].at, day)).length / plan.length
    }
    // version 21: a tick with no verified source behind it pays as a basic habit, never a pillar
    if (source && !verified && inTime(ticks[h.id], day)) { habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag: 'routine', worth: TIER_XP.basic, pillar: false, frac: 1, done: true }); continue }
    habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag, worth: unread ? TIER_XP.core : tierXp(h.tier), pillar: unread ? false : h.tier === 'pillar', frac, done, ...(unread ? { selfReported: true as const } : {}) })
  }
  // a band's reading is the Sleep pillar whether or not the hand-ticked habit is on the list (it can be retired once a band reports): sleep must never depend on a habit that is no longer there
  if (band !== null && day >= band && typeof body?.sleepScore === 'number' && !habits.some((x) => x.id === SLEEP_HABIT)) {
    const score = Math.max(0, Math.min(100, body.sleepScore))
    habits.push({ id: SLEEP_HABIT, name: 'Sleep', tag: 'sleep', worth: TIER_XP.pillar, pillar: true, frac: score / 100, done: score >= SLEEP_DONE, measured: true })
  }
  const marks = input.marks?.[day]
  const reviews = reviewsOn(input.ticks, day)
  // the boss: this week's card, with the newest progress written for this day or an earlier one of the week
  const card = input.boss?.cards[mondayOf(day)]
  let boss: DayFacts['boss']
  // version 18: the kinds of work with a habit on the list, which also decide what stays on a boss's card
  const live = day >= V18_START ? liveTags(input, day, band) : null
  if (card) {
    let p: number[] | undefined
    for (let d = day; d >= card.week && !p; d = addDays(d, -1)) p = input.boss?.days[d]
    const whole = card.tasks.map((_, i) => p?.[i] ?? 0)
    // a task of a kind that is shelved is off the card for the whole week, judged on the week's last day so far (the week's last, once it is over):
    // judged day by day, shelving a kind in mid-week would shift every share under the boss and heal it for work already done
    const ref = input.today < addDays(card.week, 6) ? input.today : addDays(card.week, 6)
    const kept = card.week >= V18_START ? liveCard(card, whole, ref === day ? live : liveTags(input, ref, band)) : { card, p: whole }
    boss = kept
  }
  return { day, habits, ...(body ? { body } : {}), ...(uses?.length ? { uses } : {}), ...(marks ? { marks } : {}), ...(reviews ? { reviews } : {}), ...(boss ? { boss } : {}), ...(live ? { live: [...live] } : {}) }
}

/** Every day of the game so far, oldest first. */
export function buildFacts(input: FactsInput): DayFacts[] {
  const out: DayFacts[] = []
  const band = bandFrom(input)
  for (let day = GAME_START; day <= input.today; day = addDays(day, 1)) out.push(factsFor(input, day, band))
  return out
}
