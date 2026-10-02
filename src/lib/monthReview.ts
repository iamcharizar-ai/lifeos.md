// Month-end review — the one habit that nags.
//
// On the last day of every month a review of that month lands on Today and does
// not leave until it is ticked, however many days or months that takes. The
// point is that a review can't be postponed into oblivion: it stays in your face
// until the month has actually been looked at.
//
// A review is an ordinary `tick` event (habit id `month-review`) filed under the
// *first day of the month it closes*, so "is September reviewed?" is a single
// lookup that sync, the outbox and a ledger replay already handle. Like Sunday
// tasks it is not a registry habit: no XP, and it never enters the Monthly graph.
import { dateISO, type Ticks } from './store'
import { dayIso, daysInMonth, shiftYm, ymOf } from './monthSnapshot'

export const REVIEW_ID = 'month-review'

/** First month that can owe a review — nothing earlier is ever dragged up. */
export const FIRST_REVIEW_YM = '2026-09'

/** The day a month's review tick is filed under. */
export const reviewDay = (ym: string): string => `${ym}-01`

export const isReviewed = (ticks: Ticks, ym: string): boolean =>
  Boolean(ticks[reviewDay(ym)]?.[REVIEW_ID])

export interface ReviewItem {
  ym: string
  done: boolean
}

/**
 * Reviews to show on `today`: every month that is due and not yet reviewed
 * (oldest first), plus any finished *today* so a mis-tap can be undone. A month
 * is due once its last day arrives and stays due for good.
 */
export function reviewsToShow(ticks: Ticks, today: string): ReviewItem[] {
  const nowYm = ymOf(today)
  const lastDay = today === dayIso(nowYm, daysInMonth(nowYm))
  const latest = lastDay ? nowYm : shiftYm(nowYm, -1)
  const out: ReviewItem[] = []
  for (let ym = FIRST_REVIEW_YM; ym <= latest; ym = shiftYm(ym, 1)) {
    const at = ticks[reviewDay(ym)]?.[REVIEW_ID]
    if (!at) out.push({ ym, done: false })
    else if (dateISO(new Date(at)) === today) out.push({ ym, done: true })
  }
  return out
}
