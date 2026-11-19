// Steps and Water: two habits Google Health fills, never your thumb.
//
// Each day's reading comes down the ledger as a `vitals` row (steps already did; water is `waterMl`, bridge/map.ts).
// The habit's tile fills with how far you are, and the habit is ticked only when the goal is reached: 100% or nothing,
// so it pays a core habit's XP (30) the usual way, through an ordinary tick, and the game core needs no new rule.
// Under 100% the tile shows the percentage, like Sleep shows its score, but it pays nothing and counts as missed.
import { isActiveOn, type Habit } from '../config/habits.ts'

export const STEPS_HABIT = 'steps-goal'
export const WATER_HABIT = 'water-goal'

/** The day's goals. Steps is Google Health's usual 10,000 (the API does not hand the goal over); water is 4 litres. */
export const STEPS_GOAL = 10_000
export const WATER_GOAL_ML = 4_000

export type VitalKind = 'steps' | 'water'

export const vitalKindOf = (habitId: string): VitalKind | null => (habitId === STEPS_HABIT ? 'steps' : habitId === WATER_HABIT ? 'water' : null)
export const isVitalHabit = (habitId: string): boolean => vitalKindOf(habitId) !== null
export const goalOf = (kind: VitalKind): number => (kind === 'steps' ? STEPS_GOAL : WATER_GOAL_ML)

/** What Google Health said about one day. A field it did not report is absent, never 0. */
export interface DayReadings {
  steps?: number
  waterMl?: number
}
export const readingOf = (kind: VitalKind, r: DayReadings | undefined): number | undefined => (kind === 'steps' ? r?.steps : r?.waterMl)

export interface VitalProgress {
  /** how much has been logged; null = no reading yet */
  value: number | null
  goal: number
  /** whole percent, rounded down so 99.6% never reads as done */
  pct: number
  done: boolean
}

export function progressOf(kind: VitalKind, reading: number | undefined): VitalProgress {
  const goal = goalOf(kind)
  if (typeof reading !== 'number' || !Number.isFinite(reading) || reading < 0) return { value: null, goal, pct: 0, done: false }
  return { value: reading, goal, pct: Math.min(100, Math.floor((reading / goal) * 100)), done: reading >= goal }
}

export interface TickFix {
  habitId: string
  day: string
  on: boolean
}

/**
 * Which ticks must change so each of these days agrees with what Google Health says. Only a day with a reading is judged
 * (no reading is not a miss), only a habit that was on the checklist that day, and only the goal decides: reached means
 * ticked, below it means not. Pass today and yesterday: yesterday's total can land after midnight.
 */
export function tickFixes(habits: Habit[], ticks: Record<string, Record<string, string>>, readings: (day: string) => DayReadings | undefined, days: string[]): TickFix[] {
  const out: TickFix[] = []
  for (const day of days)
    for (const h of habits) {
      const kind = vitalKindOf(h.id)
      if (!kind || !isActiveOn(h, day)) continue
      const reading = readingOf(kind, readings(day))
      if (reading === undefined) continue
      const on = progressOf(kind, reading).done
      if (on !== Boolean(ticks[day]?.[h.id])) out.push({ habitId: h.id, day, on })
    }
  return out
}
