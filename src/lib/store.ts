// v0 store: localStorage only. Phase 1 wiring swaps this for Supabase events
// with the same shape — every tick is an event, state is derived.

export type Ticks = Record<string, Record<string, string>> // date -> habitId -> tickedAt ISO

const KEY = 'lifeos.ticks.v1'

export function loadTicks(): Ticks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Ticks
  } catch {
    return {}
  }
}

export function saveTicks(ticks: Ticks): void {
  localStorage.setItem(KEY, JSON.stringify(ticks))
}

export function dateISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Consecutive ticked days ending at `date` (inclusive if ticked today). */
export function streakFor(ticks: Ticks, habitId: string, date: string): number {
  let streak = 0
  const d = new Date(date + 'T12:00:00')
  for (;;) {
    if (ticks[dateISO(d)]?.[habitId]) {
      streak++
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}
