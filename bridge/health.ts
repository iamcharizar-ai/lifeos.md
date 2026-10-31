// The Google Health API (v4), as far as the bridge needs it: which requests read
// a range of days, and how the answers become the simplified shape that
// core/map.ts turns into `vitals` rows. Pure: it builds requests and reshapes
// responses, and whoever calls it does the fetching.
//
// Shapes follow the API's discovery document (health.googleapis.com, v4):
//   POST users/me/dataTypes/{type}/dataPoints:dailyRollUp   { range: { start, end } }  → { rollupDataPoints }
//   GET  users/me/dataTypes/{type}/dataPoints?filter=...                               → { dataPoints, nextPageToken }
import type { Kind, Simple, SimpleSet } from './map.ts'

export const HEALTH_BASE = 'https://health.googleapis.com/v4'
/** Read-only, and only the three families the bridge reads. All three are "restricted" scopes. */
export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
]

interface Source {
  /** the API's name for the data type, as used in the URL */
  type: string
  how: 'rollup' | 'list'
  /** what the filter is written against, for a list */
  field?: string
  /** the API refuses a longer range for this type */
  maxDays?: number
}

export const SOURCES: Record<Kind, Source> = {
  steps: { type: 'steps', how: 'rollup' },
  distance: { type: 'distance', how: 'rollup' },
  calories: { type: 'total-calories', how: 'rollup', maxDays: 14 },
  zoneMinutes: { type: 'active-zone-minutes', how: 'rollup' },
  sleep: { type: 'sleep', how: 'list', field: 'sleep.interval.civil_end_time' },
  restingHr: { type: 'daily-resting-heart-rate', how: 'list', field: 'daily_resting_heart_rate.date' },
  hrv: { type: 'daily-heart-rate-variability', how: 'list', field: 'daily_heart_rate_variability.date' },
  spo2: { type: 'daily-oxygen-saturation', how: 'list', field: 'daily_oxygen_saturation.date' },
  respRate: { type: 'daily-respiratory-rate', how: 'list', field: 'daily_respiratory_rate.date' },
  tempDev: { type: 'daily-sleep-temperature-derivations', how: 'list', field: 'daily_sleep_temperature_derivations.date' },
  vo2max: { type: 'daily-vo2-max', how: 'list', field: 'daily_vo2_max.date' },
  weight: { type: 'weight', how: 'list', field: 'weight.sample_time.civil_time' },
}
export const KINDS = Object.keys(SOURCES) as Kind[]

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const civil = (day: string) => ({ date: { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)), day: Number(day.slice(8, 10)) }, time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 } })

export interface HealthRequest {
  url: string
  method: 'GET' | 'POST'
  body?: string
}

