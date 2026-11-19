import test from 'node:test'
import assert from 'node:assert/strict'
import { KINDS, addDays, readHealth, requestFor, simplify, type FetchLike } from './health.ts'
import { rowsToWrite, toVitals } from './map.ts'
import { emptyVitals, foldVitals } from './model.ts'

const D = (day: string) => ({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)), day: Number(day.slice(8)) })
const civil = (day: string, h = 0, m = 0) => ({ date: D(day), time: { hours: h, minutes: m } })

/** Answers shaped like the API's discovery document says they are. */
const RAW: Record<string, unknown> = {
  steps: { rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), civilEndTime: civil('2026-03-29'), steps: { countSum: '9037' } }] },
  distance: { rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), distance: { millimetersSum: '6543210' } }] },
  'total-calories': { rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), totalCalories: { kcalSum: 2411.6 } }] },
  'active-zone-minutes': { rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), activeZoneMinutes: { sumInFatBurnHeartZone: '20', sumInCardioHeartZone: '12', sumInPeakHeartZone: '2' } }] },
  // the water log's rollup field name is a best guess until it is seen live; simplify() finds the number by what it is
  'hydration-log': { rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), hydrationLog: { volumeMillilitersSum: '3250' } }] },
  sleep: {
    dataPoints: [
      { sleep: { interval: { civilStartTime: civil('2026-03-27', 23, 12), civilEndTime: civil('2026-03-28', 6, 40) }, summary: { minutesAsleep: '418', minutesAwake: '30', stagesSummary: [{ type: 'DEEP', minutes: '80' }, { type: 'REM', minutes: '95' }, { type: 'LIGHT', minutes: '243' }, { type: 'AWAKE', minutes: '30' }] }, metadata: { mainSleep: true } } },
      { sleep: { interval: { civilStartTime: civil('2026-03-28', 14, 0), civilEndTime: civil('2026-03-28', 14, 40) }, summary: { minutesAsleep: '35' }, metadata: { nap: true } } },
    ],
  },
  'daily-resting-heart-rate': { dataPoints: [{ dailyRestingHeartRate: { date: D('2026-03-28'), beatsPerMinute: '58' } }] },
  'daily-heart-rate-variability': { dataPoints: [{ dailyHeartRateVariability: { date: D('2026-03-28'), averageHeartRateVariabilityMilliseconds: 47.26, entropy: 2.1 } }] },
  'daily-oxygen-saturation': { dataPoints: [{ dailyOxygenSaturation: { date: D('2026-03-28'), averagePercentage: 96.44, lowerBoundPercentage: 93 } }] },
  'daily-respiratory-rate': { dataPoints: [{ dailyRespiratoryRate: { date: D('2026-03-28'), breathsPerMinute: 14.62 } }] },
  'daily-sleep-temperature-derivations': { dataPoints: [{ dailySleepTemperatureDerivations: { date: D('2026-03-28'), nightlyTemperatureCelsius: 34.1, baselineTemperatureCelsius: 34.35 } }] },
  'daily-vo2-max': { dataPoints: [{ dailyVo2Max: { date: D('2026-03-28'), vo2Max: 44.82 } }] },
  weight: { dataPoints: [{ weight: { sampleTime: { civilTime: civil('2026-03-28', 7, 0), physicalTime: '2026-03-28T01:30:00Z' }, weightGrams: 71400 } }, { weight: { sampleTime: { civilTime: civil('2026-03-28', 21, 0) }, weightGrams: 72050 } }] },
}
const typeIn = (url: string) => /dataTypes\/([a-z0-9-]+)\/dataPoints/.exec(url)![1]
const fake = (raw = RAW, calls: { url: string; method: string; body?: string; auth: string }[] = []): FetchLike => async (url, init) => {
  calls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization })
  const t = typeIn(url)
  const ok = t in raw
  return { ok, status: ok ? 200 : 403, json: async () => raw[t], text: async () => 'scope not granted' }
}

