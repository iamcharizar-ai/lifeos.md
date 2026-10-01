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
  /** Build an event, queue it for the ledger, and return it so the caller can apply it locally. */
  emit: (type: string, payload: LedgerEvent['payload'], day?: string) => LedgerEvent
  start: () => void
  stop: () => void
}

const PAGE = 1000
const COLS = 'device,at,day,type,payload,inserted_at'
const POLL_MS = 30_000

const today = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function createLedger(o: LedgerOptions): Ledger {
  const enabled = Boolean(o.url && o.key)
  const DEVICE_KEY = `${o.app}.device.v1`, OUTBOX_KEY = `${o.app}.outbox.v1`
  let device = localStorage.getItem(DEVICE_KEY)
  if (!device) {
    device = `${o.app}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_KEY, device)
  }

  const headers = { apikey: o.key ?? '', Authorization: `Bearer ${o.key ?? ''}`, 'Content-Type': 'application/json' }
  const base = `${(o.url ?? '').replace(/\/$/, '')}/rest/v1/events`
  let status: LedgerStatus = enabled ? 'connecting' : 'off'
  let cursor = ''
  let booted = false
  let busy = false
  let again = false // something was emitted mid-sync: go round once more
  let timer: ReturnType<typeof setInterval> | undefined

  const outbox = (): LedgerEvent[] => {
    try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as LedgerEvent[] } catch { return [] }
  }
  const saveOutbox = (b: LedgerEvent[]) => localStorage.setItem(OUTBOX_KEY, JSON.stringify(b))
  const report = (s: LedgerStatus) => { status = s; o.onStatus?.(s, outbox().length) }

  async function flush(): Promise<void> {
    const box = outbox()
    if (!enabled || box.length === 0) return
    const res = await fetch(base, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(box) })
    if (!res.ok) throw new Error(`ledger insert ${res.status}`)
    // keep anything emitted while the request was in flight
    saveOutbox(outbox().slice(box.length))
  }

  async function fetchPage(since: string, offset: number): Promise<LedgerEvent[]> {
    const q = new URLSearchParams({ select: COLS, type: `in.(${o.types.join(',')})`, order: since ? 'inserted_at.asc,id.asc' : 'at.asc,id.asc', offset: String(offset), limit: String(PAGE) })
    if (since) q.set('inserted_at', `gt.${since}`)
    const res = await fetch(`${base}?${q}`, { headers })
    if (!res.ok) throw new Error(`ledger read ${res.status}`)
    return (await res.json()) as LedgerEvent[]
  }

  async function pull(boot: boolean): Promise<void> {
    const all: LedgerEvent[] = []
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(boot ? '' : cursor, offset)
      all.push(...page)
      if (page.length < PAGE) break
    }
    for (const e of all) if (e.inserted_at && e.inserted_at > cursor) cursor = e.inserted_at
    if (all.length || boot) o.onEvents(boot ? all : all.sort((a, b) => (a.at < b.at ? -1 : 1)), boot)
  }

  async function sync(): Promise<void> {
    if (!enabled) return
    if (busy) { again = true; return }
    busy = true
    try {
      await flush()
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
    emit(type, payload, day = today()) {
      const ev: LedgerEvent = { device: device as string, at: new Date().toISOString(), day, type, payload }
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
