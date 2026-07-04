// Derived-state ledger over local events. Same shapes move to Supabase rows later —
// balance is always computed, never stored.
import { getHabits } from './habitConfig'
import { capDay, dayBonus, habitXp, sleepXp, stepsXp, WORKOUT_XP } from './xp'
import { dateISO, streakFor, type Ticks } from './store'
import type { WorkoutSummary } from './workout'

export interface Spend {
  id: string
  at: string // ISO timestamp
  hours: number
  xp: number
}

export interface DayMetrics {
  weight?: string
  kcal?: string
  protein?: string
}

export interface DayHealth {
  steps?: string
  sleep?: string
  hr?: string
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

const SPENDS_KEY = 'lifeos.spends.v1'
const METRICS_KEY = 'lifeos.metrics.v1'
const HEALTH_KEY = 'lifeos.health.v1'
const WORKOUTS_KEY = 'lifeos.workouts.v1'

export const METRICS_BONUS = 5
export const LEISURE_RATE = 100 // XP per hour of leisure

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

export const loadSpends = () => loadJson<Spend[]>(SPENDS_KEY, [])
export const saveSpends = (s: Spend[]) => localStorage.setItem(SPENDS_KEY, JSON.stringify(s))
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

export function healthEarned(h: DayHealth | undefined): number {
  if (!h) return 0
  return stepsXp(parseFloat(h.steps ?? '0') || 0) + sleepXp(parseFloat(h.sleep ?? '0') || 0)
}

/** Total XP earned on one day: habits (streak-adjusted) + health + workout + bonuses, capped. */
export function dayEarned(s: Stores, date: string): number {
  const habits = getHabits()
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
  const bonus =
    dayBonus(done, habits.length) + (metricsComplete(s.metrics[date]) ? METRICS_BONUS : 0)
  return capDay(base + bonus)
}

export function lifetimeEarned(s: Stores): number {
  const dates = new Set([
    ...Object.keys(s.ticks),
    ...Object.keys(s.metrics),
    ...Object.keys(s.health),
    ...Object.keys(s.workouts),
  ])
  let total = 0
  for (const d of dates) total += dayEarned(s, d)
  return total
}

export function totalSpent(spends: Spend[]): number {
  return spends.reduce((sum, sp) => sum + sp.xp, 0)
}

// Levels: threshold for level n = 100·n² lifetime XP (L5 = 2,500 · L10 = 10,000)
export function levelInfo(lifetimeXp: number) {
  const level = Math.floor(Math.sqrt(lifetimeXp / 100))
  const floor = 100 * level * level
  const next = 100 * (level + 1) * (level + 1)
  return { level, floor, next, pct: (lifetimeXp - floor) / (next - floor) }
}

export interface WeekRecap {
  startISO: string
  endISO: string
  earned: number
  spent: number
  net: number
  days: { date: string; label: string; earned: number }[]
}

/** Monday (00:00) of the ISO week containing `ref`. */
function mondayOf(ref: string): Date {
  const d = new Date(ref + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7 // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - dow)
  return d
}

/**
 * Earned / spent / net XP for one Mon–Sun week. Pure derived view over the same
 * events the wallet already folds — no new event type (binding rule 5 respected).
 * `weekOffset` steps whole weeks back (−1 = last week) for week-over-week deltas.
 */
export function weekRecap(
  s: Stores,
  spends: Spend[],
  ref: string = dateISO(),
  weekOffset = 0,
): WeekRecap {
  const start = mondayOf(ref)
  start.setDate(start.getDate() + weekOffset * 7)
  const days: WeekRecap['days'] = []
  let earned = 0
  const d = new Date(start)
  for (let i = 0; i < 7; i++) {
    const iso = dateISO(d)
    const e = dayEarned(s, iso)
    earned += e
    days.push({ date: iso, label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }), earned: e })
    d.setDate(d.getDate() + 1)
  }
  const startISO = dateISO(start)
  const endISO = days[6].date
  const spent = spends
    .filter((sp) => {
      const day = sp.at.slice(0, 10)
      return day >= startISO && day <= endISO
    })
    .reduce((sum, sp) => sum + sp.xp, 0)
  return { startISO, endISO, earned, spent, net: earned - spent, days }
}

/** Last n days of earned XP, oldest first. */
export function xpSeries(s: Stores, days: number) {
  const out: { date: string; label: string; xp: number }[] = []
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const iso = dateISO(d)
    out.push({
      date: iso,
      label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }),
      xp: dayEarned(s, iso),
    })
    d.setDate(d.getDate() + 1)
  }
  return out
}
