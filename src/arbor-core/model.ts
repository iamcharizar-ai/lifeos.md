// ARBOR CORE — shared by Arbor, Life OS and Strong.
// Source of truth lives in the arbor repo (core/); `npm run core` copies it
// into the other apps. Pure TypeScript, no DOM, no dependencies.

export interface Skill {
  id: string
  name: string
  branch: string
  family: string
  req: string[]
  /** numeric skills: unit + three thresholds (unlocked / in progress / mastered) */
  unit?: string
  t?: [number, number, number]
  /** rubric skills: a criterion per tier */
  tiers?: { u: string; p: string; m: string }
  star?: boolean
  kind?: string
  note?: string
}

/** 0 locked · 1 unlocked · 2 in progress · 3 mastered */
export type Rank = 0 | 1 | 2 | 3
export const RANK_NAME = ['locked', 'unlocked', 'inprogress', 'mastered'] as const

export interface SkillRec {
  /** current value: reps / seconds / kg for numeric skills */
  cur?: number
  /** tier 0-3 for rubric skills */
  lvl?: number
  /** ISO time of the event that set the value (last-write-wins) */
  at?: string
  /** last day (YYYY-MM-DD) the skill was practised */
  practiced?: string
}

export type Progress = Record<string, SkillRec>

export function rankOf(skill: Skill, rec: SkillRec | undefined): Rank {
  if (skill.unit && skill.t) {
    const cur = rec?.cur ?? 0
    const [u, p, m] = skill.t
    return cur >= m ? 3 : cur >= p ? 2 : cur >= u ? 1 : 0
  }
  return Math.min(3, Math.max(0, rec?.lvl ?? 0)) as Rank
}

export const valueOf = (skill: Skill, rec: SkillRec | undefined): number =>
  skill.unit ? (rec?.cur ?? 0) : (rec?.lvl ?? 0)

// ── ledger events ───────────────────────────────────────────────────────────
// `skill`  payload: { skillId, value?, done? }   value = new cur/lvl; done=false un-marks practice
// `plan`   payload: { morning: JSON string[], gym: JSON string[] }   first one for a day wins
export interface LedgerEvent {
  device: string
  at: string // ISO, client clock
  day: string // YYYY-MM-DD the event belongs to
  type: string
  payload: Record<string, string | number | boolean | null>
  inserted_at?: string
}

export interface ArborState {
  progress: Progress
  /** day → skillId → practised that day */
  practice: Record<string, Record<string, { done: boolean; at: string }>>
  /** day → the frozen plan */
  plans: Record<string, DayPlan & { at: string }>
}

export interface DayPlan {
  morning: string[]
  gym: string[]
}

export const emptyArbor = (): ArborState => ({ progress: {}, practice: {}, plans: {} })

/**
 * Fold skill/plan events into state. Idempotent and order-independent (every
 * field is last-write-wins by `at`, plans are first-write-wins), so replaying
 * the whole ledger on boot or re-applying a page is always safe. Returns the
 * same object when nothing changed.
 */
export function foldArbor(state: ArborState, events: LedgerEvent[]): ArborState {
  let next = state
  const touch = () => {
    if (next === state) next = { progress: { ...state.progress }, practice: { ...state.practice }, plans: { ...state.plans } }
  }
  for (const ev of events) {
    const p = ev.payload ?? {}
    if (ev.type === 'skill') {
      const id = String(p.skillId ?? '')
      // Events from the pre-2026-10 Arbor carried { skillId, status } only: not ours, skip.
      if (!id || (typeof p.value !== 'number' && typeof p.done !== 'boolean')) continue
      if (typeof p.value === 'number') {
        const rec = next.progress[id]
        if (!rec?.at || ev.at > rec.at) {
          touch()
          const isLvl = p.kind === 'lvl'
          next.progress[id] = { ...next.progress[id], ...(isLvl ? { lvl: p.value } : { cur: p.value }), at: ev.at }
        }
      }
      const done = p.done !== false
      const day = next.practice[ev.day]?.[id]
      if (!day || ev.at > day.at) {
        touch()
        next.practice[ev.day] = { ...next.practice[ev.day], [id]: { done, at: ev.at } }
        const rec = next.progress[id] ?? {}
        if (done && (!rec.practiced || ev.day > rec.practiced)) next.progress[id] = { ...rec, practiced: ev.day }
      }
    } else if (ev.type === 'plan') {
      const cur = next.plans[ev.day]
      if (!cur || ev.at < cur.at) {
        try {
          const morning = JSON.parse(String(p.morning ?? '[]')) as string[]
          const gym = JSON.parse(String(p.gym ?? '[]')) as string[]
          if (Array.isArray(morning) && Array.isArray(gym)) {
            touch()
            next.plans[ev.day] = { morning, gym, at: ev.at }
          }
        } catch {
          /* malformed plan — ignore */
        }
      }
    }
  }
  return next
}

export const practicedOn = (s: ArborState, day: string, skillId: string): boolean => Boolean(s.practice[day]?.[skillId]?.done)

export function dayISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