test('requests: closed-open civil ranges, the filter each type takes, and the 14-day cap', () => {
  const r = requestFor('steps', '2026-03-22', '2026-03-28')
  assert.equal(r.method, 'POST')
  assert.match(r.url, /\/v4\/users\/me\/dataTypes\/steps\/dataPoints:dailyRollUp$/)
  const body = JSON.parse(r.body!)
  assert.deepEqual([body.range.start.date, body.range.end.date, body.windowSizeDays], [D('2026-03-22'), D('2026-03-29'), 1])
  const sleep = requestFor('sleep', '2026-03-22', '2026-03-28')
  assert.equal(sleep.method, 'GET')
  assert.equal(new URL(sleep.url).searchParams.get('filter'), 'sleep.interval.civil_end_time >= "2026-03-22" AND sleep.interval.civil_end_time < "2026-03-29"')
  assert.equal(new URL(requestFor('hrv', '2026-03-28', '2026-03-28').url).searchParams.get('filter'), 'daily_heart_rate_variability.date >= "2026-03-28" AND daily_heart_rate_variability.date < "2026-03-29"')
  // calories may only be asked for 14 days at a time: a longer sync reads the newest 14
  assert.deepEqual(JSON.parse(requestFor('calories', '2026-01-01', '2026-03-28').body!).range.start.date, D('2026-03-15'))
  assert.equal(addDays('2026-02-28', 1), '2026-03-01')
  assert.equal(KINDS.length, 13)
})

test('raw API answers become one day of readings', async () => {
  const calls: { url: string; method: string; body?: string; auth: string }[] = []
  const res = await readHealth('tok', '2026-03-27', '2026-03-28', fake(RAW, calls))
  assert.deepEqual(res.failed, {})
  assert.equal(calls.length, 13)
  assert.ok(calls.every((c) => c.auth === 'Bearer tok'))
  assert.deepEqual(toVitals(res.data)['2026-03-28'], {
    steps: 9037, distanceM: 6543, kcal: 2412, zoneMin: 34, waterMl: 3250,
    bed: '2026-03-27T23:12', wake: '2026-03-28T06:40', sleepMin: 418, awakeMin: 30, deepMin: 80, remMin: 95, lightMin: 243,
    restingHr: 58, hrv: 47.3, spo2: 96.4, respRate: 14.6, tempDev: -0.25, vo2max: 44.8, weightKg: 72.05,
  })
})

test('one type failing leaves the others standing, and pages are followed', async () => {
  const { sleep: _gone, ...rest } = RAW
  const res = await readHealth('tok', '2026-03-28', '2026-03-28', fake(rest))
  assert.match(res.failed.sleep ?? '', /^403/)
  assert.equal(toVitals(res.data)['2026-03-28'].steps, 9037)
  assert.equal(toVitals(res.data)['2026-03-28'].sleepMin, undefined)
  let n = 0
  const paged: FetchLike = async (url) => {
    const first = typeIn(url) === 'weight' && n++ === 0
    return { ok: true, status: 200, text: async () => '', json: async () => (typeIn(url) !== 'weight' ? {} : first ? { dataPoints: [(RAW.weight as { dataPoints: unknown[] }).dataPoints[0]], nextPageToken: 'p2' } : { dataPoints: [(RAW.weight as { dataPoints: unknown[] }).dataPoints[1]] }) }
  }
  const two = await readHealth('tok', '2026-03-28', '2026-03-28', paged)
  assert.equal(two.counts.weight, 2)
  assert.deepEqual(simplify('steps', null), { dataPoints: [] })
})

