// What an AI reads instead of the pictures: the whole system folded from the ledger into plain data, then written out as
// Markdown (for a pasted link) or JSON (for tools). Pure: rows in, text out. No network, no clock of its own, no writes.
//
// It folds the rows with the same cores the apps run (game-core, arbor-core, woodshed-core), so what an AI is told is what the
// screens show: the same partner, the same streaks, the same plan for today. server/ai-data.ts reads the ledger; server/ai.ts
// and server/mcp.ts serve this. Nothing here is a second copy of any rule.
import { inOrder, settled } from '../src/game-core/order.ts'
import { bodyOf, listsOf, usesOf } from '../src/game-core/events.ts'
import { addDays, buildFacts } from '../src/game-core/facts.ts'
import { LEAGUES } from '../src/game-core/gyms.ts'
import { foldGame, leaderOf, nameOf } from '../src/game-core/fold.ts'
import { bossOf } from '../src/game-core/boss.ts'
import { strongMarks } from '../src/game-core/strong.ts'
import { GAME_START, SLEEP_DONE, SLEEP_HABIT, V13_START } from '../src/game-core/rules.ts'
import { DEFAULT_HABITS, isActiveOn, isLive, migrateHabit, type Habit } from '../src/config/habits.ts'
import { LEGACY_MONTHS } from '../src/lib/legacyMonths.ts'
import { RANK_NAME as ARBOR_RANKS, emptyArbor, foldArbor, rankOf as arborRank, valueOf, type LedgerEvent as ArborEvent } from '../src/arbor-core/model.ts'
import { SKILLS, SKILL_BY_ID } from '../src/arbor-core/skills.ts'
import { planFor as arborPlan, targetFor } from '../src/arbor-core/coach.ts'
import { RANK_NAME as SHED_RANKS, FEEL_NAME, emptyShed, foldShed, rankOf as shedRank, statsOf, type LedgerEvent as ShedEvent } from '../src/woodshed-core/model.ts'
import { ITEMS, ITEM_BY_ID } from '../src/woodshed-core/course.ts'
import { planFor as shedPlan } from '../src/woodshed-core/coach.ts'

/** One row of the ledger's `events` table. */
export interface Row {
  id?: string
  device?: string
  at: string
  day: string
  type: string
  payload: Record<string, unknown> | null
  inserted_at?: string
}

export const SECTIONS = ['today', 'habits', 'months', 'game', 'body', 'arbor', 'woodshed', 'workouts'] as const
export type Section = (typeof SECTIONS)[number]
export const isSection = (s: string): s is Section => (SECTIONS as readonly string[]).includes(s)

export const DEFAULT_DAYS = 14
export const MAX_DAYS = 120

export interface Options {
  /** the owner's time zone, for "today" and weekdays */
  tz: string
  /** the clock; a test passes its own */
  now: Date
  /** how many days of history the day-by-day sections cover */
  days?: number
  /** which sections to include; all when absent */
  sections?: Section[]
  /** leave out what could identify a body: the band's readings and the weight, and Sleep from the habit tables. (The game's numbers still carry what the band earned.) */
  redactHealth?: boolean
}

type Payload = Record<string, unknown>
type Ticks = Record<string, Record<string, string>>

