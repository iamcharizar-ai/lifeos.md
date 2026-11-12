import test from 'node:test'
import assert from 'node:assert/strict'
import { claimId, exerciseBody, notesFor, pendingWorkouts, PUSH_TYPE, utcOffset, type GearWorkout } from './exercise.ts'
import type { LedgerEvent } from './model.ts'

const NOW = Date.parse('2026-11-12T12:00:00Z')
const gear = (id: string, over: Partial<GearWorkout> = {}): GearWorkout => ({
  id, name: 'Push', startedAt: '2026-11-12T09:00:00Z', finishedAt: '2026-11-12T09:50:00Z',
  exercises: [
    { exerciseId: 'bench', sets: [{ kg: 60, reps: 8 }, { kg: 62.5, reps: 6 }] },
    { exerciseId: 'plank', sets: [{ kg: null, reps: 45 }] },
    { exerciseId: 'dip', sets: [{ kg: null, reps: 12 }] },
  ],
  ...over,
})
const lib = { bench: { name: 'Bench Press', type: 'weight' }, plank: { name: 'Plank', type: 'duration' }, dip: { name: 'Dip', type: 'bodyweight' } }
const ev = (type: string, payload: LedgerEvent['payload']): LedgerEvent => ({ device: 'strong-x', at: '2026-11-12T09:50:00Z', day: '2026-11-12', type, payload })
const workoutEv = (w: GearWorkout) => ev('workout', { gear: JSON.stringify(w), lib: JSON.stringify(lib) })

test('a finished workout is pending, and becomes a strength-training session with its sets in the notes', () => {
  const [p] = pendingWorkouts([workoutEv(gear('w1'))], NOW)
  assert.equal(p.workout.id, 'w1')
  const body = exerciseBody(p, 'Asia/Kolkata') as { exercise: Record<string, unknown> }
  assert.equal(body.exercise.exerciseType, 'STRENGTH_TRAINING')
  assert.equal(body.exercise.activeDuration, '3000s')
  assert.deepEqual(body.exercise.interval, { startTime: '2026-11-12T09:00:00.000Z', startUtcOffset: '19800s', endTime: '2026-11-12T09:50:00.000Z', endUtcOffset: '19800s' })
  assert.equal(notesFor(p.workout, p.lib), 'Push\nBench Press: 60×8, 62.5×6\nPlank: 45s\nDip: 12\nLogged in Strong')
})

test('a workout that was already claimed, deleted in Strong, too old, empty or without times is not sent', () => {
  const events = [
    workoutEv(gear('claimed')), ev(PUSH_TYPE, { workout: 'claimed' }),
    workoutEv(gear('deleted')), ev('workout_delete', { id: 'deleted' }),
    workoutEv(gear('old', { startedAt: '2026-10-01T09:00:00Z', finishedAt: '2026-10-01T09:50:00Z' })),
    workoutEv(gear('empty', { exercises: [{ exerciseId: 'bench', sets: [] }] })),
    workoutEv(gear('backwards', { finishedAt: '2026-11-12T08:00:00Z' })),
    workoutEv(gear('ok')),
  ]
  assert.deepEqual(pendingWorkouts(events, NOW).map((p) => p.workout.id), ['ok'])
})

test('the same workout seen twice (two devices, a re-read) is one pending item, oldest first', () => {
  const later = gear('b', { startedAt: '2026-11-12T10:00:00Z', finishedAt: '2026-11-12T10:30:00Z' })
  const got = pendingWorkouts([workoutEv(later), workoutEv(gear('a')), workoutEv(gear('a'))], NOW)
  assert.deepEqual(got.map((p) => p.workout.id), ['a', 'b'])
})

test('the claim id is stable for a workout, differs between workouts, and is UUID-shaped', () => {
  assert.equal(claimId('w1'), claimId('w1'))
  assert.notEqual(claimId('w1'), claimId('w2'))
  assert.match(claimId('w1'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})

test('the UTC offset follows the zone, including negative and half-hour zones', () => {
  const d = new Date('2026-11-12T09:00:00Z')
  assert.equal(utcOffset('Asia/Kolkata', d), '19800s')
  assert.equal(utcOffset('America/New_York', d), '-18000s')
  assert.equal(utcOffset('UTC', d), '0s')
})
