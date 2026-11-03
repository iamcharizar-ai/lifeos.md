// POST /api/health-webhook: where Google Health tells us something changed.
// It answers at once and then reads the days that changed from the Google
// Health API and writes what is new to the shared ledger (server/health-shared.ts).
import { waitUntil } from '@vercel/functions'
import { receive } from '../bridge/receiver.ts'
import type { Keyset } from '../bridge/webhook.ts'
import { cfg, markStatus, sync, today } from './health-shared.ts'

const KEYSET_URL = 'https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json'

// Google rotates its signing keys every 30 days: keep them for an hour, and refetch once if a key is not in the copy we hold
let keys: { at: number; set: Keyset } | null = null
async function keyset(): Promise<Keyset | null> {
  if (keys && Date.now() - keys.at < 3_600_000) return keys.set
  try {
    const res = await fetch(KEYSET_URL, { signal: AbortSignal.timeout(5000) })
    if (res.ok) keys = { at: Date.now(), set: (await res.json()) as Keyset }
  } catch {
    /* fall through to whatever we already hold */
  }
  return keys?.set ?? null
}

const handle = (req: Request): Promise<Response> =>
  receive(req, { secret: cfg.secret, keyset, sync, after: waitUntil, today, pushed: () => markStatus({ last_push_at: new Date().toISOString() }), log: (l) => console.log(l) })

export const POST = handle
export const GET = handle