test('running out of pages is a failure for that kind, not a quiet partial read', async () => {
  let weightCalls = 0
  const endless: FetchLike = async (url) => {
    if (typeIn(url) === 'weight') weightCalls++
    return { ok: true, status: 200, text: async () => '', json: async () => (typeIn(url) !== 'weight' ? {} : { dataPoints: [(RAW.weight as { dataPoints: unknown[] }).dataPoints[0]], nextPageToken: 'more' }) }
  }
  const res = await readHealth('tok', '2026-03-28', '2026-03-28', endless)
  assert.equal(weightCalls, 20) // the cap
  assert.match(res.failed.weight ?? '', /too many pages/)
  assert.equal(res.data.weight, undefined) // nothing partial is kept, so no day looks complete when it is not
  assert.equal(res.counts.weight, undefined)
  assert.equal(res.failed.steps, undefined) // the other kinds are unaffected
})

test('rows to write: scores are added, and what the ledger already has is left out', async () => {
  const days = toVitals((await readHealth('tok', '2026-03-28', '2026-03-28', fake())).data)
  const first = rowsToWrite(days, emptyVitals())
  assert.equal(first['2026-03-28'].sleepScore, 96) // 418 of 450 min (37 of 40), deep+REM 42% (20), 93% asleep in bed (20), no usual bedtime yet so steadiness takes the length share (19)
  assert.equal(first['2026-03-28'].recovery, undefined) // needs a week of mornings first
  // the same sync again, with those rows now in the ledger: nothing to write
  const known = foldVitals(emptyVitals(), [{ device: 'vitals-sync', at: '2026-03-28T02:00:00Z', day: '2026-03-28', type: 'vitals', payload: first['2026-03-28'] as Record<string, number | string> }])
  assert.deepEqual(rowsToWrite(days, known, { '2026-03-28': { sleepScore: 96 } }), {})
  // one reading changed since: only that field goes out
  const more = { '2026-03-28': { ...days['2026-03-28'], steps: 9900 } }
  assert.deepEqual(rowsToWrite(more, known, { '2026-03-28': { sleepScore: 96 } }), { '2026-03-28': { steps: 9900 } })
})

test('sleep as the live API sends it (UTC instants and an offset, no civil times) lands on the morning it ended', () => {
  const live = {
    dataPoints: [{
      sleep: {
        interval: { startTime: '2026-10-12T21:00:00Z', startUtcOffset: '19800s', endTime: '2026-10-13T02:20:00Z', endUtcOffset: '19800s' },
        summary: { minutesAsleep: '320', minutesAwake: '0', stagesSummary: [{ type: 'ASLEEP', minutes: '320', count: '1' }] },
        metadata: { mainSleep: true },
      },
    }],
  }
  const out = toVitals({ sleep: simplify('sleep', live) })
  assert.deepEqual(out['2026-10-13'], { bed: '2026-10-13T02:30', wake: '2026-10-13T07:50', sleepMin: 320, awakeMin: 0 })
})

test('water: the logged total of a day, whatever the rollup calls the field; a row with no number is nothing logged', () => {
  const row = (inner: unknown) => ({ rollupDataPoints: [{ civilStartTime: civil('2026-03-28'), hydrationLog: inner }] })
  for (const inner of [{ volumeMillilitersSum: '3250' }, { millilitersSum: 3250 }, { amountSum: '3250.4' }])
    assert.equal(toVitals({ hydration: simplify('hydration', row(inner)) })['2026-03-28']?.waterMl, 3250, JSON.stringify(inner))
  assert.deepEqual(toVitals({ hydration: simplify('hydration', row({})) }), {})
  assert.deepEqual(toVitals({ hydration: simplify('hydration', null) }), {})
  // it is read like the other rollups, and a repeated sync of an unchanged total writes nothing
  const days = toVitals({ hydration: simplify('hydration', row({ volumeMillilitersSum: '3250' })) })
  const known = foldVitals(emptyVitals(), [{ device: 'health-sync', at: '2026-03-28T20:00:00Z', day: '2026-03-28', type: 'vitals', payload: { waterMl: 3250 } }])
  assert.deepEqual(rowsToWrite(days, known), {})
  assert.deepEqual(rowsToWrite({ '2026-03-28': { waterMl: 3500 } }, known), { '2026-03-28': { waterMl: 3500 } })
})
