import test from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { authOk, ecdsaPoint, parseNotifications, verifySignature, windowFor, type Keyset } from './webhook.ts'

/** A signing key and the keyset entry Google would publish for it, built the way Tink does (a protobuf with a leading zero on x and y). */
function makeKey(keyId: number) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string }
  const x = Buffer.concat([Buffer.from([0]), Buffer.from(jwk.x, 'base64url')])
  const y = Buffer.concat([Buffer.from([0]), Buffer.from(jwk.y, 'base64url')])
  const proto = Buffer.concat([Buffer.from([0x12, 0x06, 0x08, 0x03, 0x10, 0x02, 0x18, 0x02, 0x1a, 0x21]), x, Buffer.from([0x22, 0x21]), y])
  const entry = { keyData: { value: proto.toString('base64') }, keyId, status: 'ENABLED', outputPrefixType: 'TINK' }
  const signBody = (body: string): string => {
    const sig = createSign('sha256').update(body).sign({ key: privateKey, dsaEncoding: 'der' })
    const prefix = Buffer.alloc(5)
    prefix[0] = 1
    prefix.writeUInt32BE(keyId, 1)
    return Buffer.concat([prefix, sig]).toString('base64')
  }
  return { entry, signBody }
}

test('a signature made with a published key verifies; a changed body, an unknown key or a missing header does not', () => {
  const a = makeKey(4193570438), b = makeKey(1083906037)
  const keyset: Keyset = { key: [a.entry, b.entry] }
  const body = '{"data":{"dataType":"steps"}}'
  assert.equal(verifySignature(body, a.signBody(body), keyset), true)
  assert.equal(verifySignature(body, b.signBody(body), keyset), true, 'any key in the set, picked by the id in the signature')
  assert.equal(verifySignature(body + ' ', a.signBody(body), keyset), false)
  assert.equal(verifySignature(body, a.signBody(body), { key: [b.entry] }), false, 'a key that is not in the set')
  assert.equal(verifySignature(body, null, keyset), false)
  assert.equal(verifySignature(body, a.signBody(body), null), false)
  assert.equal(verifySignature(body, 'AAAA', keyset), false)
})

test("Google's real published keys parse into 32-byte points", () => {
  // a key out of https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json
  const p = ecdsaPoint('EgYIAxACGAIaIQBuWzwqKbBeNzHKDnE+UQyYi+xZFbyHD0L7EkIq98nz8yIhAIrPyGj2znh4/Ry60aI+JRneY8/bLoIuG2M+KLMbFT9X')
  assert.ok(p)
  assert.deepEqual([p.x.length, p.y.length], [32, 32])
  assert.equal(ecdsaPoint('not base64 protobuf'), null)
})

test('the secret is compared exactly; an empty one never matches', () => {
  assert.equal(authOk('Bearer s3cret', 'Bearer s3cret'), true)
  assert.equal(authOk('Bearer s3cre', 'Bearer s3cret'), false)
  assert.equal(authOk(null, 'x'), false)
  assert.equal(authOk('', ''), false)
})

const note = (dataType: string, start?: string, end = start, operation = 'UPSERT') => ({
  data: { version: '1', healthUserId: 'u', operation, dataType, ...(start ? { intervals: [{ civilIso8601TimeInterval: { startTime: start, endTime: end } }] } : {}) },
})

test('one notification or an array of them is read; junk is skipped', () => {
  assert.deepEqual(parseNotifications(note('steps', '2026-10-13T10:00:00', '2026-10-13T10:05:00')), [{ dataType: 'steps', operation: 'UPSERT', days: ['2026-10-13'] }])
  const many = parseNotifications([note('sleep', '2026-10-12T23:30:00', '2026-10-13T06:50:00'), { nope: 1 }, null, note('weight', undefined, undefined, 'DELETE')])
  assert.deepEqual(many.map((t) => [t.dataType, t.operation, t.days]), [['sleep', 'UPSERT', ['2026-10-12', '2026-10-13']], ['weight', 'DELETE', []]])
})

test('the days to read again run from the oldest day touched to today, never more than a week, and only for what the game uses', () => {
  const today = '2026-10-13'
  assert.deepEqual(windowFor(parseNotifications(note('steps', '2026-10-13T10:00:00')), today), { from: '2026-10-13', to: today })
  assert.deepEqual(windowFor(parseNotifications([note('steps', '2026-10-13T10:00:00'), note('sleep', '2026-10-12T23:00:00', '2026-10-13T07:00:00')]), today), { from: '2026-10-12', to: today })
  assert.deepEqual(windowFor(parseNotifications(note('steps', '2026-09-01T10:00:00')), today), { from: '2026-10-07', to: today }, 'a stale interval is capped')
  assert.deepEqual(windowFor(parseNotifications(note('weight')), today), { from: '2026-10-12', to: today }, 'no interval: yesterday and today')
  assert.equal(windowFor(parseNotifications(note('heart-rate', '2026-10-13T10:00:00')), today), null, 'a heart-rate sample is not used')
  assert.equal(windowFor([], today), null)
})

test('each notification reads only its own kinds; sleep brings the overnight dailies', async () => {
  const { kindsFor } = await import('./webhook.ts')
  assert.deepEqual(kindsFor([{ dataType: 'steps', operation: 'UPSERT', days: [] }]), ['steps'])
  assert.ok(kindsFor([{ dataType: 'sleep', operation: 'UPSERT', days: [] }]).includes('restingHr'))
  assert.deepEqual(kindsFor([{ dataType: 'heart-rate', operation: 'UPSERT', days: [] }]), [])
})
