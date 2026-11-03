// "Is last night in yet?" The decisions behind /api/health-check, with the
// ledger, Google and the clock passed in, so they are tested without them.
//
// Life OS asks while Today is waiting for the band. The webhook is the usual
// way a night arrives, but it only fires once Google has the night, and Google
// only has it once the phone has synced. This says which of those is the
// hold-up, and reads Google itself when nobody has for a minute.

export type CheckState =
  /** the night is in the ledger, scored */
  | 'measured'
  /** Google has the night and it is being written */
  | 'scoring'
  /** Google has no night ending today yet: the phone has not synced it */
  | 'not-synced'
  /** Google could not be read */
  | 'error'

export interface CheckAnswer {
  day: string
  state: CheckState
  score?: number
  /** when Google was last read for this (ISO) */
  checkedAt?: string
  message: string
  /** the pipe itself is unhealthy (bridge/watch.ts): the sign-in expired, or Google has gone quiet */
  warning?: string
}

/** Google is read at most this often, whoever asks. */
export const CHECK_EVERY_MS = 60_000

export interface CheckDeps {
  day: string
  /** the sleep score the ledger holds for the day, if any */
  scoreIn: () => Promise<number | null>
  /** read yesterday and today from Google and write what is new; the days Google has a night for */
  sync: () => Promise<{ nights: string[] }>
  now: () => number
}

export interface CheckMemo {
  at: number
  day: string
  nights: string[]
}

export const MESSAGES: Record<CheckState, string> = {
  measured: 'Last night is in.',
  scoring: 'Google has last night: scoring it now.',
  'not-synced': 'Google does not have last night yet. Open Google Health (or the band app) so the phone syncs it.',
  error: 'Google could not be read just now. Start the day by hand if you need to.',
}

/** The answer, and the memo to keep for the next call (one read of Google is shared by every caller for CHECK_EVERY_MS). */
export async function check(d: CheckDeps, memo: CheckMemo | null): Promise<{ answer: CheckAnswer; memo: CheckMemo | null }> {
  const score = await d.scoreIn()
  if (score !== null) return { answer: { day: d.day, state: 'measured', score, message: MESSAGES.measured }, memo }
  let m = memo && memo.day === d.day && d.now() - memo.at < CHECK_EVERY_MS ? memo : null
  if (!m) {
    try {
      const r = await d.sync()
      m = { at: d.now(), day: d.day, nights: r.nights }
    } catch {
      return { answer: { day: d.day, state: 'error', message: MESSAGES.error }, memo }
    }
    // the read may just have written it
    const after = await d.scoreIn()
    if (after !== null) return { answer: { day: d.day, state: 'measured', score: after, checkedAt: new Date(m.at).toISOString(), message: MESSAGES.measured }, memo: m }
  }
  const state: CheckState = m.nights.includes(d.day) ? 'scoring' : 'not-synced'
  return { answer: { day: d.day, state, checkedAt: new Date(m.at).toISOString(), message: MESSAGES[state] }, memo: m }
}
