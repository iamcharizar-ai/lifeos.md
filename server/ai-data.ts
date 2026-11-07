// Reads the ledger for the AI endpoints. Read-only: every call here is a GET. The rows stay in memory for as long as the
// function instance is warm, and a refresh asks only for what is newer (the same cursor-with-overlap the apps use), so a
// pasted link costs one small read, not the whole history, once it is warm.
import { sb } from './health-shared.ts'
import type { Row } from './ai-snapshot.ts'

const PAGE = 1000
const COLS = 'id,device,at,day,type,payload,inserted_at'
/** A row can take an earlier inserted_at than a neighbour yet commit later, so each refresh re-reads this much before the cursor. */
const OVERLAP_MS = 60_000
/** Rows younger than this are served as they are: two pastes in a row do not read the ledger twice. */
const FRESH_MS = 20_000
const PARALLEL = 6

interface Cache {
  /** every row except `config`, by id */
  rows: Map<string, Row>
  /** the newest few `config` rows (each is a whole copy of the habit library, so only the last matters) */
  configs: Row[]
  cursor: string
  at: number
}

let cache: Cache | null = null
let inflight: Promise<Row[]> | null = null

async function page(query: string, offset: number, count = false): Promise<{ rows: Row[]; total: number | null }> {
  const res = await sb(`events?select=${COLS}&${query}&offset=${offset}&limit=${PAGE}`, count ? { headers: { Prefer: 'count=exact' } } : {})
  if (!res.ok) throw new Error(`ledger read ${res.status}`)
  const rows = (await res.json()) as Row[]
  const total = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1])
  return { rows, total: Number.isFinite(total) ? total : null }
}

/** Every row matching `query`, oldest insert first. The first page says how many there are; the rest are read side by side. */
async function all(query: string): Promise<Row[]> {
  const first = await page(query, 0, true)
  if (first.rows.length < PAGE) return first.rows
  const total = first.total ?? Number.MAX_SAFE_INTEGER
  const offsets: number[] = []
  for (let o = PAGE; o < total; o += PAGE) offsets.push(o)
  const out: Row[][] = [first.rows]
  // a total we could not read: walk until a short page
  if (first.total === null) {
    for (let o = PAGE; ; o += PAGE) {
      const p = await page(query, o)
      out.push(p.rows)
      if (p.rows.length < PAGE) break
    }
    return out.flat()
  }
  for (let i = 0; i < offsets.length; i += PARALLEL) out.push(...(await Promise.all(offsets.slice(i, i + PARALLEL).map(async (o) => (await page(query, o)).rows))))
  return out.flat()
}

const newestConfigs = async (): Promise<Row[]> => (await page('type=eq.config&order=inserted_at.desc,id.desc', 0)).rows.slice(0, 3)

async function load(): Promise<Row[]> {
  if (!cache) {
    const [rows, configs] = await Promise.all([all('type=neq.config&order=inserted_at.asc,id.asc'), newestConfigs()])
    cache = { rows: new Map(rows.map((r) => [r.id ?? `${r.device}|${r.at}|${r.type}`, r])), configs, cursor: '', at: Date.now() }
  } else {
    const since = cache.cursor ? new Date(Date.parse(cache.cursor) - OVERLAP_MS).toISOString() : ''
    const [fresh, configs] = await Promise.all([all(`type=neq.config${since ? `&inserted_at=gte.${encodeURIComponent(since)}` : ''}&order=inserted_at.asc,id.asc`), newestConfigs()])
    for (const r of fresh) cache.rows.set(r.id ?? `${r.device}|${r.at}|${r.type}`, r)
    cache.configs = configs
    cache.at = Date.now()
  }
  cache.cursor = [...cache.rows.values()].reduce((m, r) => ((r.inserted_at ?? '') > m ? (r.inserted_at as string) : m), cache.cursor)
  return [...cache.rows.values(), ...cache.configs]
}

/** The ledger as rows: every event except old `config` copies, plus the newest few of those. */
export function ledgerRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve([...cache.rows.values(), ...cache.configs])
  inflight ??= load().finally(() => {
    inflight = null
  })
  return inflight
}
