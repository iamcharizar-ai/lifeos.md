// Client for the shared append-only event ledger (Supabase table `events`,
// the same one Life OS writes). Plain fetch against PostgREST — no SDK.
//
// Local-first: callers apply their own events immediately and persist their
// own state; this module only moves events. Inserts that fail wait in an
// outbox. Reads are paged (PostgREST caps a request at 1000 rows) and then
// kept fresh by a cursor on the server's insert time.
import type { LedgerEvent } from './model.ts'

export type LedgerStatus = 'off' | 'connecting' | 'live' | 'error'

export interface LedgerOptions {
  /** e.g. import.meta.env.VITE_SUPABASE_URL — leave empty to run local-only */
  url?: string
  key?: string
  /** short app name: namespaces the device id + outbox in localStorage */
  app: string
  /** only these event types are fetched */
  types: string[]
  onEvents: (events: LedgerEvent[], boot: boolean) => void
  onStatus?: (s: LedgerStatus, pending: number) => void
}

export interface Ledger {
  readonly device: string
  /**
   * Build an event, queue it for the ledger, and return it so the caller can apply it locally.
   * `at` defaults to now; pass an older one for values that must lose last-write-wins to any real event.
   */
  emit: (type: string, payload: LedgerEvent['payload'], day?: string, at?: string) => LedgerEvent
  start: () => void
  stop: () => void
}

const PAGE = 1000
const COLS = 'device,at,day,type,payload,inserted_at'
const POLL_MS = 30_000
const REQUEST_MS = 15_000 // a stalled request must reject so the outbox/retry path runs
// A row can take an earlier inserted_at than a neighbour yet commit later, so each pull re-reads
// this much of the tail. The fold is idempotent; `seen` keeps the repeats from reaching callers.
const OVERLAP_MS = 10_000
// Statuses that mean "this event will never be accepted" (bad payload, conflict, too large).
// 401/403/5xx/429 are about the connection or its permissions, not the event, so those just retry.
const PERMANENT = new Set([400, 409, 413, 422])

/** An event's identity: every field the server would store. */
const eventKey = (e: LedgerEvent) => JSON.stringify([e.device, e.at, e.day, e.type, e.payload])

// `id` is the events table's primary key. Making it client-side means a retry after a lost
// response carries the same id, and the server (`on_conflict=id`, ignore-duplicates) keeps one row.
type Outgoing = LedgerEvent & { id?: string }
const newId = (): string | undefined => globalThis.crypto?.randomUUID?.()

