// Habit types, XP tiers and defaults.
//
// A habit is a registry entry with a list of live spans. Spans exist for one
// job only: scoring the *current* month, where a habit added on the 20th must
// not read as nineteen misses. Finished months don't use them — they are frozen
// into month snapshots (lib/monthSnapshot.ts), which is what makes deleting a
// habit safe: the past is already written down elsewhere.
//
// Ids must stay stable for the life of a habit — they key tick events in the
// append-only cloud ledger.

export type Tier = 'core' | 'standard' | 'basic'

/**
 * One stretch of days a habit was live: `[from, to)` — `to === null` means
 * still running. Half-open so archiving on day D makes D the first dead day
 * and no span ever claims a day twice.
 */
export interface Span {
  from: string // YYYY-MM-DD
  to: string | null // YYYY-MM-DD, exclusive
}

export interface Habit {
  id: string
  name: string
  emoji: string
  tier: Tier
  spans: Span[] // chronological, non-overlapping; only the last may be open
}

/** Stand-in start day for habits that predate span tracking — "always existed". */
export const EPOCH_DAY = '1970-01-01'

/** Fill in spans on a habit read from an old localStorage blob or cloud event. */
export function migrateHabit(h: Habit): Habit {
  if (Array.isArray(h.spans) && h.spans.length > 0) return h
  return { ...h, spans: [{ from: EPOCH_DAY, to: null }] }
}

/** Was this habit on the checklist on `day`? */
export function isActiveOn(h: Habit, day: string): boolean {
  return h.spans.some((s) => day >= s.from && (s.to === null || day < s.to))
}

/** Currently on the checklist (i.e. the newest span is still open). */
export function isLive(h: Habit): boolean {
  return h.spans.length > 0 && h.spans[h.spans.length - 1].to === null
}

/** First day the habit ever counted. */
export function firstDay(h: Habit): string {
  return h.spans[0]?.from ?? EPOCH_DAY
}

/** Put a habit back on the checklist from `day` onward. No-op when already live. */
export function activateOn(h: Habit, day: string): Habit {
  if (isLive(h)) return h
  const last = h.spans[h.spans.length - 1]
  // Re-activating on the same day it was switched off just reopens that span, so
  // a mis-tap never leaves a zero-length dead interval behind.
  if (last && last.to === day) {
    const spans = h.spans.slice(0, -1).concat({ from: last.from, to: null })
    return { ...h, spans }
  }
  return { ...h, spans: [...h.spans, { from: day, to: null }] }
}

/** Take a habit off the checklist from `day` onward (day itself no longer counts). */
export function archiveOn(h: Habit, day: string): Habit {
  if (!isLive(h)) return h
  const last = h.spans[h.spans.length - 1]
  // Created and switched off the same day → the span never covered a day; drop it.
  const spans =
    last.from >= day
      ? h.spans.slice(0, -1)
      : h.spans.slice(0, -1).concat({ from: last.from, to: day })
  return { ...h, spans }
}

/** The day a habit was last switched off, or null when it is live / never ran. */
export function archivedOn(h: Habit): string | null {
  if (isLive(h) || h.spans.length === 0) return null
  return h.spans[h.spans.length - 1].to
}

// Economy v2 (2026-07-09): essentials are table stakes, not needle-movers —
// basic pays 1 XP so brushing your teeth can't out-earn real work.
export const TIER_XP: Record<Tier, number> = {
  core: 20,
  standard: 10,
  basic: 1,
}

export const TIERS: Tier[] = ['core', 'standard', 'basic']

const BASE_HABITS: Omit<Habit, 'spans'>[] = [
  { id: 'cat-prep', name: 'CAT prep', emoji: '📚', tier: 'core' },
  { id: 'gym', name: 'Gym', emoji: '🏋️', tier: 'core' },
  { id: 'morning-walk', name: 'Morning walk 5K', emoji: '🌞', tier: 'core' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', tier: 'core' },

  { id: 'pushups-pullups', name: 'Push-ups / pull-ups', emoji: '💪', tier: 'standard' },
  { id: 'stretching', name: 'Stretching / calisthenics', emoji: '🤸', tier: 'standard' },
  { id: 'night-walk', name: 'Night walk 5K', emoji: '🌙', tier: 'standard' },
  { id: 'protein', name: 'Protein', emoji: '🥚', tier: 'standard' },
  { id: 'fiber', name: 'Fiber — chia / isabgol / bran', emoji: '🌾', tier: 'standard' },
  { id: 'reading', name: 'Reading', emoji: '📖', tier: 'standard' },
  { id: 'english-shadowing', name: 'English shadowing', emoji: '🗣️', tier: 'standard' },
  { id: 'whiteboard-tasks', name: 'Whiteboard tasks', emoji: '📝', tier: 'standard' },
  { id: 'work-diary', name: 'Work diary + planning', emoji: '📔', tier: 'standard' },
  { id: 'family-time', name: 'Family time', emoji: '👨‍👩‍👧', tier: 'standard' },

  { id: 'fresh-brush', name: 'Fresh + brush', emoji: '🪥', tier: 'basic' },
  { id: 'weigh-in', name: 'Weigh-in', emoji: '⚖️', tier: 'basic' },
  { id: 'skincare', name: 'Skincare', emoji: '🧴', tier: 'basic' },
  { id: 'green-tea', name: 'Green tea / moringa', emoji: '🍵', tier: 'basic' },
  { id: 'bath', name: 'Bath', emoji: '🛁', tier: 'basic' },
]

// The seed list has always been live — spans start at the epoch so no early
// history is ever greyed out as "not a habit yet".
export const DEFAULT_HABITS: Habit[] = BASE_HABITS.map((h) => ({
  ...h,
  spans: [{ from: EPOCH_DAY, to: null }],
}))

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Id for a freshly created habit. Falls back to a suffix when the slug collides. */
export function habitIdFor(name: string, taken: Iterable<string> = []): string {
  const base = slugify(name) || 'habit'
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}
