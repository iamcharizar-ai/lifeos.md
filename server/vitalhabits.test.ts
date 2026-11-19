import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Habit } from '../src/config/habits.ts'
import { STEPS_HABIT, STEPS_GOAL, WATER_GOAL_ML, WATER_HABIT, progressOf, tickFixes, vitalKindOf } from '../src/lib/vitalHabits.ts'

const habit = (id: string, from = '2026-11-01', to: string | null = null): Habit => ({ id, name: id, emoji: '·', tier: 'core', spans: [{ from, to }] })
const HABITS = [habit(STEPS_HABIT), habit(WATER_HABIT), habit('reading')]

test('progress is a share of the goal, rounded down, and done only at the goal', () => {
  assert.deepEqual(progressOf('steps', 5000), { value: 5000, goal: STEPS_GOAL, pct: 50, done: false })
  assert.equal(progressOf('steps', 9999).pct, 99)
  assert.equal(progressOf('steps', 9999).done, false)
  assert.deepEqual(progressOf('steps', 10_000), { value: 10_000, goal: STEPS_GOAL, pct: 100, done: true })
  assert.equal(progressOf('steps', 23_000).pct, 100) // the bar never runs past full
  assert.equal(progressOf('water', 1000).pct, 25)
  assert.equal(progressOf('water', WATER_GOAL_ML).done, true)
  // nothing measured is not zero
  assert.deepEqual(progressOf('water', undefined), { value: null, goal: WATER_GOAL_ML, pct: 0, done: false })
  assert.equal(progressOf('steps', Number.NaN).value, null)
})

test('only the two vital habits are Google Health\'s', () => {
  assert.equal(vitalKindOf(STEPS_HABIT), 'steps')
  assert.equal(vitalKindOf(WATER_HABIT), 'water')
  assert.equal(vitalKindOf('reading'), null)
})

test('a tick follows the goal: reached ticks it, below it does not, no reading changes nothing', () => {
  const none = {}
  const read = (m: Record<string, { steps?: number; waterMl?: number }>) => (d: string) => m[d]
  // goal reached, not ticked yet: tick it. Water short: nothing to do
  assert.deepEqual(tickFixes(HABITS, none, read({ '2026-11-14': { steps: 10_400, waterMl: 2500 } }), ['2026-11-14']), [{ habitId: STEPS_HABIT, day: '2026-11-14', on: true }])
  // already ticked and still reached: nothing
  assert.deepEqual(tickFixes(HABITS, { '2026-11-14': { [STEPS_HABIT]: 'x' } }, read({ '2026-11-14': { steps: 10_400 } }), ['2026-11-14']), [])
  // ticked, but the reading is now below the goal (a corrected log): take it back
  assert.deepEqual(tickFixes(HABITS, { '2026-11-14': { [WATER_HABIT]: 'x' } }, read({ '2026-11-14': { waterMl: 3000 } }), ['2026-11-14']), [{ habitId: WATER_HABIT, day: '2026-11-14', on: false }])
  // no reading for the day: a tick that is there stays, a missing one is not added
  assert.deepEqual(tickFixes(HABITS, { '2026-11-14': { [WATER_HABIT]: 'x' } }, read({}), ['2026-11-14']), [])
})

test('a day before the habit was on the checklist is left alone', () => {
  const late = [habit(STEPS_HABIT, '2026-11-14')]
  assert.deepEqual(tickFixes(late, {}, () => ({ steps: 12_000 }), ['2026-11-13', '2026-11-14']), [{ habitId: STEPS_HABIT, day: '2026-11-14', on: true }])
  const off = [habit(STEPS_HABIT, '2026-11-01', '2026-11-10')]
  assert.deepEqual(tickFixes(off, {}, () => ({ steps: 12_000 }), ['2026-11-14']), [])
})
