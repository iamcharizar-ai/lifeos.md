// Workout summaries. The in-app workout engine retired with the Train tab
// (2026-07-10) — Project Strong owns tracking now and writes `workout` events
// straight into the same ledger. All that survives here is the shape those
// events carry and a safe parser for it.

export interface WorkoutSummary {
  id: string
  name: string
  startedAt: string
  finishedAt: string
  durationMin: number
  totalSets: number
  totalReps: number
  volumeKg: number
  muscles: string[]
  exercises: { name: string; kind: string; sets: { weight: number; reps: number }[] }[]
}

export function parseSummary(raw: unknown): WorkoutSummary | undefined {
  try {
    const s = typeof raw === 'string' ? (JSON.parse(raw) as WorkoutSummary) : undefined
    return s && Array.isArray(s.exercises) ? s : undefined
  } catch {
    return undefined
  }
}
