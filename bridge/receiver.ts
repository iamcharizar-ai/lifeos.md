// The webhook endpoint's decisions, with everything outside it passed in: the
// secret, the signing keys, the clock, and what "sync these days" means. That
// keeps the whole conversation with Google testable without Google.
import { type Keyset, authOk, isVerification, kindsFor, parseNotifications, verifySignature, windowFor } from './webhook.ts'
import type { Kind } from './map.ts'

export interface Deps {
  /** the shared secret Google sends in `Authorization` */
  secret: string
  /** Google's current signing keys (null when they could not be fetched) */
  keyset: () => Promise<Keyset | null>
  /** read these days from Google and write what is new to the ledger */
  sync: (window: { from: string; to: string; kinds?: Kind[] }) => Promise<unknown>
  /** keep working after the answer has gone out (Vercel's waitUntil) */
  after: (work: Promise<unknown>) => void
  today: () => string
  log: (line: string) => void
}

const reply = (status: number, body?: string): Response => new Response(body ?? null, { status })

export async function receive(req: Request, d: Deps): Promise<Response> {
  if (req.method !== 'POST') return reply(405)
  // without a secret anyone could "authorise" themselves by sending nothing
  if (!d.secret) return reply(503, 'not configured')
  const raw = await req.text()
  const authed = authOk(req.headers.get('authorization'), d.secret)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return reply(authed ? 400 : 401)
  }

  // Google checks the endpoint twice when a subscriber is made or changed: with the secret (we say yes) and without it (we say no)
  if (isVerification(body)) return authed ? reply(200, 'ok') : reply(401)
  if (!authed) return reply(401)
  if (!verifySignature(raw, req.headers.get('google-health-api-signature'), await d.keyset())) {
    d.log('rejected: the signature did not match')
    return reply(401)
  }

  const touches = parseNotifications(body)
  const found = windowFor(touches, d.today())
  // only what the notification is about: a steps update reads steps, not all twelve kinds
  const win = found && { ...found, kinds: kindsFor(touches) }
  d.log(`notified: ${touches.map((t) => `${t.operation} ${t.dataType}`).join(', ') || 'nothing readable'}${win ? `; reading ${win.kinds.join(', ')} for ${win.from}..${win.to}` : '; nothing we use'}`)
  if (win) d.after(d.sync(win).catch((err) => d.log(`sync failed: ${err instanceof Error ? err.message : String(err)}`)))
  return reply(204)
}
