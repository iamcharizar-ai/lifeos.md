// "Is the pipe itself healthy?" The webhook and the Google sign-in can both stop
// working without anything failing loudly: on 21 Oct 2026 a revoked token cut the
// bridge off and the only sign was a sleep row that never came. The server notes
// each push from Google and each sync's outcome in one row of `health_status`;
// this turns that row into a sentence for the Sleep row, or nothing when all is well.
// (The row holds codes, never error text: /api/health-check is readable by anyone.)

export interface HealthStatus {
  /** the last verified notification from Google (ISO) */
  last_push_at?: string | null
  /** the last sync that read Google without failing (ISO) */
  last_sync_at?: string | null
  /** what the last failed read was about: the sign-in, or anything else */
  last_error?: 'auth' | 'read' | null
  last_error_at?: string | null
}

/** Google pushes whenever the band's data changes, so a day and a half of nothing means the subscription is gone. */
export const PUSH_QUIET_MS = 36 * 3_600_000

export const WARNINGS = {
  auth: 'Google sign-in has expired. Run ghealth auth login, then update GOOGLE_REFRESH_TOKEN in Vercel.',
  read: 'The last read of Google failed. It will try again; if this stays, check the Vercel logs.',
  quiet: (hours: number) => `Google has not pushed anything for ${hours} h. Check the webhook subscriber (bridge/README.md).`,
}

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) || 0 : 0)

/** The warning to show, or undefined when the pipe looks healthy (or there is no status yet). */
export function warningFor(s: HealthStatus | null | undefined, now: number): string | undefined {
  if (!s) return undefined
  // a failure only counts until a later read succeeds
  if (s.last_error && ms(s.last_error_at) > ms(s.last_sync_at)) return s.last_error === 'auth' ? WARNINGS.auth : WARNINGS.read
  const push = ms(s.last_push_at)
  if (push && now - push > PUSH_QUIET_MS) return WARNINGS.quiet(Math.floor((now - push) / 3_600_000))
  return undefined
}

/** Which code a failed read gets: Google's sign-in refusal says so in its message (server/health-shared.ts). */
export const errorCode = (err: unknown): 'auth' | 'read' => (err instanceof Error && /refused the sign-in/.test(err.message) ? 'auth' : 'read')
