// Phone↔PC sync over a Supabase append-only event ledger (supabase/schema.sql).
// Every mutation emits an immutable event row; state is always derived by folding
// events — never stored server-side. Without env keys (supabase === null) the
// whole layer is inert and the app stays pure-local.
//
// Boot sequence: fetch all events → fold into local state → re-apply the offline
// outbox → flush outbox → subscribe realtime (own-device events are skipped).
// The rows read are kept on the device (rowCache.ts): later opens fold that copy at
// once and fetch only the rows inserted since, instead of the whole ledger again.
// First boot against an empty table seeds it from existing localStorage history.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { type Ticks } from './store'
import type { HealthMap, MetricsMap, Stores, WorkoutMap } from './ledger'
import type { Habit } from '../config/habits'
import { applyConfig, getConfig } from './habitConfig'
import { adoptSnapshot, frozenSnapshots, type MonthSnapshot } from './monthSnapshot'
import { parseSummary } from './workout'
import { supabase } from './supabase'
import { GYM_HABIT, applyArborEvents, markStrongLinked } from './arborLink'
import { applyShedEvents } from './guitarLink'
import { applyGameEvents } from './gameLink'
import { currentDay } from './day'
import { inOrder } from '../game-core/order.ts'
import { SEED_AT, applySundayList, getSundayList, type SundayTask } from './sundayTasks'
import { loadRows, saveRows } from './rowCache'

/** The sleep habit Vitals can tick, and how early "on time" is (the habit says 10; half an hour of grace). */
const SLEEP_HABIT = 'sleep-before-10'
const SLEEP_BED_BY = '22:30'

export type CloudStatus = 'off' | 'connecting' | 'live' | 'error'

export type EventType =
  | 'tick'
  | 'untick'
  | 'metric'
  | 'health'
  | 'workout'
  | 'workout_clear'
  | 'config'
  | 'month'
  // the Sunday reset task list (the ticks themselves are plain `tick` events)
  | 'sunday'
  // written by Arbor / Strong / the Arbor block here; folded by lib/arborLink
  | 'skill'
  | 'plan'
  // written by Woodshed / the Guitar block here; folded by lib/guitarLink
  | 'guitar'
  | 'guitar_plan'
  // written by Vitals (hand entry or the band sync): a day's body readings
  | 'vitals'
  // written by the Pokedex when an item is used from the Bag
  | 'item_use'
  // written here for today: the habit list as it stands, so edits on a later day cannot change this one
  | 'day_list'
  // written by the Pokedex: this week's boss card, and each day's progress on it
  | 'boss_card'
  | 'boss_day'
  // written here when the day is started by hand before the band's reading arrived (game-core/day.ts)
  | 'day_start'

export interface LifeEvent {
  device: string
  at: string // ISO timestamp
  day: string // YYYY-MM-DD the event applies to
  type: EventType
  payload: Record<string, string | number | boolean | null>
  /** the table's primary key, made client-side so a retried insert is recognised and kept once */
  id?: string
  /** server clock; set on rows read back from Supabase — the catch-up cursor */
  inserted_at?: string
}

export interface CloudSetters {
  setTicks: Dispatch<SetStateAction<Ticks>>
  setMetrics: Dispatch<SetStateAction<MetricsMap>>
  setHealth: Dispatch<SetStateAction<HealthMap>>
  setWorkouts: Dispatch<SetStateAction<WorkoutMap>>
}

export interface CloudSnapshot {
  stores: Stores
}

// PostgREST returns at most 1000 rows per request, silently. The ledger passed
// that, and a plain select then dropped the *newest* events — ticks made on the
// phone never reached a freshly opened desktop. Always page.
const PAGE = 1000
const COLS = 'id, device, at, day, type, payload, inserted_at'
// A row can take an earlier inserted_at than a neighbour yet commit later, so each catch-up re-reads this
// much before the cursor; `seen` keeps the rows already applied from being applied twice.
const OVERLAP_MS = 60_000

async function fetchEvents(
  sb: NonNullable<typeof supabase>,
  since?: string,
  skip: string[] = [],
): Promise<LifeEvent[] | null> {
  const out: LifeEvent[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('events').select(COLS)
    if (since) q = q.gt('inserted_at', since)
    if (skip.length) q = q.not('type', 'in', `(${skip.join(',')})`)
    const { data, error } = await q
      .order(since ? 'inserted_at' : 'at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return null
    out.push(...(data as LifeEvent[]))
    if (data.length < PAGE) break
  }
  return out
}

/** Event types whose whole history is folded in one pass at boot (by the shared cores). */
const FOLDED_IN_BULK = new Set<EventType>(['skill', 'plan', 'guitar', 'guitar_plan'])
/** Event types applyEvent passes to the game link (gameLink.ts). */
const GAME_TYPES = new Set<EventType>(['day_list', 'item_use', 'boss_card', 'boss_day', 'day_start', 'vitals'])

const DEVICE_KEY = 'lifeos.device.v1'
const OUTBOX_KEY = 'lifeos.outbox.v1'

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID().slice(0, 8)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function loadOutbox(): LifeEvent[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as LifeEvent[]
  } catch {
    return []
  }
}

