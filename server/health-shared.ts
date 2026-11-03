// What the two health functions share: the settings, the Google sign-in, the
// ledger, and the sync itself (read the days from Google, write what is new,
// exactly as `npm run health` does from the PC; bridge/plan.ts decides what).
//
// Settings (Vercel project -> Environment Variables; names only, never commit values):
//   WEBHOOK_SECRET        the secret Google sends in `Authorization`; also given to `ghealth webhooks subscribers create`
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//                         the Desktop OAuth client and the owner's sign-in (read-only health scopes)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   the ledger. The service-role key is for this server only (never a
//                         VITE_ variable, never in a client bundle). Until it is set the anon key is used: that
//                         keeps working, but it cannot write `health_status`, and it is the one the database
//                         must keep allowing to insert vitals.
//   HEALTH_TZ             the owner's time zone, default Asia/Kolkata
import { DEVICE, LOOK_BACK, WRITE_PATH, WRITE_PREFER, planWrites } from '../bridge/plan.ts'
import { readHealth, addDays } from '../bridge/health.ts'
import { toVitals, type Kind } from '../bridge/map.ts'
import { errorCode, type HealthStatus } from '../bridge/watch.ts'
import type { LedgerEvent } from '../bridge/model.ts'

const E = process.env
export const cfg = {
  secret: E.WEBHOOK_SECRET ?? '',
  clientId: E.GOOGLE_CLIENT_ID ?? '',
  clientSecret: E.GOOGLE_CLIENT_SECRET ?? '',
  refresh: E.GOOGLE_REFRESH_TOKEN ?? '',
  supabaseUrl: (E.SUPABASE_URL ?? E.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabaseKey: E.SUPABASE_SERVICE_ROLE_KEY ?? E.SUPABASE_ANON_KEY ?? E.VITE_SUPABASE_ANON_KEY ?? '',
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

// A legacy key is a JWT and also goes in `Authorization`; the new kind (sb_secret_…, sb_publishable_…) is not a JWT
// and goes in `apikey` alone, from which Supabase makes the token itself.
const authHeaders = (key: string): Record<string, string> => (key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key })

export const sb = (path: string, init: RequestInit = {}): Promise<Response> =>
  fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(cfg.supabaseKey), 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
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

/** The watchdog's one row (supabase/2026-11-03-health-status-and-rls.sql). Never fails the caller: the table may not exist yet. */
export async function markStatus(patch: Partial<HealthStatus>): Promise<void> {
  try {
    await sb('health_status?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'google', ...patch }) })
  } catch {
    /* the note is a convenience, not part of the sync */
  }
}

export async function readStatus(): Promise<HealthStatus | null> {
  try {
    const res = await sb('health_status?select=last_push_at,last_sync_at,last_error,last_error_at&id=eq.google')
    if (!res.ok) return null
    return ((await res.json()) as HealthStatus[])[0] ?? null
  } catch {
    return null
  }
}

// one good read is noted at most this often per warm instance: the sync runs on every notification, the row need not
let okNotedAt = 0
let wasFailing = false

/** Read these days (and kinds, all by default) from Google and write what is new to the ledger; the outcome is noted for the watchdog. */
export async function sync(win: { from: string; to: string; kinds?: Kind[] }): Promise<SyncResult> {
  try {
    const r = await syncOnce(win)
    if (wasFailing || Date.now() - okNotedAt > 600_000) {
      okNotedAt = Date.now()
      wasFailing = false
      await markStatus({ last_sync_at: new Date().toISOString() })
    }
    return r
  } catch (err) {
    wasFailing = true
    await markStatus({ last_error: errorCode(err), last_error_at: new Date().toISOString() })
    throw err
  }
}

async function syncOnce(win: { from: string; to: string; kinds?: Kind[] }): Promise<SyncResult> {
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
