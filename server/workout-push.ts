// POST /api/workout-push: send Strong's finished workouts to Google Health.
// Strong pings it when a workout is finished; a daily run (vercel.json crons) is the safety net for a ping that never arrived.
// It reads the recent `workout` events from the ledger, and for each one not yet sent writes a `health_push` row (the claim,
// made first so two runs at once cannot both send it) and then creates a strength-training session in Google Health.
// A failed send removes the claim so the next run tries again.
//
// Needs the Google sign-in to include the write scope (ghealth auth login with activity_and_fitness as well as the read-only
// ones); GOOGLE_REFRESH_TOKEN is the same one the health sync uses. Settings are in server/health-shared.ts.
// A redeploy of an unchanged commit is skipped by vercel.json's ignoreCommand, so after changing that variable push a real
// change to server/ (or bridge/) to make Vercel build again.
import { PUSH_DAYS, PUSH_DEVICE, PUSH_TYPE, claimId, exerciseBody, pendingWorkouts } from '../bridge/exercise.ts'
import { addDays, HEALTH_BASE } from '../bridge/health.ts'
import type { LedgerEvent } from '../bridge/model.ts'
import { accessToken, cfg, sb, today } from './health-shared.ts'

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const json = (status: number, body: object): Response => new Response(JSON.stringify(body), { status, headers: HEADERS })

let running: Promise<Result> | null = null // a ping and the daily run arriving together share one pass

interface Result { sent: string[]; failed: { workout: string; why: string }[] }

async function recentEvents(since: string): Promise<LedgerEvent[]> {
  const out: LedgerEvent[] = []
  for (let offset = 0; ; offset += 1000) {
    const res = await sb(`events?select=device,at,day,type,payload&type=in.(workout,workout_delete,${PUSH_TYPE})&day=gte.${since}&order=at.asc&offset=${offset}&limit=1000`)
    if (!res.ok) throw new Error(`ledger read ${res.status}`)
    const page = (await res.json()) as LedgerEvent[]
    out.push(...page)
    if (page.length < 1000) return out
  }
}

/** True when this run now owns the workout: the row went in, rather than being skipped because the id was already there. */
async function claim(workout: string, day: string): Promise<boolean> {
  const row = { id: claimId(workout), device: PUSH_DEVICE, at: new Date().toISOString(), day, type: PUSH_TYPE, payload: { workout, to: 'google-health' } }
  const res = await sb('events?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(row) })
  if (!res.ok) throw new Error(`ledger write ${res.status}`)
  return ((await res.json()) as unknown[]).length > 0
}

const release = (workout: string) => sb(`events?id=eq.${claimId(workout)}`, { method: 'DELETE' }).catch(() => {})

async function pass(): Promise<Result> {
  const events = await recentEvents(addDays(today(), -(PUSH_DAYS + 1)))
  const todo = pendingWorkouts(events, Date.now())
  const result: Result = { sent: [], failed: [] }
  if (!todo.length) return result
  const token = await accessToken()
  for (const p of todo) {
    const id = p.workout.id
    if (!(await claim(id, p.day))) continue
    try {
      const res = await fetch(`${HEALTH_BASE}/users/me/dataTypes/exercise/dataPoints`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(exerciseBody(p, cfg.tz)),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).slice(0, 300)
        throw new Error(`Google refused it (${res.status})${res.status === 403 ? ': the sign-in probably lacks the write scope, see server/workout-push.ts' : ''} ${text}`)
      }
      result.sent.push(id)
    } catch (err) {
      await release(id)
      result.failed.push({ workout: id, why: err instanceof Error ? err.message : String(err) })
    }
  }
  return result
}

async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS })
  if (!cfg.refresh || !cfg.clientId) return json(503, { error: 'Google sign-in is not configured here' })
  try {
    running ??= pass().finally(() => { running = null })
    const r = await running
    console.log(`workout-push: sent ${r.sent.length}, failed ${r.failed.length}`)
    for (const f of r.failed) console.log(`workout-push failed ${f.workout}: ${f.why}`)
    return json(200, r)
  } catch (err) {
    console.log(`workout-push failed: ${err instanceof Error ? err.message : String(err)}`)
    return json(500, { error: 'could not run' })
  }
}

export const POST = handle
export const GET = handle
export const OPTIONS = handle
