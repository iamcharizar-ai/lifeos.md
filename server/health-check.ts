// GET /api/health-check: is last night in yet? Life OS asks while Today waits
// for the band (bridge/check.ts decides the answer). It reads Google itself at
// most once a minute, so a night never depends on the webhook alone.
import { addDays } from '../bridge/health.ts'
import { check, type CheckMemo } from '../bridge/check.ts'
import { warningFor } from '../bridge/watch.ts'
import { readStatus, sb, sync, today } from './health-shared.ts'

let memo: CheckMemo | null = null

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }

async function scoreIn(day: string): Promise<number | null> {
  const res = await sb(`events?select=payload&type=eq.vitals&day=eq.${day}&order=at.desc&limit=100`)
  if (!res.ok) throw new Error(`ledger read ${res.status}`)
  const rows = (await res.json()) as { payload?: { sleepScore?: unknown } }[]
  const hit = rows.find((r) => typeof r.payload?.sleepScore === 'number')
  return hit ? (hit.payload!.sleepScore as number) : null
}

export async function GET(): Promise<Response> {
  const day = today()
  try {
    const r = await check({ day, scoreIn: () => scoreIn(day), sync: () => sync({ from: addDays(day, -1), to: day }), now: () => Date.now() }, memo)
    memo = r.memo
    // while the night is still missing, say if the pipe itself is the reason
    const warning = r.answer.state === 'measured' ? undefined : warningFor(await readStatus(), Date.now())
    return new Response(JSON.stringify(warning ? { ...r.answer, warning } : r.answer), { status: 200, headers: HEADERS })
  } catch (err) {
    console.log(`check failed: ${err instanceof Error ? err.message : String(err)}`)
    return new Response(JSON.stringify({ day, state: 'error', message: 'The ledger could not be read.' }), { status: 200, headers: HEADERS })
  }
}

export const OPTIONS = (): Response => new Response(null, { status: 204, headers: HEADERS })