const today = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function createLedger(o: LedgerOptions): Ledger {
  const enabled = Boolean(o.url && o.key)
  const DEVICE_KEY = `${o.app}.device.v1`, OUTBOX_KEY = `${o.app}.outbox.v1`, DEAD_KEY = `${o.app}.outbox.dead.v1`
  let device = localStorage.getItem(DEVICE_KEY)
  if (!device) {
    device = `${o.app}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_KEY, device)
  }

  const headers = { apikey: o.key ?? '', Authorization: `Bearer ${o.key ?? ''}`, 'Content-Type': 'application/json' }
  const base = `${(o.url ?? '').replace(/\/$/, '')}/rest/v1/events`
  let status: LedgerStatus = enabled ? 'connecting' : 'off'
  let cursor = ''
  const seen = new Map<string, string>() // eventKey → inserted_at, for rows inside the overlap window
  let booted = false
  let busy = false
  let again = false // something was emitted mid-sync: go round once more
  let timer: ReturnType<typeof setInterval> | undefined

  const outbox = (): LedgerEvent[] => {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as LedgerEvent[] } catch { return [] }
  }
  const saveOutbox = (b: LedgerEvent[]) => localStorage.setItem(OUTBOX_KEY, JSON.stringify(b))
  const report = (s: LedgerStatus) => { status = s; o.onStatus?.(s, outbox().length) }

  const deadLetters = (): LedgerEvent[] => {
    try { return JSON.parse(localStorage.getItem(DEAD_KEY) ?? '[]') as LedgerEvent[] } catch { return [] }
  }

  const post = (events: LedgerEvent[]) =>
    fetch(`${base}?on_conflict=id`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(events), signal: AbortSignal.timeout(REQUEST_MS) })

  /** Events queued before ids existed get one now, and keep it across retries. */
  function withIds(box: LedgerEvent[]): LedgerEvent[] {
    if (box.every((e) => (e as Outgoing).id) || !newId()) return box
    const out = box.map((e) => ((e as Outgoing).id ? e : { ...e, id: newId() }))
    saveOutbox(out)
    return out
  }

  async function flush(): Promise<void> {
    if (!enabled) return
    const box = withIds(outbox())
    if (box.length === 0) return
    const sent = new Set<string>()
    const dead: LedgerEvent[] = []
    try {
      const res = await post(box)
      if (res.ok) { for (const e of box) sent.add(eventKey(e)); return }
      if (!PERMANENT.has(res.status)) throw new Error(`ledger insert ${res.status}`)
      // The server rejects a whole batch for one bad row: go one by one so only the offender is
      // set aside (kept in DEAD_KEY, not retried) and the rest still go through.
      for (const e of box) {
        const r = await post([e])
        if (r.ok) sent.add(eventKey(e))
        else if (PERMANENT.has(r.status)) { sent.add(eventKey(e)); dead.push(e) }
        else throw new Error(`ledger insert ${r.status}`)
      }
    } finally {
      // Drop only what was actually sent, by identity: anything emitted while the request was in
      // flight (here or in another tab sharing this outbox) stays queued.
      if (sent.size) saveOutbox(outbox().filter((e) => !sent.has(eventKey(e))))
      if (dead.length) localStorage.setItem(DEAD_KEY, JSON.stringify([...deadLetters(), ...dead]))
    }
  }

  async function fetchPage(since: string, offset: number): Promise<LedgerEvent[]> {
    const q = new URLSearchParams({ select: COLS, type: `in.(${o.types.join(',')})`, order: since ? 'inserted_at.asc,id.asc' : 'at.asc,id.asc', offset: String(offset), limit: String(PAGE) })
    if (since) q.set('inserted_at', `gt.${since}`)
    const res = await fetch(`${base}?${q}`, { headers, signal: AbortSignal.timeout(REQUEST_MS) })
    if (!res.ok) throw new Error(`ledger read ${res.status}`)
    return (await res.json()) as LedgerEvent[]
  }

  async function pull(boot: boolean): Promise<void> {
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : ''
    const fetched: LedgerEvent[] = []
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(boot ? '' : since, offset)
      fetched.push(...page)
      if (page.length < PAGE) break
    }
    for (const e of fetched) if (e.inserted_at && e.inserted_at > cursor) cursor = e.inserted_at
    // what the overlap re-read has already been delivered stays out of the batch
    const all = fetched.filter((e) => {
      const k = eventKey(e)
      if (seen.has(k)) return false
      seen.set(k, e.inserted_at ?? '')
      return true
    })
    const floor = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : ''
    for (const [k, at] of seen) if (at < floor) seen.delete(k)
    if (all.length || boot) o.onEvents(boot ? all : all.sort((a, b) => (a.at < b.at ? -1 : 1)), boot)
  }

  async function sync(): Promise<void> {
    if (!enabled) return
    if (busy) { again = true; return }
    busy = true
    try {
      // A failed flush must not stop us reading other devices' events: the outbox keeps the
      // unsent ones and the pending count (via report) tells the caller they are still waiting.
      try { await flush() } catch { /* retried next sync */ }
      await pull(!booted)
      booted = true
      report('live')
    } catch {
      report(booted ? 'live' : 'error') // offline after boot is normal — the outbox holds
    } finally {
      busy = false
      if (again) { again = false; void sync() }
    }
  }

  const onWake = () => { if (document.visibilityState === 'visible') void sync() }

  return {
    device,
    emit(type, payload, day = today(), at = new Date().toISOString()) {
      const id = newId()
      const ev: Outgoing = { ...(id ? { id } : {}), device: device as string, at, day, type, payload }
      if (enabled) {
        saveOutbox([...outbox(), ev])
        o.onStatus?.(status, outbox().length)
        void sync()
      }
      return ev
    },
    start() {
      if (!enabled) { report('off'); return }
      report('connecting')
      void sync()
      window.addEventListener('online', onWake)
      window.addEventListener('focus', onWake)
      document.addEventListener('visibilitychange', onWake)
      timer = setInterval(onWake, POLL_MS)
    },
    stop() {
      window.removeEventListener('online', onWake)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
      clearInterval(timer)
    },
  }
}
