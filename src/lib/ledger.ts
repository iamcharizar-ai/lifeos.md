// Derived XP over the event ledger. Habit ticks are the only thing this app
// writes; steps / sleep / water / workouts arrive as events from the external
// Health and Strong pipelines and are folded here, so they still pay XP even
// though LifeOS itself has no screen to enter them on.
import { getHabits } from './habitConfig'
import { isActiveOn } from '../config/habits'
import { capDay, dayBonus, habitXp, sleepXp, stepsXp, waterXp, WORKOUT_XP } from './xp'
import { streakFor, type Ticks } from './store'
import type { WorkoutSummary } from './workout'

export interface DayMetrics {
  weight?: string
  kcal?: string
  protein?: string
}

export interface DayHealth {
  steps?: string
  sleep?: string
  hr?: string
  /** total ml drunk today */
  water?: string
  /** ISO of the last water log — drives the Health-tab thirst ping */
  waterAt?: string
  /** JSON FoodLogEntry[] written by the Health pipeline */
  foods?: string
  /** sleep times, "23:30" / "07:00" */
  bed?: string
  wake?: string
}

export interface DayWorkout {
  type: string
  at: string
  /** Phase 4 tracked session — absent on quick-logged / pre-v0.9 workouts */
  session?: WorkoutSummary
}

export type MetricsMap = Record<string, DayMetrics>
export type HealthMap = Record<string, DayHealth>
export type WorkoutMap = Record<string, DayWorkout>

export interface Stores {
  ticks: Ticks
  metrics: MetricsMap
  health: HealthMap
  workouts: WorkoutMap
}

const METRICS_KEY = 'lifeos.metrics.v1'
const HEALTH_KEY = 'lifeos.health.v1'
const WORKOUTS_KEY = 'lifeos.workouts.v1'

export const METRICS_BONUS = 5
/** Daily hydration target the Health pipeline is scored against. */
export const WATER_TARGET_ML = 3000

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

export const loadMetrics = () => loadJson<MetricsMap>(METRICS_KEY, {})
export const saveMetrics = (m: MetricsMap) => localStorage.setItem(METRICS_KEY, JSON.stringify(m))
export const loadHealth = () => loadJson<HealthMap>(HEALTH_KEY, {})
export const saveHealth = (h: HealthMap) => localStorage.setItem(HEALTH_KEY, JSON.stringify(h))
export const loadWorkouts = () => loadJson<WorkoutMap>(WORKOUTS_KEY, {})
export const saveWorkouts = (w: WorkoutMap) =>
  localStorage.setItem(WORKOUTS_KEY, JSON.stringify(w))

export function metricsComplete(m: DayMetrics | undefined): boolean {
  return Boolean(m?.weight && m?.kcal && m?.protein)
}

/** Sleep hours from bed/wake times (bed may be before or after midnight). */
export function healthEarned(h: DayHealth | undefined): number {
  if (!h) return 0
  return (
    stepsXp(parseFloat(h.steps ?? '0') || 0) +
    sleepXp(parseFloat(h.sleep ?? '0') || 0) +
    waterXp(parseFloat(h.water ?? '0') || 0, WATER_TARGET_ML)
  )
}

/** Total XP earned on one day: habits (streak-adjusted) + health + workout + bonuses, capped. */
export function dayEarned(s: Stores, date: string): number {
  // Score each day against the checklist as it stood *that* day — otherwise
  // dropping a habit today silently rewrites every past day's XP and bonus.
  const habits = getHabits().filter((h) => isActiveOn(h, date) || Boolean(s.ticks[date]?.[h.id]))
  let base = 0
  let done = 0
  for (const h of habits) {
    if (s.ticks[date]?.[h.id]) {
      done++
      base += habitXp(h.tier, streakFor(s.ticks, h.id, date))
    }
  }
  base += healthEarned(s.health[date])
  if (s.workouts[date]) base += WORKOUT_XP
  if (base === 0) return 0
  // No habits scheduled that day → no "all done" bonus to award, or a day with
  // an empty checklist would pay 50 XP for a workout alone.
  const bonus =
    (habits.length > 0 ? dayBonus(done, habits.length) : 0) +
    (metricsComplete(s.metrics[date]) ? METRICS_BONUS : 0)
  return capDay(base + bonus)
}
