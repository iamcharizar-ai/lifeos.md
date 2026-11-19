import test from 'node:test'
import assert from 'node:assert/strict'
import { queries, toVitals } from './map.ts'

test('rollups, sleep, daily summaries and weight land on the right day', () => {
  const out = toVitals({
    steps: { dataPoints: [{ date: '2026-03-28', countSum: '9037' }, { date: '2026-03-27', countSum: '0' }] },
    distance: { dataPoints: [{ date: '2026-03-28', millimetersSum: '6543210' }] },
    calories: { dataPoints: [{ date: '2026-03-28', kcalSum: 2411.6 }] },
    sleep: {
      dataPoints: [
        { start: '2026-03-27T23:12:00+05:30', end: '2026-03-28T06:40:00+05:30', minutesAsleep: '418', minutesAwake: '30', stageMinutes: { DEEP: 80, REM: 95, LIGHT: 243, AWAKE: 30 } },
        { start: '2026-03-28T14:00:00+05:30', end: '2026-03-28T14:40:00+05:30', minutesAsleep: '35', isNap: true },
        { start: '2026-03-28T03:00:00+05:30', end: '2026-03-28T03:50:00+05:30', minutesAsleep: '45' },
      ],
    },
    restingHr: { dataPoints: [{ date: '2026-03-28', beatsPerMinute: '58' }] },
    hrv: { dataPoints: [{ date: '2026-03-28', heartRateVariability: { rmssd: 47.26 } }] },
    weight: { dataPoints: [{ time: '2026-03-28T07:00:00+05:30', weightGrams: 71400 }, { time: '2026-03-28T21:00:00+05:30', weightGrams: 72050 }] },
  })
  assert.deepEqual(out['2026-03-28'], {
    steps: 9037, distanceM: 6543, kcal: 2412,
    bed: '2026-03-27T23:12', wake: '2026-03-28T06:40', sleepMin: 418, awakeMin: 30, deepMin: 80, remMin: 95, lightMin: 243,
    restingHr: 58, hrv: 47.3, weightKg: 72.05,
  })
  assert.deepEqual(out['2026-03-27'], { steps: 0 }) // a worn day with no steps is a real zero
  assert.equal(out['2026-03-26'], undefined) // an unworn day is simply absent
})

test("the band's staged night beats a longer stage-less one from the phone", () => {
  const band = { start: '2026-10-22T00:40:00+05:30', end: '2026-10-22T06:10:00+05:30', minutesAsleep: '300', minutesAwake: '30', stageMinutes: { DEEP: 50, REM: 60, LIGHT: 190, AWAKE: 30 } }
  const phone = { start: '2026-10-21T23:30:00+05:30', end: '2026-10-22T07:40:00+05:30', minutesAsleep: '490', minutesAwake: '0', stageMinutes: { ASLEEP: 490 } }
  for (const order of [[band, phone], [phone, band]]) {
    const night = toVitals({ sleep: { dataPoints: order } })['2026-10-22']
    assert.equal(night.sleepMin, 300)
    assert.equal(night.deepMin, 50)
  }
  // with only the phone's night, it still counts
  assert.equal(toVitals({ sleep: { dataPoints: [phone] } })['2026-10-22'].sleepMin, 490)
})

test('empty, failed or malformed responses produce nothing', () => {
  assert.deepEqual(toVitals({}), {})
  assert.deepEqual(toVitals({ steps: { dataPoints: [{ date: 'soon', countSum: '5' }, { countSum: '5' }, { date: '2026-03-28', countSum: '' }] }, sleep: null }), {})
})

test('every query asks for the same inclusive range', () => {
  const q = queries('2026-03-26', '2026-03-28')
  assert.equal(Object.keys(q).length, 13)
  for (const argv of Object.values(q)) assert.deepEqual(argv.slice(-4), ['--from', '2026-03-26', '--to', '2026-03-28'])
})
