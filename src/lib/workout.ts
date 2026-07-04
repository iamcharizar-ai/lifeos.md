// Phase 4 workout engine — active-session model + finished-session summary.
// LEDGER LAW: the in-progress session is device-local scratch state (localStorage
// only, never synced). Only "Finish Workout" emits — one immutable `workout`
// event whose payload carries the summary JSON. No new event type; old clients
// fold it as a plain { type, at } workout and simply ignore the extra field.
import { EXERCISE_MAP, musclesFor, type ExerciseKind, type MuscleId } from '../config/exercises'

export interface SetEntry {
  weight: string // kg — '' until typed; kind 'reps'/'time' leaves it ''
  reps: string // reps, or seconds for kind 'time'
  done: boolean
}

export interface SessionExercise {
  /** catalog id when picked from it; custom mid-session moves get 'custom' */
  exerciseId: string
  name: string
  kind: ExerciseKind
  sets: SetEntry[]
}

export interface ActiveSession {
  id: string
  name: string
  splitId?: string
  startedAt: string // ISO
  entries: SessionExercise[]
}

/** Immutable result of Finish Workout — rides inside the `workout` event payload. */
export interface WorkoutSummary {
  id: string
  name: string
  startedAt: string
  finishedAt: string
  durationMin: number
  totalSets: number
  totalReps: number
  volumeKg: number
  /** primary muscles hit — drives the map's activation glow for the day */
  muscles: MuscleId[]
  exercises: { name: string; kind: ExerciseKind; sets: { weight: number; reps: number }[] }[]
}

const ACTIVE_KEY = 'lifeos.workout.active.v1'
export const DEFAULT_REST_SEC = 90

export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as ActiveSession
    return Array.isArray(s.entries) ? s : null
  } catch {
    return null
  }
}

export function saveActiveSession(s: ActiveSession | null): void {
  if (s) localStorage.setItem(ACTIVE_KEY, JSON.stringify(s))
  else localStorage.removeItem(ACTIVE_KEY)
}

export function newSetEntry(): SetEntry {
  return { weight: '', reps: '', done: false }
}

export function sessionExerciseFor(exerciseId: string, sets: number): SessionExercise {
  const ex = EXERCISE_MAP.get(exerciseId)
  return {
    exerciseId: ex ? ex.id : 'custom',
    name: ex ? ex.name : exerciseId,
    kind: ex ? ex.kind : 'weight',
    sets: Array.from({ length: Math.max(1, sets) }, newSetEntry),
  }
}

/** Fold the done sets of an active session into the immutable summary. */
export function summarize(s: ActiveSession, finishedAt: string = new Date().toISOString()): WorkoutSummary {
  const exercises: WorkoutSummary['exercises'] = []
  const doneIds: string[] = []
  let totalSets = 0
  let totalReps = 0
  let volumeKg = 0
  for (const e of s.entries) {
    const sets = e.sets
      .filter((x) => x.done)
      .map((x) => ({ weight: parseFloat(x.weight) || 0, reps: parseFloat(x.reps) || 0 }))
    if (sets.length === 0) continue
    if (e.exerciseId !== 'custom') doneIds.push(e.exerciseId)
    totalSets += sets.length
    for (const x of sets) {
      // time-kind "reps" are seconds — meaningful for the log, not for volume
      if (e.kind !== 'time') totalReps += x.reps
      volumeKg += x.weight * x.reps
    }
    exercises.push({ name: e.name, kind: e.kind, sets })
  }
  const durationMin = Math.max(
    1,
    Math.round((new Date(finishedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000),
  )
  return {
    id: s.id,
    name: s.name,
    startedAt: s.startedAt,
    finishedAt,
    durationMin,
    totalSets,
    totalReps,
    volumeKg: Math.round(volumeKg),
    muscles: musclesFor(doneIds).primary,
    exercises,
  }
}

export function parseSummary(raw: unknown): WorkoutSummary | undefined {
  try {
    const s = typeof raw === 'string' ? (JSON.parse(raw) as WorkoutSummary) : undefined
    return s && Array.isArray(s.exercises) ? s : undefined
  } catch {
    return undefined
  }
}

function fmtSet(kind: ExerciseKind, x: { weight: number; reps: number }): string {
  if (kind === 'time') return `${x.reps}s`
  if (x.weight > 0) return `${x.weight}kg × ${x.reps}`
  return `${x.reps}`
}

/** Markdown summary table for the daily note (vault write-back). */
export function renderWorkoutMarkdown(w: WorkoutSummary): string {
  const lines = [
    `**${w.name}** — ${w.durationMin} min · ${w.totalSets} sets · ${w.volumeKg} kg volume`,
    '',
    '| Exercise | Sets | Log |',
    '| --- | --- | --- |',
  ]
  for (const e of w.exercises)
    lines.push(`| ${e.name} | ${e.sets.length} | ${e.sets.map((x) => fmtSet(e.kind, x)).join(' · ')} |`)
  return lines.join('\n')
}
