// Reads the last few days from Google Health (through the `ghealth` CLI) and
// writes what is new to the shared ledger as `vitals` events: the readings, and
// the sleep score and recovery worked out from them (see plan.ts). The Pokedex
// and Life OS read the ledger, never Google.
//
//   npm run health                  last 3 days, written to the ledger
//   npm run health -- --days 14     a longer catch-up
//   npm run health -- --dry-run     print what would be written, write nothing
//
// The webhook and /api/health-check do the same from Vercel (server/); this is
// the by-hand catch-up from the PC (bridge/README.md).
//
// Needs `ghealth` on PATH (or GHEALTH_BIN), already set up (`ghealth setup`), and
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local (not for --dry-run).
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { queries } from './map.ts'
import { LOOK_BACK, WRITE_PATH, WRITE_PREFER, planWrites } from './plan.ts'
import { addDays } from './model.ts'

const run = promisify(execFile)
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)

const DRY = flag('dry-run')
const DAYS = Math.max(1, Math.min(90, Number(opt('days', 3)) || 3))
const BIN = process.env.GHEALTH_BIN || 'ghealth'
const ROOT = path.resolve(import.meta.dirname, '..')

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const from = addDays(today, -(DAYS - 1))

function env() {
  const out = { ...process.env }
  // this app's own file first, then the one shared by the whole workspace
  for (const file of [path.join(ROOT, '.env.local'), path.join(ROOT, '..', '.env.local')])
    if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  return out
}

async function ask(name, argv) {
  try {
    const { stdout } = await run(BIN, argv, { maxBuffer: 64 * 1024 * 1024 })
    return JSON.parse(stdout)
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`'${BIN}' was not found. Build the Google Health CLI and put it on PATH, or set GHEALTH_BIN.`)
      process.exit(1)
    }
    // one type failing (a scope not granted, a sensor the band lacks) must not sink the rest
    const why = String(err.stderr || err.message).split('\n').find(Boolean) ?? 'failed'
    console.error(`  ${name}: skipped (${why.slice(0, 160)})`)
    return { dataPoints: [] }
  }
}

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: key } = env()
const url = VITE_SUPABASE_URL?.replace(/\/$/, '')
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

// A ledger that does not answer must not hang the daily task or crash it with a stack trace.
const PAGE = 1000
const TIMEOUT_MS = 30_000
const call = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })

// the nights already in the ledger, for the scores that compare a night with the ones before it (read in pages, so a long history is never cut short)
let known = []
if (url && key) {
  try {
    for (let offset = 0; ; offset += PAGE) {
      const r = await call(`events?select=device,at,day,type,payload&type=eq.vitals&day=gte.${addDays(from, -LOOK_BACK)}&order=at.asc&offset=${offset}&limit=${PAGE}`, { headers })
      if (!r.ok) throw new Error(`ledger read ${r.status}`)
      const page = await r.json()
      known.push(...page)
      if (page.length < PAGE) break
    }
  } catch (err) {
    // scores would be worked out from this run's days alone, and a day could be written twice: better to stop than to guess
    console.error(`could not read the ledger (${err.message}); nothing written.`)
    process.exit(1)
  }
} else if (!DRY) {
  console.error('No ledger configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local). Nothing written.')
  process.exit(1)
}

// the twelve CLI calls are independent: run them together, not one after another
const read = Object.fromEntries(await Promise.all(Object.entries(queries(from, today)).map(async ([name, argv]) => [name, await ask(name, argv)])))
const events = planWrites(read, known, new Date().toISOString())

if (events.length === 0) {
  console.log('Nothing new for these days (band not worn, not synced yet, or already in the ledger).')
  process.exit(0)
}
for (const e of events) console.log(e.day, JSON.stringify(e.payload))

if (DRY) {
  console.log(`dry run: ${events.length} day(s), nothing written`)
  process.exit(0)
}

let r
try {
  r = await call(WRITE_PATH, { method: 'POST', headers: { ...headers, Prefer: WRITE_PREFER }, body: JSON.stringify(events) })
} catch (err) {
  console.error(`could not reach the ledger (${err.message}). Nothing was confirmed written; run it again (days already in the ledger are skipped).`)
  process.exit(1)
}
if (!r.ok) {
  console.error(`ledger refused the write: ${r.status}`)
  process.exit(1)
}
console.log(`wrote ${events.length} day(s) to the ledger`)
