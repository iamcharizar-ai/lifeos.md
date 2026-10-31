import test from 'node:test'
import assert from 'node:assert/strict'
import { createSign, generateKeyPairSync } from 'node:crypto'
import { receive, type Deps } from './receiver.ts'

const SECRET = 'Bearer test-secret'
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string }
const pad = (b64: string) => Buffer.concat([Buffer.from([0]), Buffer.from(b64, 'base64url')])
const proto = Buffer.concat([Buffer.from([0x12, 0x06, 0x08, 0x03, 0x10, 0x02, 0x18, 0x02, 0x1a, 0x21]), pad(jwk.x), Buffer.from([0x22, 0x21]), pad(jwk.y)])
const KEYSET = { key: [{ keyData: { value: proto.toString('base64') }, keyId: 7, status: 'ENABLED', outputPrefixType: 'TINK' }] }
const sign = (body: string) => {
  const p = Buffer.alloc(5)
  p[0] = 1
  p.writeUInt32BE(7, 1)
  return Buffer.concat([p, createSign('sha256').update(body).sign({ key: privateKey, dsaEncoding: 'der' })]).toString('base64')
}

function setup(over: Partial<Deps> = {}) {
  const synced: { from: string; to: string; kinds?: string[] }[] = []
  const pending: Promise<unknown>[] = []
  const lines: string[] = []
  const deps: Deps = {
    secret: SECRET, keyset: async () => KEYSET, today: () => '2026-10-13', log: (l) => lines.push(l),
    sync: async (w) => { synced.push(w) }, after: (p) => { pending.push(p) }, ...over,
  }
  const post = async (body: unknown, headers: Record<string, string> = {}, raw = typeof body === 'string' ? body : JSON.stringify(body)) => {
    const res = await receive(new Request('https://x.test/api/health-webhook', { method: 'POST', body: raw, headers }), deps)
    await Promise.all(pending)
    return res
  }
  return { post, synced, lines, deps }
}
const steps = { data: { dataType: 'steps', operation: 'UPSERT', intervals: [{ civilIso8601TimeInterval: { startTime: '2026-10-13T10:00:00', endTime: '2026-10-13T10:05:00' } }] } }

test('setup: the secret gets a 200, no secret gets a 401', async () => {
  const { post, synced } = setup()
  assert.equal((await post({ type: 'verification' }, { authorization: SECRET })).status, 200)
  assert.equal((await post({ type: 'verification' })).status, 401)
  assert.equal((await post({ type: 'verification' }, { authorization: 'Bearer wrong' })).status, 401)
  assert.equal(synced.length, 0)
})

test('a signed notification with the secret is answered 204 and only the days and kinds it touched are read', async () => {
  const { post, synced } = setup()
  const raw = JSON.stringify(steps)
  const res = await post(raw, { authorization: SECRET, 'google-health-api-signature': sign(raw) })
  assert.equal(res.status, 204)
  assert.deepEqual(synced, [{ from: '2026-10-13', to: '2026-10-13', kinds: ['steps'] }])
})

test('an array of notifications is one sync; ones the game does not use sync nothing', async () => {
  const { post, synced } = setup()
  const arr = JSON.stringify([steps, { data: { dataType: 'heart-rate', operation: 'UPSERT' } }])
  assert.equal((await post(arr, { authorization: SECRET, 'google-health-api-signature': sign(arr) })).status, 204)
  assert.equal(synced.length, 1)
  const hr = JSON.stringify({ data: { dataType: 'heart-rate', operation: 'UPSERT' } })
  assert.equal((await post(hr, { authorization: SECRET, 'google-health-api-signature': sign(hr) })).status, 204)
  assert.equal(synced.length, 1)
})

test('nothing is read without the secret, or with a bad or missing signature', async () => {
  const { post, synced } = setup()
  const raw = JSON.stringify(steps)
  assert.equal((await post(raw, { 'google-health-api-signature': sign(raw) })).status, 401, 'no secret')
  assert.equal((await post(raw, { authorization: SECRET })).status, 401, 'no signature')
  assert.equal((await post(raw, { authorization: SECRET, 'google-health-api-signature': sign(raw + ' ') })).status, 401, 'signature of another body')
  assert.equal(synced.length, 0)
})

test('with no secret configured it refuses everything; other methods are not allowed; broken JSON is a 400 or 401', async () => {
  assert.equal((await setup({ secret: '' }).post({ type: 'verification' })).status, 503)
  const { deps, post } = setup()
  assert.equal((await receive(new Request('https://x.test/', { method: 'GET' }), deps)).status, 405)
  assert.equal((await post('{nope', { authorization: SECRET })).status, 400)
  assert.equal((await post('{nope')).status, 401)
})

test('a sync that fails is logged, not thrown: Google was already answered', async () => {
  const { post, lines } = setup({ sync: async () => { throw new Error('ledger read 500') } })
  const raw = JSON.stringify(steps)
  assert.equal((await post(raw, { authorization: SECRET, 'google-health-api-signature': sign(raw) })).status, 204)
  assert.ok(lines.some((l) => l.includes('ledger read 500')))
})
