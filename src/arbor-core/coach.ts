// The coach: decides which skills to practise today.
//
// Design rules (from how it is meant to be used):
//  • Progress at your own speed. The "working set" is derived from progress
//    alone, so it only changes when you actually move a skill forward.
//  • No novelty for its own sake. Within the working set, a day picks the
//    skills practised longest ago — by what you logged, not by the calendar —
//    so a missed day (or week) reshuffles nothing.
//  • Don't sabotage the gym session. The morning block skips whatever the gym
//    trains hard that evening; gym add-ons are drawn from that day's theme.
//  • Old skills stay alive. At most one mastered skill that has gone stale is
//    slipped in per day.
import { GOALS, STRICT, WORKING_SIZE, canDo, categoryOf, gymOnly, type Category, type Where } from './meta.ts'
import { rankOf, valueOf, type ArborState, type DayPlan, type Progress, type Rank, type Skill } from './model.ts'
import { gymDayFor } from './schedule.ts'

const STALE_DAYS = 30
/** push / pull / legs skills get at least one full day off between sessions */
const REST_DAYS = 2
const STRENGTH: Category[] = ['push', 'pull', 'legs']
const MORNING_SLOTS = 5
const GYM_SLOTS = 2

interface Graph {
  byId: Map<string, Skill>
  children: Map<string, string[]>
  /** steps from each skill up to the nearest goal it leads to (0 = is a goal) */
  goalDist: Map<string, number>
}

const graphs = new WeakMap<Skill[], Graph>()
function graphOf(skills: Skill[]): Graph {
  let g = graphs.get(skills)
  if (g) return g
  const byId = new Map(skills.map((s) => [s.id, s]))
  const children = new Map<string, string[]>()
  for (const s of skills) for (const r of s.req) children.set(r, [...(children.get(r) ?? []), s.id])
  const goalDist = new Map<string, number>()
  const walk = (id: string, d: number) => {
    if ((goalDist.get(id) ?? Infinity) <= d) return
    goalDist.set(id, d)
    for (const r of byId.get(id)?.req ?? []) walk(r, d + 1)
  }
  for (const goal of GOALS) if (byId.has(goal)) walk(goal, 0)
  g = { byId, children, goalDist }
  graphs.set(skills, g)
  return g
}

export interface Analysis {
  rank: Map<string, Rank>
  /** a harder skill built on this one is already unlocked — no need to drill it */
  superseded: Set<string>
}

export function analyse(skills: Skill[], progress: Progress): Analysis {
  const g = graphOf(skills)
  const rank = new Map<string, Rank>(skills.map((s) => [s.id, rankOf(s, progress[s.id])]))
  const superseded = new Set<string>()
  const mark = (id: string) => {
    for (const r of g.byId.get(id)?.req ?? []) {
      if (!superseded.has(r)) { superseded.add(r); mark(r) }
    }
  }
  for (const s of skills) if ((rank.get(s.id) ?? 0) >= 1) mark(s.id)
  return { rank, superseded }
}

/** Prerequisite satisfied: you've hit its entry criterion, or a harder skill you already have implies it. */
const cleared = (a: Analysis, id: string) => (a.rank.get(id) ?? 0) >= 1 || a.superseded.has(id)

/** Trainable right now: started, or every prerequisite is cleared; never out-of-scope, mastered or superseded. */
export function trainable(skills: Skill[], progress: Progress): Skill[] {
  const a = analyse(skills, progress)
  return skills.filter((s) => {
    const r = a.rank.get(s.id) ?? 0
    if (r >= 3 || categoryOf(s) === 'out') return false
    if (r >= 1) return true // you've logged it: keep building it
    if (STRICT.has(s.id)) return s.req.every((id) => (a.rank.get(id) ?? 0) >= 2)
    return !a.superseded.has(s.id) && s.req.every((id) => cleared(a, id))
  })
}

function score(s: Skill, a: Analysis, g: Graph): number {
  const d = g.goalDist.get(s.id)
  const r = a.rank.get(s.id) ?? 0
  return (d == null ? 0 : d === 0 ? 100 : 60 / d) + (r === 2 ? 25 : r === 1 ? 15 : 0) + (s.star ? 10 : 0) + (s.kind === 'foundation' ? 5 : 0)
}

/**
 * The skills currently in rotation: the best few per category. Depends only on
 * progress, so it is stable from day to day until something is mastered.
 */
export function workingSet(skills: Skill[], progress: Progress): Skill[] {
  const g = graphOf(skills)
  const a = analyse(skills, progress)
  const ranked = trainable(skills, progress)
    .map((s) => ({ s, v: score(s, a, g) }))
    .sort((x, y) => y.v - x.v || x.s.id.localeCompare(y.s.id))
  const taken: Record<string, number> = {}
  const out: Skill[] = []
  for (const { s } of ranked) {
    const c = categoryOf(s)
    // gym-only skills get their own small quota so home work can't crowd them out (and vice versa)
    const key = c === 'bar' || !gymOnly(s) ? c : c + ':gym'
    const cap = key === c ? WORKING_SIZE[c] : 1
    const n = taken[key] ?? 0
    if (n >= cap) continue
    taken[key] = n + 1
    out.push(s)
  }
  return out
}

