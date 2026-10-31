// What the two health functions share: the settings, the Google sign-in, the
// ledger, and the sync itself (read the days from Google, write what is new,
// exactly as `npm run health` does from the PC; bridge/plan.ts decides what).
//
// Settings (Vercel project -> Environment Variables; names only, never commit values):
//   WEBHOOK_SECRET        the secret Google sends in `Authorization`; also given to `ghealth webhooks subscribers create`
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//                         the Desktop OAuth client and the owner's sign-in (read-only health scopes)
//   SUPABASE_URL, SUPABASE_ANON_KEY   the ledger
//   HEALTH_TZ             the owner's time zone, default Asia/Kolkata
import { DEVICE, LOOK_BACK, WRITE_PATH, WRITE_PREFER, planWrites } from '../bridge/plan.ts'
import { readHealth, addDays } from '../bridge/health.ts'
import { toVitals, type Kind } from '../bridge/map.ts'
import type { LedgerEvent } from '../bridge/model.ts'

const E = process.env
export const cfg = {
  secret: E.WEBHOOK_SECRET ?? '',
  clientId: E.GOOGLE_CLIENT_ID ?? '',
  clientSecret: E.GOOGLE_CLIENT_SECRET ?? '',
  refresh: E.GOOGLE_REFRESH_TOKEN ?? '',
  supabaseUrl: (E.SUPABASE_URL ?? E.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseKey: E.SUPABASE_ANON_KEY ?? E.VITE_SUPABASE_ANON_KEY ?? '',
  tz: E.HEALTH_TZ ?? 'Asia/Kolkata',
}

/** The owner's calendar date. */
export const today = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).slice(0, 10)

let access: { token: string; until: number } | null = null
async function accessToken(): Promise<string> {
  if (access && Date.now() < access.until) return access.token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refresh, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(10_000),
  })
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
  if (!j.access_token) throw new Error(`Google refused the sign-in (${j.error ?? res.status}); run ghealth auth login and update GOOGLE_REFRESH_TOKEN`)
  access = { token: j.access_token, until: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 }
  return access.token
}

export const sb = (path: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: cfg.supabaseKey, Authorization: `Bearer ${cfg.supabaseKey}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(15_000),
  })

/** The ledger's `vitals` rows from `since` on, oldest first. */
export async function knownVitals(since: string): Promise<LedgerEvent[]> {
  const known: LedgerEvent[] = []
  for (let offset = 0; ; offset += 1000) {
    const res = await sb(`events?select=device,at,day,type,payload&type=eq.vitals&day=gte.${since}&order=at.asc&offset=${offset}&limit=1000`)
    if (!res.ok) throw new Error(`ledger read ${res.status}`)
    const page = (await res.json()) as LedgerEvent[]
    known.push(...page)
    if (page.length < 1000) break
  }
  return known
}

export interface SyncResult {
  /** days written */
  wrote: number
  /** the days Google has a night for (the longest non-nap sleep that ended on it) */
  nights: string[]
  /** data types Google would not give */
  failed: string[]
}

/** Read these days (and kinds, all by default) from Google and write what is new to the ledger. */
export async function sync(win: { from: string; to: string; kinds?: Kind[] }): Promise<SyncResult> {
  // the ledger read does not depend on Google: run it beside the sign-in and the Google reads, not after them
  const [read, known] = await Promise.all([
    accessToken().then((token) => readHealth(token, win.from, win.to, (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }), undefined, win.kinds)),
    knownVitals(addDays(win.from, -LOOK_BACK)),
  ])
  const events = planWrites(read.data, known, new Date().toISOString())
  if (events.length) {
    const res = await sb(WRITE_PATH, { method: 'POST', headers: { Prefer: WRITE_PREFER }, body: JSON.stringify(events) })
    if (!res.ok) throw new Error(`ledger write ${res.status}`)
  }
  const failed = Object.keys(read.failed)
  const days = toVitals(read.data)
  const nights = Object.keys(days).filter((d) => typeof days[d].sleepMin === 'number' && (days[d].sleepMin as number) > 0)
  console.log(`sync ${win.from}..${win.to}: wrote ${events.length} day(s) as ${DEVICE}${failed.length ? `; could not read ${failed.join(', ')}` : ''}`)
  return { wrote: events.length, nights, failed }
}
