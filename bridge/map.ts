// Google Health readings → one `vitals` payload per day.
//
// Pure functions over a simplified shape (`{ dataPoints: [...] }` per data
// type), which is what the `ghealth` CLI prints and what core/health.ts turns
// the raw API into. So the same mapping serves the server sync and the PC
// script, and can be tested without a band or a Google sign-in. 64-bit
// numbers arrive as strings, so everything goes through num().
import { recovery, sleepScoreOn, type VitalsDay, type VitalsState } from './model.ts'

type Point = Record<string, unknown>
export type Simple = { dataPoints?: Point[] } | null | undefined
export type SimpleSet = Partial<Record<Kind, Simple>>
export type Kind = 'steps' | 'distance' | 'calories' | 'zoneMinutes' | 'hydration' | 'sleep' | 'restingHr' | 'hrv' | 'spo2' | 'respRate' | 'tempDev' | 'vo2max' | 'weight'
export type DayPayload = { [K in keyof VitalsDay]?: VitalsDay[K] }

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}
const round = (v: number | undefined, places = 0): number | undefined => (v === undefined ? undefined : Math.round(v * 10 ** places) / 10 ** places)
const points = (res: Simple): Point[] => (Array.isArray(res?.dataPoints) ? res.dataPoints : [])
/** "2026-03-29T16:33:07+01:00" → the wall-clock date and minute it shows */
const civilDay = (stamp: unknown): string => String(stamp ?? '').slice(0, 10)
const civilMinute = (stamp: unknown): string => String(stamp ?? '').slice(0, 16)

/** First numeric value under any of these keys (the daily summary types differ in what they call it). */
function pick(point: Point, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = num(point?.[k])
    if (v !== undefined) return v
  }
  // one level down, for shapes like { heartRateVariability: { rmssd } }
  for (const v of Object.values(point ?? {})) {
    if (v && typeof v === 'object') for (const k of keys) if (num((v as Point)[k]) !== undefined) return num((v as Point)[k])
  }
  return undefined
}

const put = (out: Record<string, DayPayload>, day: unknown, fields: Record<string, unknown>): void => {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''))
  if (Object.keys(clean).length) out[day] = { ...out[day], ...clean }
}

/** day → vitals payload. A day or field the band did not report is absent, never 0. */
export function toVitals(res: SimpleSet): Record<string, DayPayload> {
  const out: Record<string, DayPayload> = {}

  // rollups: { date, countSum | millimetersSum | kcalSum | ... }
  for (const p of points(res.steps)) put(out, p.date, { steps: num(p.countSum) })
  for (const p of points(res.distance)) {
    const mm = num(p.millimetersSum)
    put(out, p.date, { distanceM: mm === undefined ? undefined : round(mm / 1000) })
  }
  for (const p of points(res.calories)) put(out, p.date, { kcal: round(num(p.kcalSum)) })
  for (const p of points(res.zoneMinutes)) put(out, p.date, { zoneMin: pick(p, ['activeZoneMinutesSum', 'activeZoneMinutes']) })
  // water: the day's logged total, in millilitres (a day with no log is absent, not 0: nothing was measured)
  for (const p of points(res.hydration)) put(out, p.date, { waterMl: round(num(p.millilitersSum)) })

  // sleep: filed under the morning it ended. A staged night (the band's: deep, light, REM)
  // beats a stage-less one (a phone's estimate arriving through Health Connect, one
  // "ASLEEP" block), whatever their lengths; between two of a kind the longest wins.
  const best: Record<string, number> = {}
  for (const p of points(res.sleep)) {
    if (p.isNap) continue
    const day = civilDay(p.end)
    const asleep = num(p.minutesAsleep)
    const st = (p.stageMinutes ?? {}) as Point
    const staged = ['DEEP', 'REM', 'LIGHT'].some((k) => num(st[k]) !== undefined)
    const rank = asleep === undefined ? undefined : (staged ? 100_000 : 0) + asleep
    if (rank === undefined || (best[day] !== undefined && best[day] >= rank)) continue
    best[day] = rank
    put(out, day, {
      bed: civilMinute(p.start),
      wake: civilMinute(p.end),
      sleepMin: asleep,
      awakeMin: num(p.minutesAwake),
      deepMin: num(st.DEEP),
      remMin: num(st.REM),
      lightMin: num(st.LIGHT),
    })
  }

  // daily summaries: { date, <value> }
  for (const p of points(res.restingHr)) put(out, p.date, { restingHr: pick(p, ['beatsPerMinute']) })
  for (const p of points(res.hrv)) put(out, p.date, { hrv: round(pick(p, ['averageHeartRateVariabilityMilliseconds', 'rmssd', 'averageRmssd', 'dailyRmssd', 'rmssdMilliseconds']), 1) })
  for (const p of points(res.spo2)) put(out, p.date, { spo2: round(pick(p, ['averagePercentage', 'percentage', 'average']), 1) })
  for (const p of points(res.respRate)) put(out, p.date, { respRate: round(pick(p, ['breathsPerMinute', 'respiratoryRate']), 1) })
  for (const p of points(res.tempDev)) {
    // the API gives last night and your baseline; the reading that matters is the gap between them
    const night = num(p.nightlyTemperatureCelsius), base = num(p.baselineTemperatureCelsius)
    const gap = night !== undefined && base !== undefined ? night - base : pick(p, ['nightlyRelative', 'temperatureDeviationCelsius', 'deviationCelsius', 'relative'])
    put(out, p.date, { tempDev: round(gap, 2) })
  }
  for (const p of points(res.vo2max)) put(out, p.date, { vo2max: round(pick(p, ['vo2Max', 'value']), 1) })

  // weight: the last reading of each day
  const lastAt: Record<string, string> = {}
  for (const p of points(res.weight)) {
    const time = String(p.time ?? ''), day = civilDay(time), g = num(p.weightGrams)
    if (g === undefined || (lastAt[day] && lastAt[day] > time)) continue
    lastAt[day] = time
    put(out, day, { weightKg: round(g / 1000, 2) })
  }
  return out
}

/** What to ask the `ghealth` CLI for, as argument lists. `from`/`to` are YYYY-MM-DD, inclusive. */
export function queries(from: string, to: string): Record<Kind, string[]> {
  const range = ['--from', from, '--to', to]
  return {
    steps: ['data', 'steps', 'daily-rollup', ...range],
    distance: ['data', 'distance', 'daily-rollup', ...range],
    calories: ['data', 'total-calories', 'daily-rollup', ...range],
    zoneMinutes: ['data', 'active-zone-minutes', 'daily-rollup', ...range],
    hydration: ['data', 'hydration-log', 'daily-rollup', ...range],
    sleep: ['data', 'sleep', 'list', ...range],
    restingHr: ['data', 'daily-resting-heart-rate', 'list', ...range],
    hrv: ['data', 'daily-heart-rate-variability', 'list', ...range],
    spo2: ['data', 'daily-oxygen-saturation', 'list', ...range],
    respRate: ['data', 'daily-respiratory-rate', 'list', ...range],
    tempDev: ['data', 'daily-sleep-temperature-derivations', 'list', ...range],
    vo2max: ['data', 'daily-vo2-max', 'list', ...range],
    weight: ['data', 'weight', 'list', ...range],
  }
}

/** What the game and the other apps read without working it out again: the two scores, worked out once, here. */
export interface Scored extends DayPayload {
  sleepScore?: number
  recovery?: number
}

/**
 * The rows to write for a sync: each day's readings plus its sleep score and
 * recovery, limited to what differs from the ledger already (`known`), so a
 * daily sync of an unchanged week writes nothing.
 */
export function rowsToWrite(days: Record<string, DayPayload>, known: VitalsState, knownScores: Record<string, { sleepScore?: number; recovery?: number }> = {}): Record<string, Scored> {
  // scores need the whole picture (recovery compares against a month of mornings)
  const merged: VitalsState = { days: { ...known.days }, at: known.at }
  for (const [day, p] of Object.entries(days)) merged.days[day] = { ...merged.days[day], ...p }
  const out: Record<string, Scored> = {}
  for (const [day, p] of Object.entries(days)) {
    const full: Scored = { ...p }
    const s = sleepScoreOn(merged, day)
    if (s !== null && p.sleepMin !== undefined) full.sleepScore = s
    const r = recovery(merged, day)
    if (r !== null) full.recovery = r
    const before = { ...known.days[day], ...knownScores[day] } as Record<string, unknown>
    const changed = Object.fromEntries(Object.entries(full).filter(([k, v]) => before[k] !== v))
    if (Object.keys(changed).length) out[day] = changed as Scored
  }
  return out
}