const LEGACY_TOMBSTONES = ['water-1l-morning', 'water-1l-midday', 'water-1l-afternoon', 'water-1l-evening']
const GYM_HABIT = 'gym'
const SLEEP_BED_BY = '22:30'
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const weekday = (day: string): string => DOW[new Date(`${day}T12:00:00Z`).getUTCDay()]
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const parse = <T>(raw: unknown): T | null => {
  try {
    return JSON.parse(String(raw)) as T
  } catch {
    return null
  }
}
const pct = (n: number, d: number): number => (d > 0 ? Math.round((100 * n) / d) : 0)
const hm = (min: number | undefined): string => (min === undefined ? '' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`)

/** The owner's calendar date. */
export function todayIn(tz: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).slice(0, 10)
}

// ── folding the ledger ──────────────────────────────────────────────────────

/** The habit library as Life OS holds it: the newest `config` row, with the erased ones removed. */
function libraryOf(sorted: Row[]): Habit[] {
  let habits: Habit[] = DEFAULT_HABITS
  let deleted: string[] = []
  for (const ev of sorted) {
    if (ev.type !== 'config') continue
    const h = parse<Habit[]>(ev.payload?.habits)
    if (!Array.isArray(h)) continue
    habits = h
    deleted = ev.payload?.deleted ? (parse<string[]>(ev.payload.deleted) ?? []) : []
  }
  const gone = new Set([...deleted, ...LEGACY_TOMBSTONES])
  const seen = new Set<string>()
  const out: Habit[] = []
  for (const h of habits) {
    if (!h || typeof h.id !== 'string' || !h.id || typeof h.name !== 'string' || !h.name || gone.has(h.id) || seen.has(h.id)) continue
    seen.add(h.id)
    out.push(migrateHabit(h))
  }
  return out
}

/** day → habit id → time ticked, folded the way Life OS does (ticks, unticks, Strong's workouts, an early bedtime). */
function ticksOf(sorted: Row[]): Ticks {
  const t: Ticks = {}
  for (const ev of sorted) {
    const p = ev.payload ?? {}
    if (ev.type === 'tick') (t[ev.day] ??= {})[str(p.habitId)] = str(p.at)
    else if (ev.type === 'untick') delete t[ev.day]?.[str(p.habitId)]
    else if (ev.type === 'workout') {
      if (!t[ev.day]?.[GYM_HABIT]) (t[ev.day] ??= {})[GYM_HABIT] = str(p.at ?? ev.at)
    } else if (ev.type === 'workout_clear') delete t[ev.day]?.[GYM_HABIT]
    else if (ev.type === 'vitals' && typeof p.sleepScore !== 'number') {
      const bed = str(p.bed)
      const date = bed.slice(0, 10)
      const time = bed.slice(11, 16)
      if (date && time >= '18:00' && time <= SLEEP_BED_BY && !t[date]?.[SLEEP_HABIT]) (t[date] ??= {})[SLEEP_HABIT] = ev.at
    }
  }
  return t
}

/** day → everything the band and the hand-entered metrics said that day. Later rows win; null takes a value back. */
function vitalsOf(sorted: Row[]): Record<string, Payload> {
  const out: Record<string, Payload> = {}
  for (const ev of sorted) {
    if (ev.type !== 'vitals') continue
    const day = (out[ev.day] ??= {})
    for (const [k, v] of Object.entries(ev.payload ?? {})) {
      if (v === null) delete day[k]
      else day[k] = v
    }
  }
  return out
}

interface WorkoutSummary {
  id?: string
  name: string
  startedAt?: string
  durationMin?: number
  totalSets?: number
  totalReps?: number
  volumeKg?: number
  muscles?: string[]
  exercises: { name: string; kind?: string; sets: { weight: number; reps: number }[] }[]
}

function workoutsOf(sorted: Row[]): { day: string; w: WorkoutSummary }[] {
  const gone = new Set(sorted.filter((e) => e.type === 'workout_delete').map((e) => str(e.payload?.id)))
  const byKey = new Map<string, { day: string; w: WorkoutSummary }>()
  for (const ev of sorted) {
    if (ev.type !== 'workout') continue
    const w = parse<WorkoutSummary>(ev.payload?.session)
    if (!w || !Array.isArray(w.exercises)) continue
    if (w.id && gone.has(w.id)) continue
    byKey.set(w.id ?? `${ev.day}|${ev.at}`, { day: ev.day, w })
  }
  return [...byKey.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

// ── the snapshot ────────────────────────────────────────────────────────────

export interface Snapshot {
  generatedAt: string
  timezone: string
  today: string
  weekday: string
  window: { days: number; from: string }
  freshness: { events: number; latestEventInsertedAt: string | null; latestBandDay: string | null }
  /** health data was left out on request */
  redacted: boolean
  today_: TodayView
  days: DayView[]
  habits: HabitView[]
  months: MonthView[]
  game: GameView
  body: { nights: Record<string, unknown>[]; manual: Record<string, { value: string; day: string }> }
  arbor: ArborView
  woodshed: ShedView
  workouts: { day: string; name: string; durationMin?: number; sets?: number; volumeKg?: number; muscles?: string[]; exercises: string[] }[]
}

interface TodayView {
  day: string
  done: number
  total: number
  items: { id: string; name: string; tier: string; domain: string; done: boolean; note?: string }[]
  sunday: { name: string; done: boolean }[] | null
}
interface DayView { day: string; weekday: string; done: number; total: number; pct: number; perfect: boolean; xp?: number; missed: string[]; ticked: string[] }
interface HabitView { id: string; name: string; tier: string; domain: string; live: boolean; activeDays: number; doneDays: number; pct: number; streak: number; bestStreak: number }
interface MonthView { ym: string; source: 'sealed' | 'legacy' | 'running'; days: number; pct: number; habits: { name: string; pct: number }[] }

interface GameView {
  rulesNote: string
  partner: { name: string; form: string; level: number; xpInto: number; xpNeed: number; shiny: boolean; daysTogether: number | null }
  next: string
  momentum: { daysCounted: number; multiplier: number }
  todayResult: { done: number; total: number; xp: number; perfect: boolean; pillars: string }
  perfectDays: number
  wallet: { coins: number; gems: number }
  league: { name: string; leader: string; type: string; hp: number; hpMax: number; waiting: boolean; leadersBeaten: number } | null
  wild: { name: string; hp: number; hpMax: number; rarity: string; leavesInDays: number | null } | null
  boss: { name: string; level: number; hpLeft: number; hpMax: number; mega: boolean; daysLeft: number; allTasksDone: boolean; tasks: { text: string; progress: number }[] } | null
  team: string[]
  graduated: number
  boxWaiting: number
  dex: { seen: number; owned: number }
  streaks: { id: string; current: number; best: number }[]
  quests: { name: string; done: boolean; have: number; need: number }[]
  egg: { have: number; need: number } | null
  heldRewards: number
  warnings: string[]
}

interface ArborView {
  today: { morning: { skill: string; target: string; done: boolean }[]; gym: string[]; frozen: boolean }
  ranks: Record<string, number>
  inProgress: { skill: string; branch: string; value: string }[]
  mastered: string[]
  recentBests: { day: string; skill: string; value: string; rank: string }[]
  practicedDays: Record<string, number>
}

interface ShedView {
  today: { item: string; kind: string; done: boolean; feel?: string; bpm?: number; target?: number }[]
  frozen: boolean
  ranks: Record<string, number>
  learning: { item: string; days: number; bestBpm: number; target?: number }[]
  owned: string[]
  recent: { day: string; items: string[] }[]
}

export function buildSnapshot(rows: Row[], opts: Options): Snapshot {
  const days = Math.max(1, Math.min(MAX_DAYS, Math.floor(opts.days ?? DEFAULT_DAYS)))
  const today = todayIn(opts.tz, opts.now)
  const sorted = inOrder(rows)
  const habits = libraryOf(sorted)
  const ticks = ticksOf(sorted)
  const lists = listsOf(sorted)
  const body = bodyOf(sorted)
  const vitals = vitalsOf(sorted)
  const marks = strongMarks(sorted)

  // the game, exactly as Life OS folds it
  const arborState = foldArbor(emptyArbor(), settled(rows.filter((e) => e.type === 'skill' || e.type === 'plan')) as unknown as ArborEvent[])
  const shedState = foldShed(emptyShed(), settled(rows.filter((e) => e.type === 'guitar' || e.type === 'guitar_plan')) as unknown as ShedEvent[])
  const game = foldGame(buildFacts({ habits, ticks, arbor: arborState, shed: shedState, lists, body, uses: usesOf(sorted), boss: bossOf(sorted), marks, today }))
  const gameDay = new Map(game.days.map((d) => [d.day, d]))

  const byId = new Map(habits.map((h) => [h.id, h]))
  // two habits can share a name (a morning Bath and an evening one): the later ones are numbered so an AI can tell them apart
  const shown = new Map<string, string>()
  const used = new Map<string, number>()
  for (const h of habits) {
    const k = (used.get(h.name) ?? 0) + 1
    used.set(h.name, k)
    shown.set(h.id, k > 1 ? `${h.name} (${k})` : h.name)
  }
  const nameOfHabit = (id: string): string => shown.get(id) ?? byId.get(id)?.name ?? id
  const hide = Boolean(opts.redactHealth)
  const activeIds = (day: string): string[] => (lists[day] ? lists[day].map((h) => h.id) : habits.filter((h) => isActiveOn(h, day)).map((h) => h.id)).filter((id) => !(hide && id === SLEEP_HABIT))
  /** done / not done / not counted (null): Sleep is the band's, so a morning with no reading is not a miss */
  const doneOn = (id: string, day: string): boolean | null => {
    if (id === SLEEP_HABIT && day >= V13_START) {
      const s = num(body[day]?.sleepScore)
      return s === undefined ? null : s >= SLEEP_DONE
    }
    return Boolean(ticks[day]?.[id])
  }

  // where history starts: not before the first tick, so the days before the app was used are not shown as misses
  const firstTick = Object.keys(ticks).filter((d) => Object.keys(ticks[d]).length > 0).sort()[0] ?? today
  const from = [addDays(today, -(days - 1)), firstTick].sort().pop() as string

  const dayViews: DayView[] = []
  for (let d = from; d <= today; d = addDays(d, 1)) {
    let done = 0
    let total = 0
    const missed: string[] = []
    const ticked: string[] = []
    for (const id of activeIds(d)) {
      const r = doneOn(id, d)
      if (r === null) continue
      total++
      if (r) {
        done++
        ticked.push(nameOfHabit(id))
      } else missed.push(nameOfHabit(id))
    }
    if (total === 0) continue
    dayViews.push({ day: d, weekday: weekday(d), done, total, pct: pct(done, total), perfect: done === total, ...(gameDay.get(d) ? { xp: Math.round(gameDay.get(d)!.xp) } : {}), missed: d === today ? [] : missed, ticked })
  }

  // today's checklist
  const items: TodayView['items'] = []
  for (const id of activeIds(today)) {
    const h = byId.get(id)
    const r = doneOn(id, today)
    const score = num(body[today]?.sleepScore)
    items.push({
      id,
      name: nameOfHabit(id),
      tier: h?.tier ?? '',
      domain: h?.domain ?? '',
      done: r === true,
      ...(id === SLEEP_HABIT && today >= V13_START && !hide ? { note: score === undefined ? "waiting for last night's band reading" : `band sleep score ${score}` } : {}),
    })
  }
  const counted = items.filter((i) => !(i.id === SLEEP_HABIT && i.note?.startsWith('waiting')))
  const sundayTasks = weekday(today) === 'Sun' ? (parse<{ id: string; name: string }[]>(sorted.filter((e) => e.type === 'sunday').pop()?.payload?.tasks) ?? []) : null

  // each habit over the window, and its run
  const habitViews: HabitView[] = habits.map((h) => {
    let active = 0
    let done = 0
    for (const dv of dayViews) {
      if (!activeIds(dv.day).includes(h.id)) continue
      const r = doneOn(h.id, dv.day)
      if (r === null) continue
      active++
      if (r) done++
    }
    let streak = 0
    let best = 0
    let run = 0
    const start = [GAME_START, firstTick].sort()[0]
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (doneOn(h.id, d) === true) {
        run++
        best = Math.max(best, run)
      } else if (d !== today) run = 0
    }
    for (let d = doneOn(h.id, today) === true ? today : addDays(today, -1); doneOn(h.id, d) === true; d = addDays(d, -1)) streak++
    return { id: h.id, name: nameOfHabit(h.id), tier: h.tier, domain: h.domain ?? '', live: isLive(h), activeDays: active, doneDays: done, pct: pct(done, active), streak, bestStreak: best }
  }).filter((h) => (h.activeDays > 0 || h.live) && !(hide && h.id === SLEEP_HABIT))

  return {
    generatedAt: opts.now.toISOString(),
    timezone: opts.tz,
    today,
    weekday: weekday(today),
    window: { days, from },
    redacted: hide,
    freshness: {
      events: rows.length,
      latestEventInsertedAt: rows.map((r) => r.inserted_at ?? '').sort().pop() || null,
      latestBandDay: hide ? null : (Object.keys(body).filter((d) => body[d]?.sleepScore !== undefined).sort().pop() ?? null),
    },
    today_: { day: today, done: counted.filter((i) => i.done).length, total: counted.length, items, sunday: sundayTasks ? sundayTasks.map((t) => ({ name: t.name, done: Boolean(ticks[today]?.[`sun:${t.id}`]) })) : null },
    days: dayViews,
    habits: habitViews,
    months: monthsOf(sorted, monthToDate(today, activeIds, doneOn), today),
    game: gameView(game),
    body: hide ? { nights: [], manual: {} } : bodyView(vitals, sorted, from, today),
    arbor: arborView(arborState, today, from),
    woodshed: shedView(shedState, today, from),
    workouts: workoutsOf(sorted)
      .filter((x) => x.day >= from)
      .map(({ day, w }) => ({
        day,
        name: w.name,
        durationMin: num(w.durationMin),
        sets: num(w.totalSets),
        volumeKg: num(w.volumeKg),
        muscles: w.muscles,
        exercises: w.exercises.map((e) => `${e.name}: ${e.sets.map((s) => (s.weight ? `${s.weight}kg×${s.reps}` : `${s.reps}`)).join(', ')}`),
      })),
  }
}

/** The running month's days so far, as done/total each, for its month-to-date line. */
function monthToDate(today: string, activeIds: (d: string) => string[], doneOn: (id: string, d: string) => boolean | null): { done: number; total: number } {
  const first = `${today.slice(0, 7)}-01`
  let done = 0
  let total = 0
  for (let d = first; d <= today; d = addDays(d, 1)) {
    for (const id of activeIds(d)) {
      const r = doneOn(id, d)
      if (r === null) continue
      total++
      if (r) done++
    }
  }
  return { done, total }
}

function monthsOf(sorted: Row[], running: { done: number; total: number }, today: string): MonthView[] {
  const sealed = new Map<string, { frozenAt: string; snap: { ym: string; habits: { id: string; name: string }[]; cells: Record<string, string> } }>()
  for (const ev of sorted) {
    if (ev.type !== 'month') continue
    const snap = parse<{ ym: string; frozenAt: string | null; habits: { id: string; name: string }[]; cells: Record<string, string> }>(ev.payload?.snapshot)
    if (!snap || typeof snap.ym !== 'string' || !snap.frozenAt || !snap.cells) continue
    const mine = sealed.get(snap.ym)
    if (!mine || snap.frozenAt < mine.frozenAt) sealed.set(snap.ym, { frozenAt: snap.frozenAt, snap })
  }
  const out: MonthView[] = []
  const summarize = (ym: string, source: 'sealed' | 'legacy', habits: { id: string; name: string }[], cells: Record<string, string>): MonthView => {
    let done = 0
    let miss = 0
    const per = habits.map((h) => {
      const row = cells[h.id] ?? ''
      const d = [...row].filter((c) => c === '1').length
      const m = [...row].filter((c) => c === '0').length
      done += d
      miss += m
      return { name: h.name, pct: pct(d, d + m) }
    })
    return { ym, source, days: Math.max(0, ...Object.values(cells).map((r) => r.length)), pct: pct(done, done + miss), habits: per }
  }
  const yms = new Set<string>([...sealed.keys(), ...LEGACY_MONTHS.map((m) => m.ym)])
  for (const ym of [...yms].sort()) {
    const s = sealed.get(ym)
    if (s) out.push(summarize(ym, 'sealed', s.snap.habits, s.snap.cells))
    else {
      const l = LEGACY_MONTHS.find((m) => m.ym === ym)
      if (l) out.push(summarize(ym, 'legacy', l.habits, l.cells))
    }
  }
  const ym = today.slice(0, 7)
  if (!sealed.has(ym)) out.push({ ym, source: 'running', days: Number(today.slice(8)), pct: pct(running.done, running.total), habits: [] })
  return out
}

function gameView(game: ReturnType<typeof foldGame>): GameView {
  const league = LEAGUES[game.league.index]
  const lead = leaderOf(game.league.index, game.league.slot)
  const b = game.boss
  return {
    rulesNote: 'Nothing here is stored: it is recomputed from the habits and ticks by the Pokedex rules (game-core). XP comes from pillars (big habits), HP from how much of the day was ticked.',
    partner: { name: nameOf(game.partner.form), form: game.partner.form, level: game.level, xpInto: game.into, xpNeed: game.need, shiny: game.partner.shiny, daysTogether: game.partner.together ?? null },
    next: `at level ${game.next.level}: ${game.next.what}`,
    momentum: { daysCounted: game.momentum.days, multiplier: game.momentum.mult },
    todayResult: { done: game.today.done, total: game.today.total, xp: Math.round(game.today.xp), perfect: game.today.perfect, pillars: `${game.today.pillars}/${game.today.pillarTotal}` },
    perfectDays: game.perfectDays,
    wallet: { coins: game.wallet.coins, gems: game.wallet.gems },
    league: league ? { name: league.name, leader: lead?.name ?? '?', type: lead?.type ?? '', hp: Math.round(game.league.hp), hpMax: game.league.max, waiting: game.league.waiting, leadersBeaten: game.league.beaten } : null,
    wild: game.wild ? { name: nameOf(game.wild.form), hp: Math.round(game.wild.hp), hpMax: game.wild.max, rarity: game.wild.rarity, leavesInDays: game.wild.leavesIn ?? null } : null,
    boss: b ? { name: nameOf(b.form), level: b.level, hpLeft: Math.round(b.hpLeft), hpMax: b.max, mega: b.mega, daysLeft: b.daysLeft, allTasksDone: b.allDone, tasks: b.tasks.map((k) => ({ text: k.text, progress: Math.round(100 * k.p) })) } : null,
    team: game.team.map((m) => `${nameOf(m.form)}${m.shiny ? ' (shiny)' : ''}`),
    graduated: game.graduates.length,
    boxWaiting: game.queue.length,
    dex: { seen: Object.keys(game.dex).length, owned: Object.values(game.dex).filter((e) => e.own).length },
    streaks: Object.entries(game.runs).map(([id, r]) => ({ id, current: r.cur, best: r.best })),
    quests: game.quests.weekly.map((q) => ({ name: q.name, done: q.done, have: q.have, need: q.need })),
    egg: game.egg ? { have: game.egg.have, need: game.egg.need } : null,
    heldRewards: game.held.length,
    warnings: game.warnings,
  }
}

const BODY_KEYS = ['sleepScore', 'sleepMin', 'bed', 'wake', 'deepMin', 'remMin', 'lightMin', 'awakeMin', 'steps', 'kcal', 'restingHr', 'hrv', 'spo2', 'recovery', 'weight', 'zoneMin', 'distanceM']

function bodyView(vitals: Record<string, Payload>, sorted: Row[], from: string, today: string): Snapshot['body'] {
  const nights: Record<string, unknown>[] = []
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const v = vitals[d]
    if (!v) continue
    const row: Record<string, unknown> = { day: d }
    for (const k of Object.keys(v).sort((a, b) => (BODY_KEYS.indexOf(a) + 100) % 100 - (BODY_KEYS.indexOf(b) + 100) % 100)) row[k] = v[k]
    nights.push(row)
  }
  const manual: Record<string, { value: string; day: string }> = {}
  // short numbers only: the old food log and medicine list ride in these rows as JSON and say nothing an AI can use
  for (const ev of sorted) {
    const key = str(ev.payload?.key)
    const value = str(ev.payload?.value)
    if ((ev.type === 'metric' || ev.type === 'health') && value.length > 0 && value.length <= 12 && !/^(foods|meds|water|waterAt)$/.test(key) && !/^[[{]/.test(value)) manual[`${ev.type}:${key}`] = { value, day: ev.day }
  }
  return { nights, manual }
}

function arborView(state: ReturnType<typeof foldArbor>, today: string, from: string): ArborView {
  const { plan, frozen } = arborPlan(SKILLS, state, today)
  const ranks: Record<string, number> = {}
  for (const s of SKILLS) {
    const r = ARBOR_RANKS[arborRank(s, state.progress[s.id])]
    ranks[r] = (ranks[r] ?? 0) + 1
  }
  const show = (id: string): string => {
    const s = SKILL_BY_ID.get(id)
    if (!s) return ''
    const v = valueOf(s, state.progress[id])
    return s.unit ? `${v} ${s.unit}` : `tier ${v}`
  }
  const inProgress = SKILLS.filter((s) => arborRank(s, state.progress[s.id]) === 2).map((s) => ({ skill: s.name, branch: s.branch, value: show(s.id) }))
  const mastered = SKILLS.filter((s) => arborRank(s, state.progress[s.id]) === 3).map((s) => s.name)
  const recentBests = Object.entries(state.progress)
    .filter(([id, r]) => r.at && r.at.slice(0, 10) >= from && SKILL_BY_ID.has(id))
    .sort((a, b) => ((b[1].at ?? '') < (a[1].at ?? '') ? -1 : 1))
    .slice(0, 20)
    .map(([id, r]) => ({ day: (r.at ?? '').slice(0, 10), skill: SKILL_BY_ID.get(id)!.name, value: show(id), rank: ARBOR_RANKS[arborRank(SKILL_BY_ID.get(id)!, r)] }))
  const practicedDays: Record<string, number> = {}
  for (const [day, rec] of Object.entries(state.practice)) {
    const n = Object.values(rec).filter((x) => x.done).length
    if (day >= from && n) practicedDays[day] = n
  }
  return {
    today: {
      morning: plan.morning.map((id) => ({ skill: SKILL_BY_ID.get(id)?.name ?? id, target: SKILL_BY_ID.get(id) ? targetFor(SKILL_BY_ID.get(id)!, state.progress) : '', done: Boolean(state.practice[today]?.[id]?.done) })),
      gym: plan.gym.map((id) => SKILL_BY_ID.get(id)?.name ?? id),
      frozen,
    },
    ranks,
    inProgress,
    mastered,
    recentBests,
    practicedDays,
  }
}

function shedView(state: ReturnType<typeof foldShed>, today: string, from: string): ShedView {
  const { plan, frozen } = shedPlan(ITEMS, state, today)
  const ranks: Record<string, number> = {}
  const learning: ShedView['learning'] = []
  const owned: string[] = []
  for (const it of ITEMS) {
    const st = statsOf(it, state)
    const r = shedRank(it, st)
    ranks[SHED_RANKS[r]] = (ranks[SHED_RANKS[r]] ?? 0) + 1
    if (r === 3) owned.push(it.name)
    else if (st.days > 0) learning.push({ item: it.name, days: st.days, bestBpm: st.best, ...(it.target ? { target: it.target } : {}) })
  }
  const recent: ShedView['recent'] = []
  const byDay: Record<string, string[]> = {}
  for (const [id, logs] of Object.entries(state.logs)) for (const [day, log] of Object.entries(logs)) if (day >= from && log.done) (byDay[day] ??= []).push(`${ITEM_BY_ID.get(id)?.name ?? id}${log.feel !== undefined ? ` (${FEEL_NAME[log.feel]}${log.bpm ? `, ${log.bpm} bpm` : ''})` : ''}`)
  for (const day of Object.keys(byDay).sort()) recent.push({ day, items: byDay[day] })
  return {
    today: plan.map((id) => {
      const it = ITEM_BY_ID.get(id)
      const log = state.logs[id]?.[today]
      return { item: it?.name ?? id, kind: it?.kind ?? '', done: Boolean(log?.done), ...(log?.feel !== undefined ? { feel: FEEL_NAME[log.feel] } : {}), ...(log?.bpm ? { bpm: log.bpm } : {}), ...(it?.target ? { target: it.target } : {}) }
    }),
    frozen,
    ranks,
    learning: learning.sort((a, b) => b.days - a.days).slice(0, 20),
    owned: owned.slice(0, 40),
    recent,
  }
}

// ── writing it out ──────────────────────────────────────────────────────────

const HOW_TO_READ = `This is a read-only snapshot of one person's life-tracking system ("Life OS"), built live from its event ledger. The numbers are the same ones its screens show.

The system is a set of small apps that share one append-only ledger:
- **Life OS** — the daily habit checklist, the monthly graph, a Sunday-only reset list and a month-end review. Habits have tiers (pillar = big, core, standard, basic) and a domain (code, fitness, arbor, guitar, sleep, routine).
- **Strong** — gym logging; finishing a workout ticks the Gym habit.
- **Arbor** — a calisthenics skill tree; each morning it picks skills to practise.
- **Woodshed** — guitar practice; each day it picks a session of drills and song parts.
- **Pokedex** — a game layer that turns the habits into a partner Pokemon that levels up, a wild Pokemon, gym leaders and a weekly boss. It never asks the user to do anything; it only mirrors the work.
- **The band** (Google Health) — sleep, steps, heart rate and weight, arriving automatically. Sleep counts as a habit only on mornings the band measured it (done at a sleep score of ${SLEEP_DONE} or more).

Dates are the owner's local calendar dates. "Missed" means the habit was on that day's checklist and was not ticked. Days before the user's first tick are left out.`

const ALL: Section[] = [...SECTIONS]

export function renderMarkdown(s: Snapshot, sections: Section[] = ALL): string {
  const want = new Set(sections)
  const out: string[] = []
  const w = (...l: string[]) => out.push(...l)
  w(`# Life OS snapshot — ${s.weekday} ${s.today}`, '', `Generated ${s.generatedAt} (time zone ${s.timezone}). History window: ${s.window.from} to ${s.today} (${s.window.days} days requested). ${s.freshness.events} ledger events; newest written ${s.freshness.latestEventInsertedAt ?? 'never'}${s.redacted ? '. Health data (the band, weight and Sleep) is left out of this view on request.' : `; latest band sleep reading is for ${s.freshness.latestBandDay ?? 'none'}.`}`, '')
  if (sections.length === ALL.length) w('## How to read this', '', HOW_TO_READ, '')

  if (want.has('today')) {
    const t = s.today_
    w(`## Today (${s.weekday} ${t.day}): ${t.done}/${t.total} done`, '')
    for (const i of t.items) w(`- [${i.done ? 'x' : ' '}] ${i.name} — ${i.tier}${i.domain ? `, ${i.domain}` : ''}${i.note ? ` (${i.note})` : ''}`)
    if (t.sunday) {
      w('', 'Sunday reset (one-off tasks, no XP):')
      for (const k of t.sunday) w(`- [${k.done ? 'x' : ' '}] ${k.name}`)
    } else w('', '(The Sunday reset list is hidden Monday to Saturday.)')
    w('')
  }

  if (want.has('habits')) {
    w(`## Day by day (${s.window.from} to ${s.today})`, '', '| Day | Done | % | XP | Detail |', '|---|---|---|---|---|')
    // name whichever side is shorter, so a poor day does not list thirty misses
    const detail = (d: Snapshot['days'][number]): string => (d.day === s.today ? '(today in progress)' : d.perfect ? '' : d.missed.length <= d.ticked.length ? `missed: ${d.missed.join(', ')}` : `only ticked: ${d.ticked.join(', ')}`)
    for (const d of s.days) w(`| ${d.weekday} ${d.day} | ${d.done}/${d.total}${d.perfect ? ' ★' : ''} | ${d.pct} | ${d.xp ?? ''} | ${detail(d)} |`)
    w('', '★ = every habit done. The Detail column names the shorter side: what was missed, or, on a poor day, the only habits ticked.', '', `## Each habit over the same window`, '', '| Habit | Tier | Done / active days | % | Streak | Best streak |', '|---|---|---|---|---|---|')
    for (const h of s.habits) w(`| ${h.name}${h.live ? '' : ' (switched off)'} | ${h.tier} | ${h.doneDays}/${h.activeDays} | ${h.pct} | ${h.streak} | ${h.bestStreak} |`)
    w('')
  }

  if (want.has('months')) {
    w('## Months', '', '| Month | Completion % | Source |', '|---|---|---|')
    for (const m of s.months) w(`| ${m.ym} | ${m.pct} | ${m.source === 'running' ? `running (${m.days} days so far)` : m.source === 'legacy' ? 'earlier tracker' : 'sealed'} |`)
    const last = [...s.months].reverse().find((m) => m.source === 'sealed' && m.habits.length)
    if (last) {
      w('', `Per habit in the last sealed month (${last.ym}):`)
      for (const h of last.habits) w(`- ${h.name}: ${h.pct}%`)
    }
    w('')
  }

  if (want.has('game')) {
    const g = s.game
    w('## The game (Pokedex)', '', g.rulesNote, '')
    w(`- Partner: **${g.partner.name}** level ${g.partner.level} (${Math.round(g.partner.xpInto)}/${Math.round(g.partner.xpNeed)} XP)${g.partner.shiny ? ', shiny' : ''}; next: ${g.next}.`)
    w(`- Today: ${g.todayResult.done}/${g.todayResult.total} habits, ${g.todayResult.xp} XP, pillars ${g.todayResult.pillars}${g.todayResult.perfect ? ', perfect day' : ''}. Momentum: ${g.momentum.daysCounted} of the last 7 days counted, ×${g.momentum.multiplier}. Perfect days so far: ${g.perfectDays}.`)
    w(`- Wallet: ${g.wallet.coins} coins, ${g.wallet.gems} gems; ${g.heldRewards} reward(s) waiting to be collected.`)
    if (g.league) w(`- Gym league: ${g.league.name}${g.league.waiting ? ' (region not open yet)' : `, facing ${g.league.leader} (${g.league.type}), HP ${g.league.hp}/${g.league.hpMax}`}; leagues beaten: ${g.league.leadersBeaten}.`)
    if (g.wild) w(`- Wild Pokemon: ${g.wild.name} (${g.wild.rarity}), HP ${g.wild.hp}/${g.wild.hpMax}${g.wild.leavesInDays !== null ? `, leaves in ${g.wild.leavesInDays} days` : ''}.`)
    if (g.boss) {
      w(`- Weekly boss: ${g.boss.name} level ${g.boss.level}${g.boss.mega ? ' (Mega)' : ''}, HP ${g.boss.hpLeft}/${g.boss.hpMax}, ${g.boss.daysLeft} day(s) left${g.boss.allTasksDone ? ', card complete' : ''}.`)
      for (const t of g.boss.tasks) w(`  - ${t.text} — ${t.progress}%`)
    } else w('- Weekly boss: none this week.')
    w(`- Team behind the partner: ${g.team.length ? g.team.join(', ') : 'empty'}. Fully trained: ${g.graduated}. In the Box waiting: ${g.boxWaiting}. Pokedex: ${g.dex.owned} owned, ${g.dex.seen} seen.`)
    if (g.egg) w(`- Egg warming: ${g.egg.have}/${g.egg.need} steps.`)
    if (g.streaks.length) w(`- Runs of days by kind of work (current/best): ${g.streaks.map((r) => `${r.id} ${r.current}/${r.best}`).join(', ')}.`)
    if (g.quests.length) w(`- Weekly quests: ${g.quests.map((q) => `${q.name} ${q.done ? '✓' : `${q.have}/${q.need}`}`).join('; ')}.`)
    for (const x of g.warnings) w(`- Warning: ${x}`)
    w('')
  }

  if (want.has('body')) {
    w('## Body (the band, plus hand-entered numbers)', '')
    if (!s.body.nights.length) w('No band readings in this window.', '')
    else {
      const cols = BODY_KEYS.filter((k) => s.body.nights.some((n) => n[k] !== undefined))
      w(`| Day | ${cols.join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`)
      for (const n of s.body.nights) w(`| ${n.day} | ${cols.map((k) => (k === 'sleepMin' || k === 'deepMin' || k === 'remMin' || k === 'lightMin' || k === 'awakeMin' ? hm(num(n[k])) : n[k] === undefined ? '' : String(n[k]))).join(' | ')} |`)
      w('', 'A night is filed under the morning it ended. Sleep columns are hours and minutes; bed/wake are local times.', '')
    }
    const man = Object.entries(s.body.manual)
    if (man.length) w('Latest hand-entered values (older than the band, from the earlier version of the app): ' + man.map(([k, v]) => `${k.split(':')[1]} ${v.value} (${v.day})`).join(', ') + '.', '')
  }

  if (want.has('arbor')) {
    const a = s.arbor
    w('## Arbor (calisthenics skill tree)', '', `Skills by rank: ${Object.entries(a.ranks).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '', `Today's morning plan${a.today.frozen ? '' : ' (not yet frozen by an app)'}:`)
    for (const m of a.today.morning) w(`- [${m.done ? 'x' : ' '}] ${m.skill}${m.target ? ` — ${m.target}` : ''}`)
    if (a.today.gym.length) w('', `Gym-day skills to add: ${a.today.gym.join(', ')}.`)
    if (a.inProgress.length) w('', 'In progress:', ...a.inProgress.slice(0, 40).map((x) => `- ${x.skill} (${x.branch}): ${x.value}`))
    if (a.mastered.length) w('', `Mastered (${a.mastered.length}): ${a.mastered.join(', ')}.`)
    if (a.recentBests.length) w('', 'Recently changed bests:', ...a.recentBests.map((x) => `- ${x.day} ${x.skill}: ${x.value} (${x.rank})`))
    const pd = Object.entries(a.practicedDays)
    if (pd.length) w('', `Skills practised per day: ${pd.map(([d, n]) => `${d.slice(5)}:${n}`).join(' ')}.`)
    w('')
  }

  if (want.has('woodshed')) {
    const g = s.woodshed
    w('## Woodshed (guitar)', '', `Items by rank: ${Object.entries(g.ranks).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '', `Today's session${g.frozen ? '' : ' (not yet frozen by an app)'}:`)
    for (const i of g.today) w(`- [${i.done ? 'x' : ' '}] ${i.item} (${i.kind})${i.feel ? ` — ${i.feel}${i.bpm ? `, ${i.bpm} bpm` : ''}` : ''}${i.target ? `, target ${i.target} bpm` : ''}`)
    if (g.learning.length) w('', 'Being learned (days practised, best clean tempo):', ...g.learning.map((x) => `- ${x.item}: ${x.days} days, best ${x.bestBpm || '–'}${x.target ? ` / ${x.target}` : ''}`))
    if (g.owned.length) w('', `Owned: ${g.owned.join(', ')}.`)
    if (g.recent.length) w('', 'Practised recently:', ...g.recent.map((r) => `- ${r.day}: ${r.items.join('; ')}`))
    w('')
  }

  if (want.has('workouts')) {
    w('## Workouts (Strong)', '')
    if (!s.workouts.length) w('No workouts logged in this window.', '')
    for (const x of s.workouts) {
      w(`### ${x.day} — ${x.name}`, `${[x.durationMin !== undefined ? `${Math.round(x.durationMin)} min` : '', x.sets !== undefined ? `${x.sets} sets` : '', x.volumeKg !== undefined ? `${Math.round(x.volumeKg)} kg volume` : '', x.muscles?.length ? x.muscles.join(', ') : ''].filter(Boolean).join(' · ')}`)
      for (const e of x.exercises) w(`- ${e}`)
      w('')
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

export const renderJson = (s: Snapshot, sections: Section[] = ALL): string => {
  const keep: Record<string, unknown> = { generatedAt: s.generatedAt, timezone: s.timezone, today: s.today, weekday: s.weekday, window: s.window, redactedHealth: s.redacted, freshness: s.redacted ? { events: s.freshness.events, latestEventInsertedAt: s.freshness.latestEventInsertedAt } : s.freshness }
  const map: Record<Section, [string, unknown]> = {
    today: ['today', s.today_],
    habits: ['habits', { days: s.days, habits: s.habits }],
    months: ['months', s.months],
    game: ['game', s.game],
    body: ['body', s.body],
    arbor: ['arbor', s.arbor],
    woodshed: ['woodshed', s.woodshed],
    workouts: ['workouts', s.workouts],
  }
  for (const sec of sections) keep[map[sec][0]] = map[sec][1]
  return JSON.stringify(keep, null, 2)
}
