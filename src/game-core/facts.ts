// Turns what the apps know (habits, ticks, the Arbor and Woodshed blocks) into
// one plain list of days. The game itself (fold.ts) only ever sees this list,
// so Life OS and Pokedex cannot disagree about what happened on a day.
import type { ListedHabit } from './events.ts'
import { ARBOR_HABIT, GAME_START, GRACE_DAYS, GUITAR_HABIT, SLEEP_DONE, SLEEP_HABIT, TIER_XP, V3_START, V4_START, V6_START, isTag, tagOf, tierXp, type Tag } from './rules.ts'

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

/** The first day the band reported a sleep score: from then on Sleep is measured, never ticked. null = no band yet. */
export function bandFrom(input: FactsInput): string | null {
  let first: string | null = null
  for (const [day, b] of Object.entries(input.body ?? {})) if (typeof b.sleepScore === 'number' && (first === null || day < first)) first = day
  return first
}

export function factsFor(input: FactsInput, day: string, band: string | null = bandFrom(input)): DayFacts {
  const ticks = input.ticks[day] ?? {}
  const habits: HabitFact[] = []
  const body = input.body?.[day]
  const uses = input.uses?.filter((u) => u.day === day)
  // the day's own frozen list when there is one: editing or deleting a habit later cannot change what this day was
  const frozen = input.lists?.[day]
  const byId = new Map(input.habits.map((h) => [h.id, h]))
  const todays: HabitLite[] = frozen
    ? frozen.map((f) => ({ ...(byId.get(f.id) ?? { id: f.id, spans: [] }), id: f.id, tier: f.tier, domain: f.tag }))
    : input.habits.filter((h) => activeOn(h, day)).map((h) => (day >= V4_START ? h : { ...h, domain: undefined }))
  for (const h of todays) {
    // version 2, with a band: Sleep is a pillar paid on last night's score, and a hand tick no longer counts
    // from version 6, no reading is not a miss: that morning's habit is a hand tick, paid as a core habit and not a pillar
    const unread = h.id === SLEEP_HABIT && day >= V3_START && band !== null && day >= band && typeof body?.sleepScore !== 'number' && day >= V6_START
    if (h.id === SLEEP_HABIT && day >= V3_START && band !== null && day >= band && !unread) {
      const score = Math.max(0, Math.min(100, body?.sleepScore ?? 0))
      habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag: 'sleep', worth: TIER_XP.pillar, pillar: true, frac: score / 100, done: score >= SLEEP_DONE, measured: true })
      continue
    }
    const done = inTime(ticks[h.id], day)
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
    habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag: isTag(h.domain) ? h.domain : tagOf(h.id), worth: unread ? TIER_XP.core : tierXp(h.tier), pillar: unread ? false : h.tier === 'pillar', frac, done, ...(unread ? { selfReported: true as const } : {}) })
  }
  const marks = input.marks?.[day]
  return { day, habits, ...(body ? { body } : {}), ...(uses?.length ? { uses } : {}), ...(marks ? { marks } : {}) }
}

/** Every day of the game so far, oldest first. */
export function buildFacts(input: FactsInput): DayFacts[] {
  const out: DayFacts[] = []
  const band = bandFrom(input)
  for (let day = GAME_START; day <= input.today; day = addDays(day, 1)) out.push(factsFor(input, day, band))
  return out
}
