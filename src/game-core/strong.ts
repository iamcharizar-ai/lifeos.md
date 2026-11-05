// GAME CORE: what Strong records, read from the ledger the same way by both apps (version 21 needs it in Life OS too: a Gym day is a
// logged workout). Workouts, the lifts that beat every earlier session, and the routine each workout was. Pure, no DOM.
import type { DayMarks } from './facts.ts'

/** The part of a ledger event this reads. */
export interface StrongEvent { type: string; day: string; payload?: Record<string, unknown> | null }

interface DoneSet { kg: number | null; reps: number }
interface Workout { id: string; finishedAt: string; routineId?: string | null; exercises: { exerciseId: string; sets: DoneSet[] }[] }
type ExType = 'weight' | 'bodyweight' | 'weighted' | 'assisted' | 'duration'

const parse = <T>(raw: unknown): T | null => {
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return null
  }
}

// the same reading of a set as Strong's own records (strong/src/lib/stats.ts)
const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30))
const loaded = (t: ExType) => t === 'weight' || t === 'weighted'
function best(type: ExType, sets: DoneSet[]): number[] {
  let heaviest = -Infinity, rm = -Infinity, volume = -Infinity, reps = -Infinity, longest = -Infinity
  for (const s of sets) {
    if (type === 'duration') { longest = Math.max(longest, s.reps); continue }
    if (!loaded(type)) reps = Math.max(reps, s.reps)
    else if (s.kg != null) {
      heaviest = Math.max(heaviest, s.kg)
      rm = Math.max(rm, e1rm(s.kg, s.reps))
      volume = Math.max(volume, s.kg * s.reps)
    }
  }
  return [heaviest, rm, volume, reps, longest]
}

/** Workouts, records and routines by day. Pass events oldest first. A deleted workout is gone, and the same workout sent twice counts once. */
export function strongMarks(events: StrongEvent[]): Record<string, DayMarks> {
  const out: Record<string, DayMarks> = {}
  const add = (day: string, k: 'workouts' | 'records', n = 1) => { (out[day] ??= {})[k] = (out[day][k] ?? 0) + n }
  const gone = new Set(events.filter((e) => e.type === 'workout_delete').map((e) => String(e.payload?.id)))
  const types: Record<string, ExType> = {}
  const workouts = new Map<string, { day: string; w: Workout }>()
  for (const ev of events) {
    if (ev.type !== 'workout') continue
    const w = parse<Workout>(ev.payload?.gear)
    if (!w?.id || !Array.isArray(w.exercises) || gone.has(w.id)) continue
    for (const [id, x] of Object.entries(parse<Record<string, { type?: ExType }>>(ev.payload?.lib) ?? {})) if (x?.type) types[id] = x.type
    workouts.set(w.id, { day: ev.day, w })
  }
  const before: Record<string, DoneSet[]> = {}
  for (const { day, w } of [...workouts.values()].sort((a, b) => (a.w.finishedAt < b.w.finishedAt ? -1 : 1))) {
    add(day, 'workouts')
    // the routine this workout was, so the Dojo can drop its piece of gear (core/economy.ts GEAR)
    if (w.routineId) (out[day] ??= {}).gear = [...((out[day] ?? {}).gear ?? []), w.routineId]
    for (const e of w.exercises) {
      const type = types[e.exerciseId] ?? 'weight'
      const old = before[e.exerciseId]
      // a first session sets the mark; it does not beat one
      if (old?.length) {
        const was = best(type, old), now = best(type, e.sets)
        if (now.some((v, i) => v > was[i] + 1e-9)) add(day, 'records')
      }
      ;(before[e.exerciseId] ??= []).push(...e.sets)
    }
  }
  return out
}
