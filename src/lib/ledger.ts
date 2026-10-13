// The side stores folded from the event ledger next to the habit ticks:
// metrics, health readings and workouts. (XP is worked out by game-core.)
import type { Ticks } from './store'
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
