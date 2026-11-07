// What the two AI endpoints (the pasted link and the MCP server) share: who may read, which options were asked for, and the
// snapshot itself. Fail closed: with no token configured, or a short one, nothing is served.
import { createHash, timingSafeEqual } from 'node:crypto'
import { cfg } from './health-shared.ts'
import { ledgerRows } from './ai-data.ts'
import { DEFAULT_DAYS, MAX_DAYS, SECTIONS, buildSnapshot, isSection, type Section, type Snapshot } from './ai-snapshot.ts'

// Setting (Vercel project -> Environment Variables; the name only, never the value in git):
//   AI_SNAPSHOT_TOKEN   the secret that is the link. At least 24 characters; rotate it to cut every old link off.
//                       Generate one with: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
const TOKEN = process.env.AI_SNAPSHOT_TOKEN ?? ''
export const MIN_TOKEN = 24

const digest = (s: string): Buffer => createHash('sha256').update(s).digest()

export type Auth = 'ok' | 'off' | 'denied'

/**
 * The token may arrive as the last path segment (a link you can paste), `?k=`, or `Authorization: Bearer` / `x-api-key`
 * (a client that can send headers). `off` = no usable token is configured, so the whole feature is shut.
 */
export function authorize(req: Request, token: string = TOKEN): Auth {
  if (token.length < MIN_TOKEN) return 'off'
  const url = new URL(req.url)
  const last = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1]
  const given = [last, url.searchParams.get('k'), bearer, req.headers.get('x-api-key')].filter((x): x is string => Boolean(x))
  // compare digests, so neither the length nor the content of the secret shows in how long this takes
  const want = digest(token)
  let ok = false
  for (const g of given) if (timingSafeEqual(digest(g), want)) ok = true
  return ok ? 'ok' : 'denied'
}

export interface Asked {
  days: number
  sections: Section[]
  redactHealth: boolean
  json: boolean
}

/** `?days=30&sections=game,body&format=json&redact=health`. Anything unreadable falls back to the default. */
export function asked(url: URL): Asked {
  const days = Math.max(1, Math.min(MAX_DAYS, Number.parseInt(url.searchParams.get('days') ?? '', 10) || DEFAULT_DAYS))
  const redactHealth = (url.searchParams.get('redact') ?? '').split(',').map((s) => s.trim()).includes('health')
  const wanted = (url.searchParams.get('sections') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(isSection)
  const sections = (wanted.length ? wanted : [...SECTIONS]).filter((s) => !(redactHealth && s === 'body'))
  return { days, sections, redactHealth, json: url.searchParams.get('format') === 'json' }
}

export async function snapshot(o: { days: number; redactHealth: boolean }): Promise<Snapshot> {
  return buildSnapshot(await ledgerRows(), { tz: cfg.tz, now: new Date(), days: o.days, redactHealth: o.redactHealth })
}

export const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }

/** The answer for a failed or missing key: nothing that says whether the feature exists. */
export const refuse = (auth: Exclude<Auth, 'ok'>): Response =>
  auth === 'off'
    ? new Response('Not set up: AI_SNAPSHOT_TOKEN is not configured on the server.\n', { status: 503, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } })
    : new Response('Not found\n', { status: 404, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } })
