// VITALS CORE — what a day of body data looks like in the shared ledger, and
// what can be worked out from it. Pure TypeScript, no DOM, no dependencies.
//
// One `vitals` event per day per source. Every field is optional: a field that
// is absent means "not measured", never zero. (A band that was not worn sends
// nothing; a band that was worn on a lazy day sends a real 0.)

export interface LedgerEvent {
  /** the table's primary key; the bridge sets it so a repeated write is kept once (plan.ts) */
  id?: string
  device: string
  at: string // ISO, writer's clock
  day: string // YYYY-MM-DD the readings belong to
  type: string
  payload: Record<string, string | number | boolean | null>
  inserted_at?: string
}

/** Numbers measured for one day. Sleep belongs to the day it ended on (the morning you woke). */
export interface VitalsDay {
  /** local time you fell asleep / woke, "YYYY-MM-DDTHH:MM" */
  bed?: string
  wake?: string
  sleepMin?: number
  awakeMin?: number
  deepMin?: number
  remMin?: number
  lightMin?: number
  steps?: number
  distanceM?: number
  /** total energy burned */
  kcal?: number
  /** minutes in a raised heart-rate zone */
  zoneMin?: number
  restingHr?: number
  /** heart-rate variability, RMSSD in ms */
  hrv?: number
  spo2?: number
  respRate?: number
  /** skin temperature, degrees from your own baseline */
  tempDev?: number
  vo2max?: number
  weightKg?: number
}

export const NUMERIC: (keyof VitalsDay)[] = [
  'sleepMin', 'awakeMin', 'deepMin', 'remMin', 'lightMin', 'steps', 'distanceM', 'kcal', 'zoneMin',
  'restingHr', 'hrv', 'spo2', 'respRate', 'tempDev', 'vo2max', 'weightKg',
]
const TEXT: (keyof VitalsDay)[] = ['bed', 'wake']

export interface VitalsState {
  days: Record<string, VitalsDay>
  /** day → field → when it was last written (last write wins, per field) */
  at: Record<string, Record<string, string>>
}
export const emptyVitals = (): VitalsState => ({ days: {}, at: {} })

/**
 * Fold `vitals` events into state. Idempotent and order-independent: each
 * field of each day keeps the newest write, so a manual weigh-in and a band
 * sync for the same day merge instead of overwriting each other. Returns the
 * same object when nothing changed.
 */
export function foldVitals(state: VitalsState, events: LedgerEvent[]): VitalsState {
  let next = state
  for (const ev of events) {
    if (ev.type !== 'vitals' || !ev.day) continue
    for (const [k, v] of Object.entries(ev.payload ?? {})) {
      const key = k as keyof VitalsDay
      const num = NUMERIC.includes(key) && typeof v === 'number' && Number.isFinite(v)
      const txt = TEXT.includes(key) && typeof v === 'string' && v.length > 0
      // null takes a reading back (a mistyped weight, say)
      if (!num && !txt && !(v === null && (NUMERIC.includes(key) || TEXT.includes(key)))) continue
      const seen = next.at[ev.day]?.[k]
      if (seen && ev.at <= seen) continue
      if (next === state) next = { days: { ...state.days }, at: { ...state.at } }
      const day = { ...next.days[ev.day] } as Record<string, unknown>
      if (v === null) delete day[k]
      else day[k] = v
      next.days[ev.day] = day as VitalsDay
      next.at[ev.day] = { ...next.at[ev.day], [k]: ev.at }
    }
  }
  return next
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T12:00:00')
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── sleep ───────────────────────────────────────────────────────────────────
export interface SleepGoal {
  /** in bed by, "HH:MM" on the evening itself */
  bedBy: string
  /** minutes asleep that count as enough */
  minutes: number
}
export const SLEEP_GOAL: SleepGoal = { bedBy: '22:30', minutes: 7 * 60 + 30 }

/**
 * Did the night that STARTED on `day` meet the goal? That night's sleep is
 * filed under the next morning. null = nothing measured, which is not a miss.
 */
export function sleptOnTime(s: VitalsState, day: string, goal: SleepGoal = SLEEP_GOAL): boolean | null {
  const night = s.days[addDays(day, 1)]
  if (!night?.bed) return null
  const [date, time] = night.bed.split('T')
  // asleep before midnight on the evening itself, and early enough
  return date === day && time >= '18:00' && time <= goal.bedBy
}

export function sleptEnough(s: VitalsState, day: string, goal: SleepGoal = SLEEP_GOAL): boolean | null {
  const night = s.days[addDays(day, 1)]
  return night?.sleepMin === undefined ? null : night.sleepMin >= goal.minutes
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** What each part of the sleep score is worth. They add to 100. */
export const SLEEP_WEIGHTS = { length: 40, depth: 20, unbroken: 20, steady: 20 } as const
/** Minutes off your usual bedtime that still earn the full steadiness part, and where it falls to nothing. */
export const STEADY_FULL = 45
export const STEADY_ZERO = 120
/** Earlier nights that make up "usual", and how few are enough to have one. */
export const STEADY_NIGHTS = 7
export const STEADY_MIN = 3

/** Minutes after 18:00 that a "YYYY-MM-DDTHH:MM" bedtime falls, so 02:00 is later than 23:00 and the evening never wraps. */
const bedMinutes = (bed: string | undefined): number | null => {
  const m = /T(\d{2}):(\d{2})$/.exec(bed ?? '')
  return m ? (Number(m[1]) * 60 + Number(m[2]) - 18 * 60 + 1440) % 1440 : null
}

/**
 * How close this night's bedtime was to your own usual (the median of the
 * last seven nights before it), 0-1. null until three earlier nights exist.
 * The clock is not judged: only whether it was the same night as the others.
 */
export function steadiness(s: VitalsState, day: string): number | null {
  const mine = bedMinutes(s.days[day]?.bed)
  if (mine === null) return null
  const xs: number[] = []
  for (let i = 1; i <= STEADY_NIGHTS; i++) {
    const b = bedMinutes(s.days[addDays(day, -i)]?.bed)
    if (b !== null) xs.push(b)
  }
  if (xs.length < STEADY_MIN) return null
  xs.sort((a, b) => a - b)
  const mid = Math.floor(xs.length / 2)
  const usual = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
  return clamp01(1 - (Math.abs(mine - usual) - STEADY_FULL) / (STEADY_ZERO - STEADY_FULL))
}

/** The four parts of a night, each 0-1; null = not measured (it then takes the share of the time asleep). */
export interface SleepParts { length: number; depth: number | null; unbroken: number | null; steady: number | null }

export function sleepParts(d: VitalsDay | undefined, goal: SleepGoal = SLEEP_GOAL, steady: number | null = null): SleepParts | null {
  if (!d || d.sleepMin === undefined) return null
  const length = clamp01(d.sleepMin / goal.minutes)
  const staged = d.deepMin !== undefined && d.remMin !== undefined
  const depth = staged && d.sleepMin > 0 ? clamp01(((d.deepMin as number) + (d.remMin as number)) / d.sleepMin / 0.4) : null
  const inBed = d.sleepMin + (d.awakeMin ?? 0)
  const unbroken = d.awakeMin === undefined || inBed === 0 ? null : clamp01((d.sleepMin / inBed - 0.75) / 0.15)
  return { length, depth, unbroken, steady }
}

/**
 * A 0-100 sleep score for the sleep filed under `day`, built only from what
 * the band reports (the API has no score of its own): how long (40), how much
 * of it was deep or REM (20), how unbroken (20), and how steady the bedtime
 * was against your own usual (20). `steady` comes from steadiness().
 */
export function sleepScore(d: VitalsDay | undefined, goal: SleepGoal = SLEEP_GOAL, steady: number | null = null): number | null {
  const p = sleepParts(d, goal, steady)
  if (!p) return null
  const w = SLEEP_WEIGHTS
  return Math.round(p.length * w.length + (p.depth ?? p.length) * w.depth + (p.unbroken ?? p.length) * w.unbroken + (p.steady ?? p.length) * w.steady)
}
/** The same, with the earlier nights known, so steadiness counts. */
export const sleepScoreOn = (s: VitalsState, day: string, goal: SleepGoal = SLEEP_GOAL): number | null => sleepScore(s.days[day], goal, steadiness(s, day))
export const sleepPartsOn = (s: VitalsState, day: string, goal: SleepGoal = SLEEP_GOAL): SleepParts | null => sleepParts(s.days[day], goal, steadiness(s, day))

// ── baselines ───────────────────────────────────────────────────────────────
export const BASELINE_DAYS = 28
export const BASELINE_MIN = 7

/** Your own normal for a reading: the median of up to four weeks before `day`. null until a week of data exists. */
export function baseline(s: VitalsState, field: keyof VitalsDay, day: string): number | null {
  const xs: number[] = []
  for (let i = 1; i <= BASELINE_DAYS; i++) {
    const v = s.days[addDays(day, -i)]?.[field]
    if (typeof v === 'number') xs.push(v)
  }
  if (xs.length < BASELINE_MIN) return null
  xs.sort((a, b) => a - b)
  const m = Math.floor(xs.length / 2)
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
}

/**
 * A 0-100 recovery reading for the morning of `day`: variability above your
 * normal and resting heart rate below it are good, plus how you slept. Shown,
 * never paid for: it is an outcome, not something you do.
 */
export function recovery(s: VitalsState, day: string): number | null {
  const d = s.days[day]
  const hrv0 = baseline(s, 'hrv', day)
  const rhr0 = baseline(s, 'restingHr', day)
  if (!d || d.hrv === undefined || d.restingHr === undefined || hrv0 === null || rhr0 === null) return null
  const hrvPart = clamp01(0.5 + (d.hrv - hrv0) / hrv0 / 0.4) // ±20% of normal spans the range
  const rhrPart = clamp01(0.5 + (rhr0 - d.restingHr) / rhr0 / 0.2) // ±10%
  const sleep = (sleepScoreOn(s, day) ?? 50) / 100
  return Math.round((hrvPart * 0.45 + rhrPart * 0.3 + sleep * 0.25) * 100)
}

export function dayISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
