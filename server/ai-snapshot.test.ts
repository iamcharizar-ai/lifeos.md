import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSnapshot, renderJson, renderMarkdown, todayIn, type Row } from './ai-snapshot.ts'

const NOW = new Date('2026-11-08T06:00:00Z') // 11:30 in Asia/Kolkata, a Sunday
const TZ = 'Asia/Kolkata'

const HABITS = [
  { id: 'leetcode', name: 'LeetCode', emoji: '💻', tier: 'pillar', spans: [{ from: '2026-10-01', to: null }] },
  { id: 'brush', name: 'Brush', emoji: '🪥', tier: 'basic', spans: [{ from: '2026-10-01', to: null }] },
  { id: 'old', name: 'Retired habit', emoji: '🗑', tier: 'basic', spans: [{ from: '2026-10-01', to: '2026-10-20' }] },
]

let n = 0
const row = (type: string, day: string, payload: Record<string, unknown>, at = `${day}T08:00:00.000Z`): Row => ({ id: String(++n), device: 'test', at, day, type, payload, inserted_at: at })
const tick = (day: string, habitId: string) => row('tick', day, { habitId, at: `${day}T08:00:00.000Z` })

function ledger(): Row[] {
  return [
    row('config', '2026-10-01', { habits: JSON.stringify(HABITS), deleted: '[]' }, '2026-10-01T00:00:00.000Z'),
    tick('2026-11-05', 'leetcode'),
    tick('2026-11-05', 'brush'),
    tick('2026-11-06', 'leetcode'),
    row('untick', '2026-11-06', { habitId: 'leetcode' }, '2026-11-06T09:00:00.000Z'),
    tick('2026-11-07', 'brush'),
    tick('2026-11-08', 'leetcode'),
    row('vitals', '2026-11-08', { sleepScore: 84, sleepMin: 441, steps: 5200, bed: '2026-11-07T22:20', wake: '2026-11-08T05:41' }),
    row('workout', '2026-11-07', { type: 'Push', at: '2026-11-07T11:00:00.000Z', session: JSON.stringify({ id: 'w1', name: 'Push', durationMin: 55, totalSets: 2, volumeKg: 960, muscles: ['chest'], exercises: [{ name: 'Bench Press', sets: [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }] }] }) }),
    row('sunday', '2026-11-01', { tasks: JSON.stringify([{ id: 'nails', name: 'Cut nails', emoji: '💅' }]) }),
    row('metric', '2026-11-07', { key: 'weight', value: '71.4' }),
  ]
}

test('todayIn uses the owner time zone, not UTC', () => {
  assert.equal(todayIn('Asia/Kolkata', new Date('2026-11-07T20:00:00Z')), '2026-11-08')
  assert.equal(todayIn('UTC', new Date('2026-11-07T20:00:00Z')), '2026-11-07')
})

test('folds ticks, unticks and the live library into today and the day table', () => {
  const s = buildSnapshot(ledger(), { tz: TZ, now: NOW, days: 7 })
  assert.equal(s.today, '2026-11-08')
  assert.equal(s.weekday, 'Sun')
  const live = s.today_.items.map((i) => i.name)
  assert.ok(live.includes('LeetCode') && live.includes('Brush'))
  assert.ok(!live.includes('Retired habit'), 'a habit switched off before today is not on the checklist')
  assert.equal(s.today_.items.find((i) => i.id === 'leetcode')?.done, true)
  assert.equal(s.today_.items.find((i) => i.id === 'brush')?.done, false)
  const d = (day: string) => s.days.find((x) => x.day === day)!
  assert.equal(d('2026-11-05').perfect, true)
  assert.equal(d('2026-11-06').done, 0, 'the untick took the tick back')
  assert.deepEqual(d('2026-11-07').missed.includes('LeetCode'), true)
})

test('history starts at the first tick, not before it', () => {
  const s = buildSnapshot(ledger(), { tz: TZ, now: NOW, days: 120 })
  assert.equal(s.window.from, '2026-11-05')
  assert.equal(s.days[0].day, '2026-11-05')
})

test('the band, a workout and the Sunday list come through', () => {
  const s = buildSnapshot(ledger(), { tz: TZ, now: NOW })
  assert.equal(s.body.nights.find((x) => x.day === '2026-11-08')?.sleepScore, 84)
  assert.equal(s.freshness.latestBandDay, '2026-11-08')
  assert.equal(s.workouts[0].name, 'Push')
  assert.deepEqual(s.workouts[0].exercises, ['Bench Press: 60kg×8, 60kg×8'])
  assert.equal(s.today_.sunday?.[0].name, 'Cut nails')
  assert.equal(s.body.manual['metric:weight'].value, '71.4')
})

test('markdown has the headline sections and no undefined', () => {
  const md = renderMarkdown(buildSnapshot(ledger(), { tz: TZ, now: NOW }))
  for (const h of ['# Life OS snapshot', '## How to read this', '## Today', '## Day by day', '## The game (Pokedex)', '## Body', '## Arbor', '## Woodshed', '## Workouts (Strong)']) assert.ok(md.includes(h), h)
  assert.ok(!/undefined|NaN|\[object/.test(md), 'no broken values in the text')
  assert.ok(md.includes('Bench Press'))
})

test('a section filter keeps only what was asked for, and drops the preamble', () => {
  const md = renderMarkdown(buildSnapshot(ledger(), { tz: TZ, now: NOW }), ['body'])
  assert.ok(md.includes('## Body') && !md.includes('## Today') && !md.includes('## How to read this'))
  const json = JSON.parse(renderJson(buildSnapshot(ledger(), { tz: TZ, now: NOW }), ['game']))
  assert.ok(json.game && !json.body && json.today === '2026-11-08')
})

test('an empty ledger still renders (a brand new system, or a failed read that returned nothing)', () => {
  const s = buildSnapshot([], { tz: TZ, now: NOW })
  const md = renderMarkdown(s)
  assert.ok(md.includes('# Life OS snapshot'))
  assert.equal(s.freshness.events, 0)
})

test('the day count is clamped', () => {
  assert.equal(buildSnapshot(ledger(), { tz: TZ, now: NOW, days: 99999 }).window.days, 120)
  assert.equal(buildSnapshot(ledger(), { tz: TZ, now: NOW, days: 0 }).window.days, 1)
})

test('two habits with one name are told apart', () => {
  const twin = [
    { id: 'bath-am', name: 'Bath', emoji: '🛁', tier: 'basic', spans: [{ from: '2026-10-01', to: null }] },
    { id: 'bath-pm', name: 'Bath', emoji: '🛁', tier: 'basic', spans: [{ from: '2026-10-01', to: null }] },
  ]
  const rows = [row('config', '2026-10-01', { habits: JSON.stringify(twin), deleted: '[]' }, '2026-10-01T00:00:00.000Z'), tick('2026-11-07', 'bath-am')]
  const s = buildSnapshot(rows, { tz: TZ, now: NOW })
  assert.deepEqual(s.today_.items.map((i) => i.name), ['Bath', 'Bath (2)'])
})

test('a poor day names the habits that were ticked, not thirty misses', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, name: `Habit ${i}`, emoji: '', tier: 'basic', spans: [{ from: '2026-10-01', to: null }] }))
  const rows = [row('config', '2026-10-01', { habits: JSON.stringify(many), deleted: '[]' }, '2026-10-01T00:00:00.000Z'), tick('2026-11-07', 'h0')]
  const md = renderMarkdown(buildSnapshot(rows, { tz: TZ, now: NOW }))
  assert.match(md, /only ticked: Habit 0 \|/)
  assert.doesNotMatch(md, /missed: Habit 1,/)
})
