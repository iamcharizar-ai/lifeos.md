// POST /api/mcp/<token>: a read-only MCP server (Streamable HTTP, stateless, plain JSON replies) over the same snapshot as
// /api/ai. Add it as a custom connector in Claude, ChatGPT (developer mode) or any MCP client, and the AI can ask for exactly
// the part it needs instead of reading everything. The token is the last path segment, or an `Authorization: Bearer` header.
// `?redact=health` on the connector URL leaves out the band's readings, weight and Sleep.
//
// Every tool only reads. There is no tool that writes to the ledger, and the server never holds a way to.
import { NO_STORE, authorize, refuse, snapshot } from './ai-http.ts'
import { ledgerRows } from './ai-data.ts'
import { MAX_DAYS, SECTIONS, isSection, renderMarkdown, type Section } from './ai-snapshot.ts'

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const INFO = { name: 'life-os', title: 'Life OS (read-only)', version: '1.0.0' }
const INSTRUCTIONS =
  "A personal life-tracking system: daily habits, Strong (gym), Arbor (calisthenics skills), Woodshed (guitar), the Pokedex game that mirrors the work, and the Google Health band (sleep, steps, weight). Start with get_snapshot for the whole picture, then use the narrower tools. Everything is read-only and dates are the owner's local dates."

const days = { type: 'integer', minimum: 1, maximum: MAX_DAYS, description: 'How many days of history (default 14).' }
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
})

const TOOLS = [
  tool('get_snapshot', 'The whole system in one Markdown page: today, day-by-day habits, months, the game, body, Arbor, Woodshed and workouts. Best first call.', { days, sections: { type: 'array', items: { type: 'string', enum: [...SECTIONS] }, description: 'Only these sections.' } }),
  tool('get_today', "Today's checklist (what is ticked, what is left), the Sunday reset list on Sundays, and the day's Arbor and Woodshed plans."),
  tool('get_habits', 'Day by day: how many habits were done and which were missed, plus each habit\'s completion rate and streak over the window.', { days }),
  tool('get_months', 'Completion by month: sealed months, the earlier tracker (Jan to May 2026) and the running month, with per-habit rates for the last sealed month.'),
  tool('get_game', 'The Pokedex game: partner and level, momentum, wallet, gym league and leader, the wild Pokemon, the weekly boss and its tasks, team, quests, egg.'),
  tool('get_health', "The band's nightly readings (sleep score, hours, bed and wake times, deep/REM, steps, heart rate and HRV where measured) and hand-entered numbers such as weight.", { days }),
  tool('get_arbor', "Calisthenics: today's skills with targets, skills by rank, those in progress, mastered ones and recently changed bests.", { days }),
  tool('get_woodshed', "Guitar: today's session, items being learned and owned, and what was practised recently and how it felt.", { days }),
  tool('get_workouts', 'Gym sessions from Strong: duration, sets, volume, muscles and every exercise with its sets.', { days }),
  tool('list_event_types', 'The raw ledger: each event type with how many rows it has and the first and last day it covers.'),
  tool(
    'query_events',
    'Raw ledger rows for questions the other tools cannot answer. Returns the newest rows last.',
    {
      type: { type: 'string', description: 'Event type, for example tick, vitals, workout, skill, guitar, day_list, boss_day. See list_event_types.' },
      from: { type: 'string', description: 'First day, YYYY-MM-DD.' },
      to: { type: 'string', description: 'Last day, YYYY-MM-DD.' },
      limit: { type: 'integer', minimum: 1, maximum: 200, description: 'At most this many rows (default 50).' },
    },
    ['type'],
  ),
]

type Args = Record<string, unknown>
const SECTION_OF: Record<string, Section[]> = {
  get_today: ['today'],
  get_habits: ['habits'],
  get_months: ['months'],
  get_game: ['game'],
  get_health: ['body'],
  get_arbor: ['arbor'],
  get_woodshed: ['woodshed'],
  get_workouts: ['workouts'],
}
const int = (v: unknown, d: number, max: number): number => Math.max(1, Math.min(max, Math.floor(Number(v)) || d))
const day = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
const ok = (text: string) => ({ content: [{ type: 'text', text }] })
const fail = (text: string) => ({ content: [{ type: 'text', text }], isError: true })

