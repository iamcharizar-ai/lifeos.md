// Which of two ledger events happened last?
//
// Every device stamps its own events with its own clock. Measured on the real
// ledger, phones run up to ~13 s away from the PC's clock, so "tick on the PC,
// untick on the phone five seconds later" can carry an untick that is
// *earlier* than the tick: sorted by `at` alone, the untick is applied first
// and the habit stays ticked for good.
//
// The server stamps every row too (`inserted_at`), and it is one clock for all
// devices. An event inserted soon after it was made was sent live, so the
// server's time is the better witness. One that took longer was queued offline,
// and then the device's own stamp is the only record of when it really happened.

/** Longer than this between making an event and its arrival and it was sent from an outbox. */
export const LIVE_WINDOW_MS = 120_000

export interface Stamped {
  at: string
  inserted_at?: string
}

/** The time to order this event by, in ms. */
export function happenedAt(e: Stamped): number {
  const at = Date.parse(e.at)
  if (!e.inserted_at) return at
  const ins = Date.parse(e.inserted_at)
  if (Number.isNaN(ins)) return at
  if (Number.isNaN(at)) return ins
  return ins - at < LIVE_WINDOW_MS ? ins : at
}

/** A copy sorted oldest first. Ties keep their incoming order. */
export function inOrder<T extends Stamped>(events: readonly T[]): T[] {
  return events
    .map((e, i) => ({ e, i, t: happenedAt(e) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e)
}

/**
 * Sorted, with each `at` replaced by the time the event is ordered by, so the
 * folds that keep "the newest write wins" per field (Arbor, Woodshed) agree
 * with the tick/untick order instead of re-trusting a skewed device clock.
 */
export function settled<T extends Stamped>(events: readonly T[]): T[] {
  return inOrder(events).map((e) => {
    const t = happenedAt(e)
    return Number.isNaN(t) ? e : { ...e, at: new Date(t).toISOString() }
  })
}
