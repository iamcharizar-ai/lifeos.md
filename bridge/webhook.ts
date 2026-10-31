// What a Google Health webhook is, and what to do about one. Pure: no network,
// no environment, so every rule here is tested without Google.
//
// Google does not send values. It says "steps changed for this user between
// these times"; the receiver then reads the days from the API itself (see
// server/health-webhook.ts) and writes what is new to the ledger.
//
// Rules from developers.google.com/health/webhooks:
//   - setting up, Google sends {"type":"verification"} twice: with our secret in
//     `Authorization` (answer 200) and without it (answer 401 or 403)
//   - every notification carries `Authorization: <secret>` and a signature of the
//     raw body in `GOOGLE-HEALTH-API-SIGNATURE` (ECDSA P-256, SHA-256, Tink keys)
//   - answer 204 at once and work afterwards; anything else is retried for 7 days
//   - notifications can repeat and arrive in arrays of up to 99
import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'
import { addDays } from './health.ts'
import type { Kind } from './map.ts'

// ── who is calling ──────────────────────────────────────────────────────────

/** The shared secret, compared in constant time. An empty secret never matches. */
export function authOk(header: string | null, secret: string): boolean {
  if (!secret || !header) return false
  const a = Buffer.from(header), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface Keyset {
  key: { keyData: { value: string }; keyId: number; status?: string; outputPrefixType?: string }[]
}

/** The x and y of a Tink `EcdsaPublicKey` protobuf (fields 3 and 4; the key is P-256, so 32 bytes each, after a leading zero Tink adds). */
export function ecdsaPoint(b64: string): { x: Buffer; y: Buffer } | null {
  const b = Buffer.from(b64, 'base64')
  let i = 0
  const varint = (): number => {
    let n = 0, shift = 0
    for (;;) {
      if (i >= b.length) return -1
      const c = b[i++]
      n += (c & 0x7f) * 2 ** shift
      if (!(c & 0x80)) return n
      shift += 7
    }
  }
  const fields: Record<number, Buffer> = {}
  while (i < b.length) {
    const tag = varint()
    if (tag < 0) return null
    const wire = tag & 7, field = tag >> 3
    if (wire === 0) { if (varint() < 0) return null; continue }
    if (wire !== 2) return null
    const len = varint()
    if (len < 0 || i + len > b.length) return null
    fields[field] = b.subarray(i, i + len)
    i += len
  }
  const fit = (v?: Buffer): Buffer | null => {
    if (!v) return null
    const t = v.length === 33 && v[0] === 0 ? v.subarray(1) : v
    return t.length === 32 ? t : null
  }
  const x = fit(fields[3]), y = fit(fields[4])
  return x && y ? { x, y } : null
}

/**
 * Does the signature in `GOOGLE-HEALTH-API-SIGNATURE` match the raw body? The header is base64 of
 * Tink's output: one version byte, four bytes of key id, then a DER ECDSA signature.
 */
export function verifySignature(rawBody: string, signatureB64: string | null, keyset: Keyset | null): boolean {
  if (!signatureB64 || !keyset?.key?.length) return false
  const sig = Buffer.from(signatureB64, 'base64')
  if (sig.length < 6 || sig[0] !== 1) return false
  const id = sig.readUInt32BE(1)
  const k = keyset.key.find((x) => x.keyId === id && (x.status ?? 'ENABLED') === 'ENABLED' && (x.outputPrefixType ?? 'TINK') === 'TINK')
  const pt = k ? ecdsaPoint(k.keyData.value) : null
  if (!pt) return false
  try {
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pt.x.toString('base64url'), y: pt.y.toString('base64url') }, format: 'jwk' })
    return verify('sha256', Buffer.from(rawBody), { key, dsaEncoding: 'der' }, sig.subarray(5))
  } catch {
    return false
  }
}

// ── what it says ────────────────────────────────────────────────────────────

export const isVerification = (body: unknown): boolean => Boolean(body && typeof body === 'object' && !Array.isArray(body) && (body as { type?: unknown }).type === 'verification')

export interface Touch {
  dataType: string
  operation: string
  /** the local calendar days it touched, "YYYY-MM-DD" */
  days: string[]
}

const DAY = /^\d{4}-\d{2}-\d{2}/

/** One notification or an array of them → what changed. Anything that does not look like one is skipped. */
export function parseNotifications(body: unknown): Touch[] {
  const list = Array.isArray(body) ? body : [body]
  const out: Touch[] = []
  for (const item of list) {
    const d = (item as { data?: Record<string, unknown> } | null)?.data
    if (!d || typeof d.dataType !== 'string') continue
    const days: string[] = []
    for (const iv of Array.isArray(d.intervals) ? d.intervals : []) {
      const c = (iv as { civilIso8601TimeInterval?: { startTime?: string; endTime?: string } })?.civilIso8601TimeInterval
      for (const t of [c?.startTime, c?.endTime]) if (typeof t === 'string' && DAY.test(t) && !days.includes(t.slice(0, 10))) days.push(t.slice(0, 10))
    }
    out.push({ dataType: d.dataType, operation: typeof d.operation === 'string' ? d.operation : 'UPSERT', days })
  }
  return out
}

/** The kinds of data the game reads. A notification about anything else (a workout, a heart-rate sample) is acknowledged and ignored. */
export const WATCHED = new Set(['steps', 'distance', 'sleep', 'weight', 'floors', 'altitude', 'active-minutes', 'total-calories', 'active-zone-minutes'])

/**
 * Which kinds to read for these notifications: the ones named, not all twelve. Sleep brings the overnight
 * dailies with it (they are worked out from the same night), and the activity types the bridge does not
 * read itself (floors, altitude, active minutes) stand for the day's activity totals.
 */
const KINDS_FOR: Record<string, Kind[]> = {
  steps: ['steps'],
  distance: ['distance'],
  'total-calories': ['calories'],
  'active-zone-minutes': ['zoneMinutes'],
  weight: ['weight'],
  sleep: ['sleep', 'restingHr', 'hrv', 'spo2', 'respRate', 'tempDev', 'vo2max'],
  floors: ['steps', 'distance', 'calories', 'zoneMinutes'],
  altitude: ['steps', 'distance', 'calories', 'zoneMinutes'],
  'active-minutes': ['steps', 'distance', 'calories', 'zoneMinutes'],
}
export function kindsFor(touches: Touch[]): Kind[] {
  const out = new Set<Kind>()
  for (const t of touches) for (const k of KINDS_FOR[t.dataType] ?? []) out.add(k)
  return [...out]
}

/** Days to read again: from the oldest day touched (never more than a week back) through today. Null when nothing we use changed. */
export function windowFor(touches: Touch[], today: string, maxBack = 6): { from: string; to: string } | null {
  const hit = touches.filter((t) => WATCHED.has(t.dataType))
  if (!hit.length) return null
  const floor = addDays(today, -maxBack)
  const days = hit.flatMap((t) => t.days).filter((d) => d <= today)
  // sleep and daily summaries carry no usable interval: the night just ended belongs to yesterday and today
  const from = days.length ? days.reduce((a, b) => (a < b ? a : b)) : addDays(today, -1)
  return { from: from < floor ? floor : from, to: today }
}
