import test from 'node:test'
import assert from 'node:assert/strict'
import { planWrites } from './plan.ts'
import type { LedgerEvent } from './model.ts'

const night = (date: string, asleep: number, deep: number, rem: number) => ({
  start: `${date}T00:00:00+05:30`, end: `${date}T07:30:00+05:30`, minutesAsleep: String(asleep), minutesAwake: '20',
  stageMinutes: { DEEP: deep, REM: rem, LIGHT: asleep - deep - rem, AWAKE: 20 },
})

test('a night read from the band is written with its sleep score, and the steps beside it', () => {
  const read = {
    steps: { dataPoints: [{ date: '2026-10-13', countSum: '8200' }] },
    sleep: { dataPoints: [night('2026-10-13', 450, 90, 100)] },
  }
  const [e] = planWrites(read, [], '2026-10-13T06:00:00.000Z')
  assert.equal(e.day, '2026-10-13')
  assert.equal(e.type, 'vitals')
  assert.equal(e.payload.steps, 8200)
  assert.equal(typeof e.payload.sleepScore, 'number', 'the game reads the score, so the bridge must write one')
  assert.ok((e.payload.sleepScore as number) > 0 && (e.payload.sleepScore as number) <= 100)
})

test('running it again with nothing new writes nothing; a changed reading writes only that day', () => {
  const read = { steps: { dataPoints: [{ date: '2026-10-13', countSum: '8200' }, { date: '2026-10-12', countSum: '3000' }] }, sleep: { dataPoints: [night('2026-10-13', 450, 90, 100)] } }
  const first = planWrites(read, [], '2026-10-13T06:00:00.000Z')
  assert.equal(first.length, 2)
  assert.deepEqual(planWrites(read, first as LedgerEvent[], '2026-10-13T18:00:00.000Z'), [])
  const later = { ...read, steps: { dataPoints: [{ date: '2026-10-13', countSum: '9100' }, { date: '2026-10-12', countSum: '3000' }] } }
  const again = planWrites(later, first as LedgerEvent[], '2026-10-13T18:00:00.000Z')
  assert.deepEqual(again.map((e) => [e.day, e.payload.steps]), [['2026-10-13', 9100]])
})

test('two syncs that plan the same rows at once make the same ids, so the ledger keeps one copy', () => {
  const read = { steps: { dataPoints: [{ date: '2026-10-13', countSum: '8200' }] } }
  const a = planWrites(read, [], '2026-10-13T06:00:00.000Z')
  const b = planWrites(read, [], '2026-10-13T06:00:02.000Z')
  assert.match(a[0].id!, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.equal(a[0].id, b[0].id)
})

test('the same numbers written again after a change in between get a new id, so they still land', () => {
  const day = '2026-10-13'
  const first = planWrites({ weight: { dataPoints: [{ time: `${day}T07:00:00`, weightGrams: '70000' }] } }, [], '2026-10-13T07:00:00.000Z')
  const changed = { device: 'health-sync', at: '2026-10-13T08:00:00.000Z', day, type: 'vitals', payload: { weightKg: 71 } }
  const back = planWrites({ weight: { dataPoints: [{ time: `${day}T07:00:00`, weightGrams: '70000' }] } }, [...first as LedgerEvent[], changed], '2026-10-13T09:00:00.000Z')
  assert.equal(back.length, 1)
  assert.notEqual(back[0].id, first[0].id)
})