const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000)

/** Longest-ago-practised first; never practised counts as oldest. Ties keep working-set order. */
function byRest(list: Skill[], progress: Progress): Skill[] {
  return list
    .map((s, i) => ({ s, i, last: progress[s.id]?.practiced ?? '' }))
    .sort((x, y) => (x.last < y.last ? -1 : x.last > y.last ? 1 : x.i - y.i))
    .map((x) => x.s)
}

/** Compute the plan for `day` from scratch. Deterministic for a given state. */
export function planDay(skills: Skill[], state: ArborState, day: string): DayPlan {
  const progress = state.progress
  const gym = gymDayFor(day)
  const work = workingSet(skills, progress)
  const rested = (s: Skill) => {
    const last = progress[s.id]?.practiced
    return !STRENGTH.includes(categoryOf(s)) || !last || daysBetween(last, day) >= REST_DAYS
  }
  const pick = (pool: Skill[], cat: Category, where: Where, used: Set<string>) =>
    byRest(pool.filter((s) => categoryOf(s) === cat && canDo(s, where) && !used.has(s.id) && rested(s)), progress)[0]

  // ── morning, at home ──
  const used = new Set<string>()
  const morning: string[] = []
  const add = (s: Skill | undefined) => { if (s && morning.length < MORNING_SLOTS) { morning.push(s.id); used.add(s.id) } }
  const strength = STRENGTH.filter((c) => !gym.avoid.includes(c))
  add(pick(work, 'balance', 'home', used))
  for (const c of strength) add(pick(work, c, 'home', used))
  if (!gym.avoid.includes('core')) add(pick(work, 'core', 'home', used))
  add(pick(work, 'mobility', 'home', used))
  // room left (e.g. two strength categories were off-limits): top up with whatever has rested longest
  for (const s of byRest(work.filter((x) => canDo(x, 'home') && !used.has(x.id) && !gym.avoid.includes(categoryOf(x)) && categoryOf(x) !== 'bar' && rested(x)), progress)) add(s)

  // one stale mastered skill, so old skills don't rot
  const a = analyse(skills, progress)
  const stale = skills
    .filter((s) => a.rank.get(s.id) === 3 && !a.superseded.has(s.id) && categoryOf(s) !== 'out' && canDo(s, 'home') && !gym.avoid.includes(categoryOf(s)))
    .map((s) => ({ s, last: progress[s.id]?.practiced ?? (progress[s.id]?.at ?? '').slice(0, 10) }))
    .filter((x) => x.last && daysBetween(x.last, day) > STALE_DAYS)
    .sort((x, y) => (x.last < y.last ? -1 : 1))[0]
  if (stale) {
    if (morning.length >= MORNING_SLOTS) used.delete(morning.pop() as string)
    morning.push(stale.s.id)
    used.add(stale.s.id)
  }

  // ── gym add-ons: only what needs the gym (bars with clearance, rings, dip bars) ──
  const gymPicks: string[] = []
  for (const c of gym.addon) {
    for (const s of byRest(work.filter((x) => categoryOf(x) === c && gymOnly(x) && !used.has(x.id) && rested(x)), progress)) {
      if (gymPicks.length >= GYM_SLOTS) break
      gymPicks.push(s.id)
      used.add(s.id)
    }
  }
  return { morning, gym: gymPicks }
}

/** Today's plan: the frozen one if a device already published it, else freshly computed. */
export function planFor(skills: Skill[], state: ArborState, day: string): { plan: DayPlan; frozen: boolean } {
  const saved = state.plans[day]
  return saved ? { plan: { morning: saved.morning, gym: saved.gym }, frozen: true } : { plan: planDay(skills, state, day), frozen: false }
}

/** One line telling you what to aim for. */
export function targetFor(skill: Skill, progress: Progress): string {
  const rec = progress[skill.id]
  if (skill.unit && skill.t) {
    const cur = valueOf(skill, rec)
    const next = skill.t.find((x) => x > cur)
    if (next == null) return `Hold ${skill.t[2]} ${skill.unit} — keep it sharp`
    return cur > 0 ? `Beat ${cur} ${skill.unit} · next tier at ${next}` : `First target: ${skill.t[0]} ${skill.unit}`
  }
  const lvl = valueOf(skill, rec)
  const t = skill.tiers
  if (!t) return ''
  return lvl >= 3 ? `Keep: ${t.m}` : [t.u, t.p, t.m][lvl]
}

export const TIER_NAME = ['Locked', 'Unlocked', 'In progress', 'Mastered'] as const