/** The request that reads `kind` for the days `from`..`to` (YYYY-MM-DD, both included). */
export function requestFor(kind: Kind, from: string, to: string, pageToken?: string, base = HEALTH_BASE): HealthRequest {
  const s = SOURCES[kind]
  const start = s.maxDays && addDays(to, -(s.maxDays - 1)) > from ? addDays(to, -(s.maxDays - 1)) : from
  const end = addDays(to, 1) // the API's ranges are closed-open
  const parent = `${base}/users/me/dataTypes/${s.type}/dataPoints`
  if (s.how === 'rollup')
    return { url: `${parent}:dailyRollUp`, method: 'POST', body: JSON.stringify({ range: { start: civil(start), end: civil(end) }, windowSizeDays: 1, ...(pageToken ? { pageToken } : {}) }) }
  const q = new URLSearchParams({ filter: `${s.field} >= "${start}" AND ${s.field} < "${end}"`, pageSize: '1000' })
  if (pageToken) q.set('pageToken', pageToken)
  return { url: `${parent}?${q}`, method: 'GET' }
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const p2 = (n: unknown) => String(Number(n) || 0).padStart(2, '0')
/** `{ year, month, day }` → "YYYY-MM-DD" */
const dateOf = (d: unknown): string | undefined => {
  const o = obj(d)
  return o.year ? `${o.year}-${p2(o.month)}-${p2(o.day)}` : undefined
}
/** `{ date, time }` → "YYYY-MM-DDTHH:MM": the wall clock where it was measured */
const civilOf = (c: unknown): string | undefined => {
  const o = obj(c), day = dateOf(o.date), t = obj(o.time)
  return day ? `${day}T${p2(t.hours)}:${p2(t.minutes)}` : undefined
}

/**
 * The wall clock where it was measured, from a UTC instant and the offset the API sends beside it ("19800s").
 * The live API sends sleep this way (the documented civil times are not there), so both are read.
 */
const localOf = (instant: unknown, offset: unknown): string | undefined => {
  const t = typeof instant === 'string' ? Date.parse(instant) : NaN
  if (Number.isNaN(t)) return undefined
  const secs = Number.parseInt(String(offset ?? '0'), 10) || 0
  return new Date(t + secs * 1000).toISOString().slice(0, 16)
}

/** One raw API response (a page, or pages joined) → the simplified points core/map.ts reads. */
export function simplify(kind: Kind, raw: unknown): Simple {
  const r = obj(raw)
  if (SOURCES[kind].how === 'rollup') {
    const rows = Array.isArray(r.rollupDataPoints) ? (r.rollupDataPoints as unknown[]) : []
    return {
      dataPoints: rows.map((row) => {
        const o = obj(row), date = dateOf(obj(o.civilStartTime).date)
        if (kind === 'steps') return { date, countSum: obj(o.steps).countSum }
        if (kind === 'distance') return { date, millimetersSum: obj(o.distance).millimetersSum }
        if (kind === 'calories') return { date, kcalSum: obj(o.totalCalories).kcalSum }
        const z = obj(o.activeZoneMinutes)
        const parts = [z.sumInFatBurnHeartZone, z.sumInCardioHeartZone, z.sumInPeakHeartZone].map((x) => Number(x)).filter((x) => Number.isFinite(x))
        return { date, activeZoneMinutesSum: parts.length ? parts.reduce((a, b) => a + b, 0) : undefined }
      }),
    }
  }
  const rows = Array.isArray(r.dataPoints) ? (r.dataPoints as unknown[]) : []
  return {
    dataPoints: rows.map((row) => {
      const o = obj(row)
      if (kind === 'sleep') {
        const s = obj(o.sleep), iv = obj(s.interval), sum = obj(s.summary)
        const stageMinutes: Obj = {}
        for (const st of Array.isArray(sum.stagesSummary) ? (sum.stagesSummary as unknown[]) : []) stageMinutes[String(obj(st).type)] = obj(st).minutes
        return { start: civilOf(iv.civilStartTime) ?? localOf(iv.startTime, iv.startUtcOffset), end: civilOf(iv.civilEndTime) ?? localOf(iv.endTime, iv.endUtcOffset), minutesAsleep: sum.minutesAsleep, minutesAwake: sum.minutesAwake, stageMinutes, isNap: obj(s.metadata).nap === true }
      }
      if (kind === 'weight') {
        const w = obj(o.weight), t = obj(w.sampleTime)
        return { time: civilOf(t.civilTime) ?? String(t.physicalTime ?? ''), weightGrams: w.weightGrams }
      }
      // the daily summaries: one object named after the type, holding a date and the value
      const inner = obj(Object.values(o).find((v) => v && typeof v === 'object' && 'date' in (v as Obj)))
      return { ...inner, date: dateOf(inner.date) }
    }),
  }
}

export interface FetchLike {
  (url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>
}

export interface ReadResult {
  data: SimpleSet
  /** kind → why it could not be read (a scope not granted, a sensor the band lacks). The others still count. */
  failed: Partial<Record<Kind, string>>
  /** kind → how many points came back */
  counts: Partial<Record<Kind, number>>
}

/** Read these kinds (all of them by default) for a range of days. One kind failing does not sink the rest. */
export async function readHealth(token: string, from: string, to: string, fetcher: FetchLike, base = HEALTH_BASE, kinds: readonly Kind[] = KINDS): Promise<ReadResult> {
  const out: ReadResult = { data: {}, failed: {}, counts: {} }
  await Promise.all(kinds.map(async (kind) => {
    try {
      const all: unknown[] = []
      let page: string | undefined
      for (let i = 0; i < 20; i++) {
        const req = requestFor(kind, from, to, page, base)
        const res = await fetcher(req.url, { method: req.method, headers: { Authorization: `Bearer ${token}`, ...(req.body ? { 'Content-Type': 'application/json' } : {}) }, body: req.body })
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`)
        const json = obj(await res.json())
        all.push(...(simplify(kind, json)?.dataPoints ?? []))
        page = typeof json.nextPageToken === 'string' && json.nextPageToken ? json.nextPageToken : undefined
        if (!page) break
      }
      // still more to read after the page cap: the newest days would be silently missing
      if (page) throw new Error('too many pages')
      out.data[kind] = { dataPoints: all as Record<string, unknown>[] }
      out.counts[kind] = all.length
    } catch (err) {
      out.failed[kind] = err instanceof Error ? err.message : String(err)
    }
  }))
  return out
}