const newId = (): string | undefined => globalThis.crypto?.randomUUID?.()
/**
 * Insert as "keep one": a retry after a lost response (the server committed, the answer never
 * arrived) carries the same id and is ignored instead of becoming a second row.
 */
const insertOnce = (rows: LifeEvent | LifeEvent[]) =>
  supabase!.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
/** Events queued before ids existed get one now, and keep it across retries. */
function outboxWithIds(): LifeEvent[] {
  const box = loadOutbox()
  if (box.every((e) => e.id) || !newId()) return box
  const out = box.map((e) => (e.id ? e : { ...e, id: newId() }))
  saveOutbox(out)
  return out
}
// An event's identity: its id when it has one (two distinct events can share a timestamp and a
// payload), otherwise its content, for events queued before ids existed.
const outboxKey = (e: LifeEvent): string => e.id ?? `${e.device}|${e.at}|${e.type}|${JSON.stringify(e.payload)}`
/** Postgres / PostgREST refused the row itself (bad data, no permission): sending it again cannot help. */
const isPermanent = (err: { code?: string }): boolean => Boolean(err.code && /^(22|23|42|PGRST1)/.test(err.code))

function saveOutbox(box: LifeEvent[]): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(box))
}

/** Fold one event into app state. Must stay idempotent — boot replays history. */
function applyEvent(ev: LifeEvent, s: CloudSetters): void {
  const p = ev.payload
  switch (ev.type) {
    case 'tick':
      s.setTicks((prev) => ({
        ...prev,
        [ev.day]: { ...(prev[ev.day] ?? {}), [String(p.habitId)]: String(p.at) },
      }))
      break
    case 'untick':
      s.setTicks((prev) => {
        const day = { ...(prev[ev.day] ?? {}) }
        delete day[String(p.habitId)]
        return { ...prev, [ev.day]: day }
      })
      break
    case 'metric':
      s.setMetrics((prev) => ({
        ...prev,
        [ev.day]: { ...(prev[ev.day] ?? {}), [String(p.key)]: String(p.value) },
      }))
      break
    case 'health':
      s.setHealth((prev) => ({
        ...prev,
        [ev.day]: { ...(prev[ev.day] ?? {}), [String(p.key)]: String(p.value) },
      }))
      break
    case 'workout': {
      // v0.9 tracked sessions ride a JSON `session` field; quick logs don't
      const session = parseSummary(p.session)
      s.setWorkouts((prev) => ({
        ...prev,
        [ev.day]: { type: String(p.type), at: String(p.at), ...(session ? { session } : {}) },
      }))
      if (typeof p.gear === 'string') markStrongLinked() // this came from the new Strong: the link is live
      // Strong finishing a session is what ticks Gym — once linked, it cannot be ticked by hand.
      s.setTicks((prev) =>
        prev[ev.day]?.[GYM_HABIT] ? prev : { ...prev, [ev.day]: { ...(prev[ev.day] ?? {}), [GYM_HABIT]: String(p.at ?? ev.at) } },
      )
      break
    }
    case 'workout_clear':
      s.setWorkouts((prev) => {
        const next = { ...prev }
        delete next[ev.day]
        return next
      })
      s.setTicks((prev) => {
        if (!prev[ev.day]?.[GYM_HABIT]) return prev
        const day = { ...prev[ev.day] }
        delete day[GYM_HABIT]
        return { ...prev, [ev.day]: day }
      })
      break
    case 'skill':
    case 'plan':
      applyArborEvents([ev])
      break
    case 'guitar':
    case 'guitar_plan':
      applyShedEvents([ev])
      break
    case 'day_list':
    case 'item_use':
    case 'boss_card':
    case 'boss_day':
    case 'day_start':
      applyGameEvents([ev])
      break
    case 'vitals': {
      // what the band measured feeds the game (sleep score, steps, recovery)
      applyGameEvents([ev])
      // A measured bedtime that was early enough ticks that evening's sleep habit.
      // It only ever adds a tick: nothing is locked and nothing is un-ticked, so
      // the habit works exactly as before on days Vitals has no reading.
      // a row from the band carries the score itself: Sleep is then judged on that, not on the clock
      if (typeof p.sleepScore === 'number') break
      const bed = typeof p.bed === 'string' ? p.bed : ''
      const date = bed.slice(0, 10)
      const time = bed.slice(11, 16)
      if (date && time >= '18:00' && time <= SLEEP_BED_BY)
        s.setTicks((prev) =>
          prev[date]?.[SLEEP_HABIT] ? prev : { ...prev, [date]: { ...(prev[date] ?? {}), [SLEEP_HABIT]: ev.at } },
        )
      break
    }
    case 'config':
      // Habit config lives in its own external store, not React state — LWW by `at`
      try {
        const habits = JSON.parse(String(p.habits)) as Habit[]
        const deleted = p.deleted ? (JSON.parse(String(p.deleted)) as string[]) : []
        if (Array.isArray(habits))
          applyConfig({ habits, deleted, at: ev.at, source: 'cloud' })
      } catch {
        /* malformed payload — ignore */
      }
      break
    case 'sunday':
      // Sunday list lives in its own external store — LWW by `at`
      try {
        const tasks = JSON.parse(String(p.tasks)) as SundayTask[]
        if (Array.isArray(tasks)) applySundayList({ tasks, at: ev.at })
      } catch {
        /* malformed payload — ignore */
      }
      break
    case 'month':
      // A sealed month from any device. First seal wins, so this is idempotent.
      try {
        adoptSnapshot(JSON.parse(String(p.snapshot)) as MonthSnapshot)
      } catch {
        /* malformed payload — ignore */
      }
      break
  }
}

