// Editing the graph: filling in days you forgot to tick.
//
// Three rules, all decided here so the screen only has to ask:
//   - Only the last EDIT_DAYS days before today, and only inside the running month. On the
//     1st, yesterday belongs to a month that has already sealed, so nothing is editable.
//   - It never pays XP. The game counts a tick only if its stamp is before the end of the
//     grace window (facts.ts inTime), so a backfilled tick is stamped just past that window.
//     Both apps already read the stamp, so the Pokedex needs no change.
//   - Only a late stamp can be taken back. A tick made in time already paid XP; removing
//     it would rewrite the game, so the graph leaves it alone.
import { GRACE_DAYS } from '../game-core/rules.ts'
import { addDays, inTime } from '../game-core/facts.ts'

/** How many days back the graph can be edited (today itself is the Daily tab's). */
export const EDIT_DAYS = 4

/** The days that can be edited right now, oldest first: up to EDIT_DAYS before `today`, never from an earlier month. */
export function editableDays(today: string): string[] {
  const out: string[] = []
  for (let n = EDIT_DAYS; n >= 1; n--) {
    const day = addDays(today, -n)
    if (day.slice(0, 7) === today.slice(0, 7)) out.push(day)
  }
  return out
}

export const canEditDay = (day: string, today: string): boolean => editableDays(today).includes(day)

/** Stamp for a tick added to `day` from the graph: now, or the first moment the game stops counting `day`, whichever is later. */
export function backfillStamp(day: string, now: Date = new Date()): string {
  const past = new Date(addDays(day, GRACE_DAYS + 1) + 'T00:00:00')
  return new Date(Math.max(now.getTime(), past.getTime())).toISOString()
}

/** May this cell be flipped from the graph? `at` is the habit's tick stamp on that day, if it has one. */
export function cellEditable(at: string | undefined, day: string): boolean {
  return !at || !inTime(at, day)
}
