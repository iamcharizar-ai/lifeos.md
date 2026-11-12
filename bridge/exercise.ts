// Strong's finished workouts, as Google Health exercise sessions. Pure: it decides
// which workouts still need sending and what the Google request body is; the
// server function (server/workout-push.ts) does the fetching and the writing.
//
// Strong writes one `workout` event per finished workout (payload.gear is the
// whole workout as JSON, payload.lib names its exercises). A workout is sent
// once: a `health_push` row, whose id is made from the workout's id, is written
// before the send, so two runs at once (Strong's ping and the daily safety net)
// cannot both send it.
import { createHash } from 'node:crypto'
import type { LedgerEvent } from './model.ts'

/** Only workouts finished this recently are sent: the daily run is a safety net, not a backfill of the whole history. */
export const PUSH_DAYS = 14
export const PUSH_DEVICE = 'health-push'
export const PUSH_TYPE = 'health_push'

interface GearSet { kg: number | null; reps: number }
interface GearExercise { exerciseId: string; sets: GearSet[] }
export interface GearWorkout { id: string; name: string; startedAt: string; finishedAt: string; note?: string; exercises: GearExercise[] }
type Lib = Record<string, { name: string; type: string }>

export interface Pending { workout: GearWorkout; lib: Lib; day: string }

const parse = <T>(v: unknown): T | null => {
  if (typeof v !== 'string') return null
  try { return JSON.parse(v) as T } catch { return null }
}

/** The id of the claim row for a workout: the same workout always makes the same id, shaped as the UUID the column takes. */
export function claimId(workoutId: string): string {
  const h = createHash('sha256').update(`health_push:${workoutId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Workouts in the ledger that are recent, not deleted in Strong, and not yet claimed. Oldest first. */
export function pendingWorkouts(events: LedgerEvent[], now: number): Pending[] {
  const deleted = new Set<string>()
  const claimed = new Set<string>()
  for (const e of events) {
    if (e.type === 'workout_delete') deleted.add(String(e.payload?.id ?? ''))
    else if (e.type === PUSH_TYPE) claimed.add(String(e.payload?.workout ?? ''))
  }
  const floor = now - PUSH_DAYS * 86_400_000
  const out = new Map<string, Pending>()
  for (const e of events) {
    if (e.type !== 'workout') continue
    const w = parse<GearWorkout>(e.payload?.gear)
    if (!w?.id || deleted.has(w.id) || claimed.has(w.id) || out.has(w.id)) continue
    const start = Date.parse(w.startedAt), end = Date.parse(w.finishedAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end < floor) continue
    if (!Array.isArray(w.exercises) || !w.exercises.some((x) => x.sets?.length)) continue
    out.set(w.id, { workout: w, lib: parse<Lib>(e.payload?.lib) ?? {}, day: e.day })
  }
  return [...out.values()].sort((a, b) => (a.workout.finishedAt < b.workout.finishedAt ? -1 : 1))
}

/** `+05:30` as Google's duration string, e.g. "19800s", for the zone at that moment. */
export function utcOffset(tz: string, at: Date): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part)
  return `${m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60) : 0}s`
}

const num = (n: number) => String(Math.round(n * 100) / 100)

/** One line per exercise: "Bench Press: 60×8, 60×8". Timed holds are seconds; bodyweight is reps alone. */
export function notesFor(w: GearWorkout, lib: Lib): string {
  const lines = w.exercises
    .filter((e) => e.sets?.length)
    .map((e) => {
      const def = lib[e.exerciseId]
      const sets = e.sets.map((s) => (def?.type === 'duration' ? `${s.reps}s` : s.kg != null && s.kg !== 0 ? `${num(s.kg)}×${s.reps}` : `${s.reps}`))
      return `${def?.name ?? e.exerciseId}: ${sets.join(', ')}`
    })
  return [w.name, ...lines, ...(w.note ? [w.note] : []), 'Logged in Strong'].join('\n').slice(0, 4000)
}

/** The body of POST users/me/dataTypes/exercise/dataPoints (a DataPoint with `exercise`). */
export function exerciseBody(p: Pending, tz: string): object {
  const { workout: w, lib } = p
  const start = new Date(w.startedAt), end = new Date(w.finishedAt)
  return {
    exercise: {
      interval: { startTime: start.toISOString(), startUtcOffset: utcOffset(tz, start), endTime: end.toISOString(), endUtcOffset: utcOffset(tz, end) },
      exerciseType: 'STRENGTH_TRAINING',
      displayName: 'Strength training',
      activeDuration: `${Math.round((end.getTime() - start.getTime()) / 1000)}s`,
      notes: notesFor(w, lib),
      metricsSummary: {},
    },
  }
}
