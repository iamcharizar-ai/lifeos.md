import test from 'node:test'
import assert from 'node:assert/strict'
import { PUSH_QUIET_MS, WARNINGS, errorCode, warningFor } from './watch.ts'

const NOW = Date.parse('2026-11-03T08:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

test('no status row yet says nothing', () => {
  assert.equal(warningFor(null, NOW), undefined)
  assert.equal(warningFor({}, NOW), undefined)
})

test('a recent push and a clean sync say nothing', () => {
  assert.equal(warningFor({ last_push_at: ago(3_600_000), last_sync_at: ago(3_600_000) }, NOW), undefined)
})

test('an expired sign-in is named', () => {
  assert.equal(warningFor({ last_error: 'auth', last_error_at: ago(1000), last_sync_at: ago(86_400_000) }, NOW), WARNINGS.auth)
})

test('a failed read is named, and cleared by a later good one', () => {
  assert.equal(warningFor({ last_error: 'read', last_error_at: ago(5000) }, NOW), WARNINGS.read)
  assert.equal(warningFor({ last_error: 'read', last_error_at: ago(5000), last_sync_at: ago(1000) }, NOW), undefined)
})

test('a long silence from Google is reported in hours', () => {
  assert.equal(warningFor({ last_push_at: ago(PUSH_QUIET_MS + 3_600_000 * 2) }, NOW), WARNINGS.quiet(38))
  assert.equal(warningFor({ last_push_at: ago(PUSH_QUIET_MS - 60_000) }, NOW), undefined)
})

test('the sign-in refusal is told apart from other failures', () => {
  assert.equal(errorCode(new Error('Google refused the sign-in (invalid_grant); run ghealth auth login')), 'auth')
  assert.equal(errorCode(new Error('ledger write 500')), 'read')
  assert.equal(errorCode('x'), 'read')
})
