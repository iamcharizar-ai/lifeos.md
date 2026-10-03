// Phone↔PC sync over a Supabase append-only event ledger (supabase/schema.sql).
// Every mutation emits an immutable event row; state is always derived by folding
// events — never stored server-side. Without env keys (supabase === null) the
// whole layer is inert and the app stays pure-local.
//
// Boot sequence: fetch all events → fold into local state → re-apply the offline
// outbox → flush outbox → subscribe realtime (own-device events are skipped).
// First boot against an empty table seeds it from existing localStorage history.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { dateISO, type Ticks } from './store'
import type { HealthMap, MetricsMap, Stores, WorkoutMap } from './ledger'
import type { Habit } from '../config/habits'
import { applyConfig, getConfig } from './habitConfig'
import { adoptSnapshot, frozenSnapshots, type MonthSnapshot } from './monthSnapshot'
import { parseSummary } from './workout'
import { supabase } from './supabase'
import { GYM_HABIT, applyArborEvents, markStrongLinked } from './arborLink'
import { applyShedEvents } from './guitarLink'
import { SEED_AT, applySundayList, getSundayList, type SundayTask } from './sundayTasks'

/** The sleep habit Vitals can tick, and how early "on time" is (the habit says 10; half an hour of grace). */
const SLEEP_HABIT = 'sleep-before-10'
const SLEEP_BED_BY = '22:30'
export const VITALS_URL: string = import.meta.env.VITE_VITALS_URL ?? 'https://vitals-theta-pied.vercel.app'

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

export interface LifeEvent {
  device: string
  at: string // ISO timestamp
  day: string // YYYY-MM-DD the event applies to
  type: EventType
  payload: Record<string, string | number | boolean | null>
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
const COLS = 'device, at, day, type, payload, inserted_at'

async function fetchEvents(
  sb: NonNullable<typeof supabase>,
  since?: string,
): Promise<LifeEvent[] | null> {
  const out: LifeEvent[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from('events').select(COLS)
    if (since) q = q.gt('inserted_at', since)
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

const byAt = (a: LifeEvent, b: LifeEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)

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
    case 'vitals': {
      // A measured bedtime that was early enough ticks that evening's sleep habit.
      // It only ever adds a tick: nothing is locked and nothing is un-ticked, so
      // the habit works exactly as before on days Vitals has no reading.
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

  const flush = useCallback(async () => {
    if (!supabase) return
    const box = loadOutbox()
    if (box.length === 0) return
    const { error } = await supabase.from('events').insert(box)
    if (!error) {
      saveOutbox([])
      setPending(0)
    }
  }, [])

  const emit = useCallback(
    (type: EventType, payload: LifeEvent['payload'], day: string = dateISO()) => {
      if (!supabase) return
      const ev: LifeEvent = {
        device: device.current,
        at: new Date().toISOString(),
        day,
        type,
        payload,
      }
      void supabase
        .from('events')
        .insert(ev)
        .then(({ error }) => {
          if (error) {
            const box = loadOutbox()
            box.push(ev)
            saveOutbox(box)
            setPending(box.length)
          } else void flush()
        })
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

    const boot = async () => {
      const data = await fetchEvents(sb)
      if (cancelled) return
      if (!data) {
        setStatus('error')
        return
      }
      for (const ev of data) if (ev.inserted_at && ev.inserted_at > cursor.current) cursor.current = ev.inserted_at
      if (data.length === 0) {
        // Empty ledger + existing local history → seed it (chunked inserts)
        const seeds = seedEvents(snapRef.current, device.current)
        for (let i = 0; i < seeds.length; i += 200)
          await sb.from('events').insert(seeds.slice(i, i + 200))
      } else {
        applyArborEvents(data.filter((e) => e.type === 'skill' || e.type === 'plan'))
        applyShedEvents(data.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan'))
        for (const ev of data) if (!FOLDED_IN_BULK.has(ev.type)) applyEvent(ev, settersRef.current)
        // Offline edits made on this device win over folded history
        for (const ev of loadOutbox()) applyEvent(ev, settersRef.current)
      }
      await flush()
      booted.current = true
      if (!cancelled) setStatus('live')
    }
    void boot()

    // Pull anything other devices wrote while this tab was asleep, offline or
    // between realtime reconnects. Cheap: only rows newer than the cursor.
    let catching = false
    const catchUp = async () => {
      if (!booted.current || catching || document.visibilityState === 'hidden') return
      catching = true
      try {
        const fresh = await fetchEvents(sb, cursor.current || undefined)
        if (cancelled || !fresh) return
        for (const ev of fresh) if (ev.inserted_at && ev.inserted_at > cursor.current) cursor.current = ev.inserted_at
        for (const ev of fresh.filter((e) => e.device !== device.current).sort(byAt))
          applyEvent(ev, settersRef.current)
        for (const ev of loadOutbox()) applyEvent(ev, settersRef.current)
      } finally {
        catching = false
      }
    }

    const channel = sb
      .channel('events-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (msg) => {
          const ev = msg.new as LifeEvent
          if (ev.inserted_at && ev.inserted_at > cursor.current) cursor.current = ev.inserted_at
          if (ev.device !== device.current) applyEvent(ev, settersRef.current)
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