/** Synthesize ledger events from pre-Supabase localStorage history (first boot seed). */
function seedEvents(snap: CloudSnapshot, device: string): LifeEvent[] {
  const out: LifeEvent[] = []
  const { ticks, metrics, health, workouts } = snap.stores
  for (const [day, habits] of Object.entries(ticks))
    for (const [habitId, at] of Object.entries(habits))
      out.push({ device, at, day, type: 'tick', payload: { habitId, at } })
  for (const [day, m] of Object.entries(metrics))
    for (const [key, value] of Object.entries(m))
      if (value) out.push({ device, at: `${day}T12:00:00Z`, day, type: 'metric', payload: { key, value } })
  for (const [day, h] of Object.entries(health))
    for (const [key, value] of Object.entries(h))
      if (value) out.push({ device, at: `${day}T12:00:00Z`, day, type: 'health', payload: { key, value } })
  for (const [day, w] of Object.entries(workouts))
    out.push({
      device,
      at: w.at,
      day,
      type: 'workout',
      payload: {
        type: w.type,
        at: w.at,
        ...(w.session ? { session: JSON.stringify(w.session) } : {}),
      },
    })
  for (const m of frozenSnapshots())
    out.push({
      device,
      at: m.frozenAt as string,
      day: `${m.ym}-01`,
      type: 'month',
      payload: { ym: m.ym, snapshot: JSON.stringify(m) },
    })
  const cfg = getConfig()
  if (cfg.source !== 'default')
    out.push({
      device,
      at: cfg.at,
      day: cfg.at.slice(0, 10),
      type: 'config',
      payload: { habits: JSON.stringify(cfg.habits), deleted: JSON.stringify(cfg.deleted) },
    })
  const sunday = getSundayList()
  if (sunday.at !== SEED_AT)
    out.push({
      device,
      at: sunday.at,
      day: sunday.at.slice(0, 10),
      type: 'sunday',
      payload: { tasks: JSON.stringify(sunday.tasks) },
    })
  return out
}

export interface Cloud {
  status: CloudStatus
  pending: number
  emit: (type: EventType, payload: LifeEvent['payload'], day?: string) => void
  /** Debounced emit for keystroke-level fields (metrics/health inputs). */
  emitField: (type: 'metric' | 'health', key: string, value: string) => void
}

