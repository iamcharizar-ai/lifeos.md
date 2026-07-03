// XP economy v1 — numbers mirror wiki/outputs/lifeos-master-plan.md
import { TIER_XP, type Tier } from '../config/habits'

export const DAILY_CAP = 400
export const WORKOUT_XP = 15
export const STEPS_XP_CAP = 12
export const SLEEP_XP = 10

export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 1.5
  if (streakDays >= 14) return 1.4
  if (streakDays >= 7) return 1.25
  if (streakDays >= 3) return 1.1
  return 1
}

export function habitXp(tier: Tier, streakDays: number): number {
  return Math.round(TIER_XP[tier] * streakMultiplier(streakDays))
}

export function dayBonus(doneCount: number, totalHabits: number): number {
  if (doneCount >= totalHabits) return 50
  if (doneCount >= 15) return 20
  return 0
}

export function stepsXp(steps: number): number {
  if (!steps || steps < 0) return 0
  return Math.min(Math.floor(steps / 1000), STEPS_XP_CAP)
}

export function sleepXp(hours: number): number {
  return hours >= 7 ? SLEEP_XP : 0
}

export function capDay(xp: number): number {
  return Math.min(xp, DAILY_CAP)
}
