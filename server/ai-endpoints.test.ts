// The real handlers, end to end, against a stand-in for the ledger's REST API. Proves: the token gates everything, a ledger
// larger than one page is read whole, a warm refresh asks only for what is newer, the MCP server speaks the protocol, health
// can be redacted, and nothing here ever sends anything but a GET to the database.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'

const TOKEN = 'test-token-0123456789-abcdefghij'
process.env.AI_SNAPSHOT_TOKEN = TOKEN
process.env.SUPABASE_URL = 'http://ledger.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
process.env.HEALTH_TZ = 'Asia/Kolkata'

interface R { id: string; device: string; at: string; day: string; type: string; payload: Record<string, unknown>; inserted_at: string }

const rows: R[] = []
let n = 0
const add = (type: string, day: string, payload: Record<string, unknown>, at = `${day}T08:00:00.000Z`) => rows.push({ id: String(++n).padStart(6, '0'), device: 'd', at, day, type, payload, inserted_at: at })

const requests: { method: string; url: string }[] = []
const realFetch = globalThis.fetch

before(() => {
  add('config', '2026-10-01', { habits: JSON.stringify([{ id: 'code', name: 'Code', emoji: '💻', tier: 'pillar', spans: [{ from: '2026-10-01', to: null }] }]), deleted: '[]' }, '2026-10-01T00:00:00.000Z')
  // 2,300 filler rows so the read needs three pages, spread over October and early November
  for (let i = 0; i < 2300; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + (i % 36)))
    add('metric', d.toISOString().slice(0, 10), { key: 'filler', value: String(i) }, new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString())
  }
  add('tick', '2026-11-08', { habitId: 'code', at: '2026-11-08T05:00:00.000Z' }, '2026-11-08T05:00:00.000Z')
  add('vitals', '2026-11-08', { sleepScore: 90, sleepMin: 450, steps: 6000 }, '2026-11-08T05:30:00.000Z')

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    requests.push({ method: init?.method ?? 'GET', url: url.pathname + url.search })
    assert.equal(url.pathname, '/rest/v1/events', 'only the events table is read')
    const q = url.searchParams
    let out = rows.slice()
    const type = q.get('type')
    if (type === 'neq.config') out = out.filter((r) => r.type !== 'config')
    if (type === 'eq.config') out = out.filter((r) => r.type === 'config')
    const gte = q.get('inserted_at')?.replace(/^gte\./, '')
    if (gte) out = out.filter((r) => r.inserted_at >= gte)
    const order = q.get('order') ?? ''
    out.sort((a, b) => (a.inserted_at < b.inserted_at ? -1 : a.inserted_at > b.inserted_at ? 1 : a.id < b.id ? -1 : 1))
    if (order.startsWith('inserted_at.desc')) out.reverse()
    const offset = Number(q.get('offset') ?? 0)
    const limit = Math.min(1000, Number(q.get('limit') ?? 1000)) // PostgREST caps a page at 1000, silently
    const page = out.slice(offset, offset + limit)
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json', 'content-range': `${offset}-${offset + page.length - 1}/${out.length}` } })
  }) as typeof fetch
})