export function useCloudSync(snapshot: CloudSnapshot, setters: CloudSetters): Cloud {
  const [status, setStatus] = useState<CloudStatus>(supabase ? 'connecting' : 'off')
  const [pending, setPending] = useState(() => loadOutbox().length)
  const device = useRef(deviceId())
  const settersRef = useRef(setters)
  settersRef.current = setters
  const snapRef = useRef(snapshot)
  snapRef.current = snapshot
  const fieldTimers = useRef<Record<string, number>>({})
  /** newest server-side insert time folded so far */
  const cursor = useRef<string>('')
  const booted = useRef(false)
  /** ids of rows applied within OVERLAP_MS of the cursor (the window a catch-up reads again) */
  const seen = useRef(new Map<string, string>())
  /** every row folded, and when the whole ledger was last read: the copy kept on this device */
  const rows = useRef<LifeEvent[]>([])
  const fullAt = useRef(0)

  // One flush at a time: online + catchUp + boot often fire together, and each would otherwise
  // read the same outbox and insert the same rows. A call that arrives mid-flight asks for one
  // more pass so what it queued is not left waiting for the next trigger.
  const flushing = useRef(false)
  const flushAgain = useRef(false)

  const flush = useCallback(async () => {
    if (!supabase) return
    if (flushing.current) {
      flushAgain.current = true
      return
    }
    flushing.current = true
    try {
      do {
        flushAgain.current = false
        const box = outboxWithIds()
        if (box.length === 0) return
        const sent = new Set<string>()
        const { error } = await insertOnce(box)
        if (!error) box.forEach((e) => sent.add(outboxKey(e)))
        // offline, a timeout, a 5xx or an auth error is about the connection, not a row: going one by one would
        // only turn one failed request into one per queued event, all failing the same way. Wait for the next try.
        else if (!isPermanent(error)) return
        else
          // One refused row must not hold the rest back (a stuck un-tick leaves its tick standing
          // on every other device): send them one by one, and drop only what the server rejects outright.
          for (const ev of box) {
            const { error: err } = await insertOnce(ev)
            if (!err || isPermanent(err)) sent.add(outboxKey(ev))
          }
        // events queued while this was in flight stay
        const rest = loadOutbox().filter((e) => !sent.has(outboxKey(e)))
        saveOutbox(rest)
        setPending(rest.length)
      } while (flushAgain.current)
    } finally {
      flushing.current = false
    }
  }, [])

  const emit = useCallback(
    (type: EventType, payload: LifeEvent['payload'], day: string = currentDay()) => {
      if (!supabase) return
      const id = newId()
      const ev: LifeEvent = {
        ...(id ? { id } : {}),
        device: device.current,
        at: new Date().toISOString(),
        day,
        type,
        payload,
      }
      // Every event goes through the outbox, and flush() (one at a time, in order) sends it. A direct
      // insert would let a later event overtake an earlier one that is still in flight or failed: a
      // tick that failed, then an un-tick that got through first, would leave peers showing the habit
      // ticked until they reload.
      const box = loadOutbox()
      box.push(ev)
      saveOutbox(box)
      setPending(box.length)
      void flush()
    },
    [flush],
  )

  const emitField = useCallback(
    (type: 'metric' | 'health', key: string, value: string) => {
      if (!supabase) return
      const timerKey = `${type}:${key}`
      window.clearTimeout(fieldTimers.current[timerKey])
      fieldTimers.current[timerKey] = window.setTimeout(
        () => emit(type, { key, value }),
        800,
      )
    },
    [emit],
  )

  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    let cancelled = false

    /** Note rows as folded: move the cursor, remember their ids for the overlap, keep them on the device. */
    const took = (fresh: LifeEvent[], full = false) => {
      for (const ev of fresh) {
        if (ev.inserted_at && ev.inserted_at > cursor.current) cursor.current = ev.inserted_at
        if (ev.id) seen.current.set(ev.id, ev.inserted_at ?? '')
      }
      const floor = cursor.current ? new Date(Date.parse(cursor.current) - OVERLAP_MS).toISOString() : ''
      for (const [id, at] of seen.current) if (at < floor) seen.current.delete(id)
      rows.current = full ? fresh : [...rows.current, ...fresh]
      if (full) fullAt.current = Date.now()
      if (cursor.current) saveRows({ cursor: cursor.current, full: fullAt.current, rows: rows.current })
    }

    /** Fold a whole history into local state (from the server, or from the copy kept on this device). */
    const foldAll = (data: LifeEvent[]) => {
      applyArborEvents(data.filter((e) => e.type === 'skill' || e.type === 'plan'))
      applyShedEvents(data.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan'))
      const ordered = inOrder(data)
      // the game's rows in one batch: applyEvent hands them over one at a time, and each hand-over re-derives the
      // whole game and rewrites its copy. Taken once here, those later calls find nothing new and return at once.
      applyGameEvents(ordered.filter((e) => GAME_TYPES.has(e.type)))
      for (const ev of ordered) if (!FOLDED_IN_BULK.has(ev.type)) applyEvent(ev, settersRef.current)
      // Offline edits made on this device win over folded history
      for (const ev of loadOutbox()) applyEvent(ev, settersRef.current)
    }

    const boot = async () => {
      // A copy from an earlier visit: fold it now, then fetch only what was inserted after it (catchUp).
      const kept = await loadRows()
      if (cancelled) return
      if (kept) {
        cursor.current = kept.cursor
        fullAt.current = kept.full
        rows.current = kept.rows
        const floor = new Date(Date.parse(kept.cursor) - OVERLAP_MS).toISOString()
        for (const ev of kept.rows) if (ev.id && (ev.inserted_at ?? '') >= floor) seen.current.set(ev.id, ev.inserted_at ?? '')
        foldAll(kept.rows)
        booted.current = true
        const caught = await catchUp()
        await flush()
        if (!cancelled && caught !== 'skipped') setStatus(caught === 'ok' ? 'live' : 'error')
        return
      }
      // The rows that decide which day it is come first, in one small read: the band's nights and any "Start my day" since
      // yesterday. The day turns over now, not after the whole ledger has come down.
      const since = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
      const head = await sb.from('events').select(COLS).in('type', ['vitals', 'day_start']).gte('day', since)
      if (!cancelled && head.data) applyGameEvents(head.data as LifeEvent[])
      // Then everything, except the habit library: each `config` row is a full copy and only the newest stands (LWW), so it is
      // read on its own instead of every copy ever written.
      const [rest, cfg] = await Promise.all([
        fetchEvents(sb, undefined, ['config']),
        sb.from('events').select(COLS).eq('type', 'config').order('at', { ascending: false }).limit(1),
      ])
      const data = rest && !cfg.error ? [...rest, ...((cfg.data ?? []) as LifeEvent[])] : null
      if (cancelled) return
      if (!data) {
        setStatus('error')
        return
      }
      if (data.length === 0) {
        // Empty ledger + existing local history → seed it (chunked inserts)
        // each seed carries an id, so a retry is ignored where it already landed; what a failure leaves
        // unsent goes to the outbox (the ledger is no longer empty, so it would never be seeded again)
        const seeds = seedEvents(snapRef.current, device.current).map((e) => (e.id ? e : { ...e, id: newId() }))
        for (let i = 0; i < seeds.length; i += 200) {
          const { error } = await insertOnce(seeds.slice(i, i + 200))
          if (error) {
            saveOutbox([...loadOutbox(), ...seeds.slice(i)])
            setStatus('error')
            return
          }
        }
      } else {
        foldAll(data)
        took(data, true)
      }
      await flush()
      booted.current = true
      if (!cancelled) setStatus('live')
    }

    // Pull anything other devices wrote while this tab was asleep, offline or
    // between realtime reconnects. Cheap: only rows newer than the cursor (less the overlap).
    let catching = false
    const catchUp = async (): Promise<'ok' | 'failed' | 'skipped'> => {
      if (!booted.current || catching || document.visibilityState === 'hidden') return 'skipped'
      catching = true
      try {
        const since = cursor.current ? new Date(Date.parse(cursor.current) - OVERLAP_MS).toISOString() : undefined
        const got = await fetchEvents(sb, since)
        if (cancelled) return 'skipped'
        if (!got) return 'failed'
        const fresh = got.filter((e) => !e.id || !seen.current.has(e.id))
        for (const ev of inOrder(fresh.filter((e) => e.device !== device.current)))
          applyEvent(ev, settersRef.current)
        for (const ev of loadOutbox()) applyEvent(ev, settersRef.current)
        if (fresh.length) took(fresh)
        void flush() // an outbox that could not go earlier gets another try every poll
        return 'ok'
      } finally {
        catching = false
      }
    }
    void boot()

    const channel = sb
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (msg) => {
          const ev = msg.new as LifeEvent
          if (ev.id && seen.current.has(ev.id)) return
          if (ev.device !== device.current) applyEvent(ev, settersRef.current)
          // before boot has folded, the row is left unmarked: the boot read (or its catch-up) brings it again in order
          if (booted.current) took([ev])
        },
      )
      .subscribe((s) => {
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error')
        if (s === 'SUBSCRIBED') void catchUp() // covers the gap while the socket was down
      })

    const onOnline = () => {
      void flush()
      void catchUp()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void catchUp()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => void catchUp(), 45_000) // safety net if realtime drops silently
    return () => {
      cancelled = true
      window.clearInterval(poll)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
      void sb.removeChannel(channel)
    }
  }, [flush])

  // Stable identity: callers put `cloud` in effect deps.
  return useMemo(
    () => ({ status, pending, emit, emitField }),
    [status, pending, emit, emitField],
  )
}
