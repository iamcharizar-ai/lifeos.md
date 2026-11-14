import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inTime } from '../src/game-core/facts.ts'
import { EDIT_DAYS, backfillStamp, canEditDay, cellEditable, editableDays } from '../src/lib/backfill.ts'

test('the last four days before today are editable, today is not', () => {
  assert.deepEqual(editableDays('2026-11-14'), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'])
  assert.equal(EDIT_DAYS, 4)
  assert.equal(canEditDay('2026-11-14', '2026-11-14'), false)
  assert.equal(canEditDay('2026-11-09', '2026-11-14'), false)
})

test('a previous month is never editable, even on the 1st', () => {
  assert.deepEqual(editableDays('2026-12-01'), [])
  assert.deepEqual(editableDays('2026-12-03'), ['2026-12-01', '2026-12-02'])
  assert.equal(canEditDay('2026-11-30', '2026-12-01'), false)
})

test('a backfilled tick is never counted by the game', () => {
  for (const day of ['2026-11-13', '2026-11-12', '2026-11-10']) {
    const at = backfillStamp(day, new Date('2026-11-14T09:00:00'))
    assert.equal(inTime(at, day), false, day)
  }
  // already past the window: the real time is kept
  assert.equal(backfillStamp('2026-11-10', new Date('2026-11-14T09:00:00')), new Date('2026-11-14T09:00:00').toISOString())
})

test('only a missed cell or a late tick can be flipped', () => {
  assert.equal(cellEditable(undefined, '2026-11-12'), true)
  assert.equal(cellEditable(new Date('2026-11-12T20:00:00').toISOString(), '2026-11-12'), false)
  assert.equal(cellEditable(backfillStamp('2026-11-12', new Date('2026-11-14T09:00:00')), '2026-11-12'), true)
})