const ai = async () => (await import('./ai.ts')).GET
const mcp = async () => (await import('./mcp.ts')).POST
const get = (path: string, init: RequestInit = {}) => new Request(`https://app.test${path}`, init)
const rpc = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request(`https://app.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

test('a wrong or missing token gets a bare 404, and never reads the ledger', async () => {
  const GET = await ai()
  const before = requests.length
  assert.equal((await GET(get('/api/ai/not-the-token'))).status, 404)
  assert.equal((await GET(get('/api/ai'))).status, 404)
  assert.equal((await GET(get(`/api/ai?k=${TOKEN}x`))).status, 404)
  assert.equal(requests.length, before)
})

test('the right token, as a path, a query or a bearer header, reads the ledger and returns plain text', async () => {
  const GET = await ai()
  for (const req of [get(`/api/ai/${TOKEN}`), get(`/api/ai?k=${TOKEN}`), get('/api/ai', { headers: { authorization: `Bearer ${TOKEN}` } })]) {
    const res = await GET(req)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /^text\/plain/)
    assert.equal(res.headers.get('cache-control'), 'private, no-store')
    assert.match(res.headers.get('x-robots-tag') ?? '', /noindex/)
    const text = await res.text()
    assert.ok(text.includes('# Life OS snapshot') && text.includes('Code'))
    assert.ok(text.includes('band sleep score') || text.includes('| 90 |'), 'the band reading is in it')
  }
})

test('a ledger bigger than one page is read whole', async () => {
  const text = await (await (await ai())(get(`/api/ai/${TOKEN}?format=json`))).text()
  assert.equal(JSON.parse(text).freshness.events, rows.length, 'every row was folded, none lost to the 1,000-row cap')
})

test('the sections, days, json and redaction options work', async () => {
  const GET = await ai()
  const only = await (await GET(get(`/api/ai/${TOKEN}?sections=game`))).text()
  assert.ok(only.includes('## The game') && !only.includes('## Today'))
  const redacted = await (await GET(get(`/api/ai/${TOKEN}?redact=health`))).text()
  assert.ok(!redacted.includes('## Body') && !redacted.includes('sleep score') && !/\b90\b/.test(redacted.split('## The game')[0] ?? ''))
  const json = JSON.parse(await (await GET(get(`/api/ai/${TOKEN}?format=json&redact=health&days=5`))).text())
  assert.equal(json.body, undefined)
  assert.equal(json.freshness.latestBandDay, undefined)
  assert.equal(json.redactedHealth, true)
  assert.doesNotMatch(redacted, /latest band sleep reading|sleepScore|stepsToday/i)
  assert.match(redacted, /left out of this view on request/)
  assert.equal(json.window.days, 5)
})

test('a warm refresh asks only for rows newer than the cursor', async () => {
  const GET = await ai()
  await GET(get(`/api/ai/${TOKEN}`)) // warm (or served as fresh)
  add('tick', '2026-11-08', { habitId: 'new-habit', at: '2026-11-08T06:00:00.000Z' }, '2026-11-08T06:00:00.000Z')
  await new Promise((r) => setTimeout(r, 25))
  // age the cache past the freshness window
  const realNow = Date.now
  Date.now = () => realNow() + 60_000
  try {
    const mark = requests.length
    const json = JSON.parse(await (await GET(get(`/api/ai/${TOKEN}?format=json`))).text())
    const warm = requests.slice(mark)
    assert.ok(warm.length >= 1 && warm.length <= 3, `a warm read is a couple of small requests, not the history (${warm.length})`)
    assert.ok(warm.some((r) => r.url.includes('inserted_at=gte.')), 'it asks from the cursor')
    assert.equal(json.freshness.events, rows.length, 'and the new row is in')
  } finally {
    Date.now = realNow
  }
})

test('MCP: initialize, tools/list, a notification, and a tool call', async () => {
  const POST = await mcp()
  const path = `/api/mcp/${TOKEN}`
  const init = await (await POST(rpc(path, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }))).json()
  assert.equal(init.result.protocolVersion, '2025-06-18')
  assert.ok(init.result.capabilities.tools && init.result.serverInfo.name === 'life-os')
  const note = await POST(rpc(path, { jsonrpc: '2.0', method: 'notifications/initialized' }))
  assert.equal(note.status, 202)
  const list = await (await POST(rpc(path, { jsonrpc: '2.0', id: 2, method: 'tools/list' }))).json()
  const names = list.result.tools.map((t: { name: string }) => t.name)
  for (const t of ['get_snapshot', 'get_today', 'get_habits', 'get_game', 'get_health', 'get_arbor', 'get_woodshed', 'get_workouts', 'query_events', 'list_event_types']) assert.ok(names.includes(t), t)
  assert.ok(list.result.tools.every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint === true), 'every tool says it only reads')
  const today = await (await POST(rpc(path, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_today', arguments: {} } }))).json()
  assert.ok(today.result.content[0].text.includes('## Today') && !today.result.isError)
  const q = await (await POST(rpc(path, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'query_events', arguments: { type: 'vitals', limit: 5 } } }))).json()
  assert.equal(JSON.parse(q.result.content[0].text)[0].payload.sleepScore, 90)
  const types = await (await POST(rpc(path, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_event_types', arguments: {} } }))).json()
  assert.ok(JSON.parse(types.result.content[0].text).some((t: { type: string }) => t.type === 'tick'))
  const unknown = await (await POST(rpc(path, { jsonrpc: '2.0', id: 6, method: 'nope' }))).json()
  assert.equal(unknown.error.code, -32601)
})

test('MCP: the bearer header works at /api/mcp, a bad token is refused, and a redacted connector hides health', async () => {
  const POST = await mcp()
  const ok = await POST(rpc('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' }, { authorization: `Bearer ${TOKEN}` }))
  assert.equal(ok.status, 200)
  assert.equal((await POST(rpc('/api/mcp/wrong-token', { jsonrpc: '2.0', id: 1, method: 'ping' }))).status, 404)
  const redacted = `/api/mcp/${TOKEN}?redact=health`
  const list = await (await POST(rpc(redacted, { jsonrpc: '2.0', id: 2, method: 'tools/list' }))).json()
  assert.ok(!list.result.tools.some((t: { name: string }) => t.name === 'get_health'))
  const blocked = await (await POST(rpc(redacted, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'query_events', arguments: { type: 'vitals' } } }))).json()
  assert.equal(blocked.result.isError, true)
  const batch = await (await POST(rpc(`/api/mcp/${TOKEN}`, [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]))).json()
  assert.equal(batch.length, 2)
})

test('nothing in any of that wrote to the database', () => {
  assert.ok(requests.length > 5)
  assert.deepEqual([...new Set(requests.map((r) => r.method))], ['GET'])
})

test('with no token configured the feature is shut, not open', async () => {
  const { authorize } = await import('./ai-http.ts')
  assert.equal(authorize(get('/api/ai/anything'), ''), 'off')
  assert.equal(authorize(get('/api/ai/short'), 'short'), 'off', 'a token under 24 characters is as good as none')
  assert.equal(authorize(get(`/api/ai/${TOKEN}`), TOKEN), 'ok')
})

test.after(() => {
  globalThis.fetch = realFetch
})