async function call(name: string, a: Args, redactHealth: boolean) {
  if (name === 'list_event_types') {
    const by = new Map<string, { n: number; first: string; last: string }>()
    for (const r of await ledgerRows()) {
      const e = by.get(r.type) ?? { n: 0, first: r.day, last: r.day }
      e.n++
      if (r.day < e.first) e.first = r.day
      if (r.day > e.last) e.last = r.day
      by.set(r.type, e)
    }
    return ok(JSON.stringify([...by].sort((x, y) => y[1].n - x[1].n).map(([type, e]) => ({ type, rows: e.n, firstDay: e.first, lastDay: e.last })), null, 2))
  }
  if (name === 'query_events') {
    const type = typeof a.type === 'string' ? a.type : ''
    if (!type) return fail('type is required')
    // health rows stay out of a redacted connector, whatever they are called
    if (redactHealth && /^(vitals|health|metric)$/.test(type)) return fail('That event type is hidden on this connector (redact=health).')
    const from = day(a.from)
    const to = day(a.to)
    const rows = (await ledgerRows())
      .filter((r) => r.type === type && (!from || r.day >= from) && (!to || r.day <= to))
      .sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))
      .slice(-int(a.limit, 50, 200))
      .map((r) => {
        const size = JSON.stringify(r.payload ?? {}).length
        return { day: r.day, at: r.at, type: r.type, payload: size > 3000 ? { _truncated: true, bytes: size } : r.payload }
      })
    return ok(JSON.stringify(rows, null, 2))
  }
  const snap = await snapshot({ days: int(a.days, 14, MAX_DAYS), redactHealth })
  if (name === 'get_snapshot') {
    const wanted = Array.isArray(a.sections) ? a.sections.map(String).filter(isSection) : []
    return ok(renderMarkdown(snap, (wanted.length ? wanted : [...SECTIONS]).filter((s) => !(redactHealth && s === 'body'))))
  }
  const sections = SECTION_OF[name]
  if (!sections) return fail(`Unknown tool: ${name}`)
  if (redactHealth && sections[0] === 'body') return fail('Health data is hidden on this connector (redact=health).')
  // today also carries today's two plans, which live in their own sections
  return ok(renderMarkdown(snap, name === 'get_today' ? ['today', 'arbor', 'woodshed'] : sections))
}

interface Rpc { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

async function handle(msg: Rpc, redactHealth: boolean): Promise<unknown | null> {
  const id = msg.id ?? null
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (msg.id === undefined || msg.id === null) return null // a notification: no answer
  switch (msg.method) {
    case 'initialize': {
      const want = String(msg.params?.protocolVersion ?? '')
      return reply({ protocolVersion: VERSIONS.includes(want) ? want : VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: INFO, instructions: INSTRUCTIONS })
    }
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: redactHealth ? TOOLS.filter((t) => t.name !== 'get_health') : TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      try {
        return reply(await call(name, (msg.params?.arguments as Args | undefined) ?? {}, redactHealth))
      } catch (err) {
        console.log(`mcp ${name} failed: ${err instanceof Error ? err.message : String(err)}`)
        return reply(fail('The ledger could not be read just now. Try again in a minute.'))
      }
    }
    default:
      return error(-32601, `Method not found: ${msg.method}`)
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, X-Api-Key',
}
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { ...NO_STORE, ...CORS, 'Content-Type': 'application/json' } })

export async function POST(req: Request): Promise<Response> {
  const auth = authorize(req)
  if (auth !== 'ok') return new Response(refuse(auth).body, { status: auth === 'off' ? 503 : 404, headers: { ...NO_STORE, ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } })
  const redactHealth = (new URL(req.url).searchParams.get('redact') ?? '').split(',').map((s) => s.trim()).includes('health')
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400)
  }
  const batch = Array.isArray(body)
  const answers = (await Promise.all((batch ? (body as Rpc[]) : [body as Rpc]).map((m) => handle(m ?? {}, redactHealth)))).filter((x) => x !== null)
  if (!answers.length) return new Response(null, { status: 202, headers: { ...NO_STORE, ...CORS } })
  return json(batch ? answers : answers[0])
}

// This server never opens a stream and keeps no session, so a GET or DELETE has nothing to do.
const notAllowed = (): Response => new Response('Method not allowed\n', { status: 405, headers: { ...NO_STORE, ...CORS, Allow: 'POST, OPTIONS' } })
export const GET = notAllowed
export const DELETE = notAllowed
export const OPTIONS = (): Response => new Response(null, { status: 204, headers: CORS })
