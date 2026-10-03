// Turns what the apps know (habits, ticks, the Arbor and Woodshed blocks) into
// one plain list of days. The game itself (fold.ts) only ever sees this list,
// so Life OS and Pokedex cannot disagree about what happened on a day.
import { ARBOR_HABIT, GAME_START, GRACE_DAYS, GUITAR_HABIT, tagOf, tierXp, type Tag } from './rules.ts'

export interface HabitLite {
  id: string
  tier: string
  /** shown by the Pokedex; the game itself never looks at it */
  name?: string
  emoji?: string
  /** `[from, to)` stretches the habit was on the checklist; `to: null` = still on */
  spans: { from: string; to: string | null }[]
}

/** date → habitId → ISO time it was ticked */
export type TickMap = Record<string, Record<string, string>>

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
  today: string
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
}

export interface DayFacts {
  day: string
  habits: HabitFact[]
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

export function factsFor(input: FactsInput, day: string): DayFacts {
  const ticks = input.ticks[day] ?? {}
  const habits: HabitFact[] = []
  for (const h of input.habits) {
    if (!activeOn(h, day)) continue
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
    habits.push({ id: h.id, name: h.name, emoji: h.emoji, tag: tagOf(h.id), worth: tierXp(h.tier), pillar: h.tier === 'pillar', frac, done })
  }
  return { day, habits }
}

/** Every day of the game so far, oldest first. */
export function buildFacts(input: FactsInput): DayFacts[] {
  const out: DayFacts[] = []
  for (let day = GAME_START; day <= input.today; day = addDays(day, 1)) out.push(factsFor(input, day))
  return out
}
