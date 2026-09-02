// Habit types, XP tiers, defaults, and the vault-template parser.
// Authority chain: templates/daily-template.md (names/emoji/order/membership)
// → habit config events in the ledger → every device. Tiers are app-owned.
// Ids must stay stable forever — they key the event ledger and the vault
// write-back. LEGACY_IDS pins the pre-v0.5 ids; new habits get slugified names.

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

/**
 * A habit is a permanent registry entry, never deleted by an edit — dropping
 * one closes its current span, re-adding opens a new one. Month views read the
 * spans to tell "wasn't a habit yet" (grey) apart from "had it, missed it"
 * (red), which a single active/inactive flag cannot express.
 */
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

/** Was this habit part of the checklist on `day`? */
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
  // Re-activating on the same day it was dropped just reopens that span, so a
  // mis-tap never leaves a zero-length dead interval behind.
  if (last && last.to === day) {
    const spans = h.spans.slice(0, -1).concat({ from: last.from, to: null })
    return { ...h, spans }
  }
  return { ...h, spans: [...h.spans, { from: day, to: null }] }
}

/** Drop a habit off the checklist from `day` onward (day itself no longer counts). */
export function archiveOn(h: Habit, day: string): Habit {
  if (!isLive(h)) return h
  const last = h.spans[h.spans.length - 1]
  // Created and dropped the same day → the span never covered a day; drop it.
  const spans =
    last.from >= day
      ? h.spans.slice(0, -1)
      : h.spans.slice(0, -1).concat({ from: last.from, to: day })
  return { ...h, spans }
}

/** The day a habit was last dropped, or null when it is live / never ran. */
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

// Pre-v0.5 ids that a plain slug of the name would NOT reproduce. Ticks in the
// ledger are keyed on these — the map keeps history folding onto the right habit.
// The 2026-07-04 habit-stack entries map continuing habits onto their old ids
// so streaks survive the rename (per-name keys must match the template EXACTLY
// after the trailing emoji is stripped, inner emoji included).
const LEGACY_IDS: Record<string, string> = {
  'Morning walk 5K': 'morning-walk',
  'Night walk 5K': 'night-walk',
  'Push-ups / pull-ups': 'pushups-pullups',
  'Stretching / calisthenics': 'stretching',
  'Fiber — chia / isabgol / bran': 'fiber',
  'Green tea / moringa': 'green-tea',
  'Work diary + planning': 'work-diary',
  // habit-stack (2026-07-04) continuations
  'Weight ⚖️ / Incense 🔥 / Calendar': 'weigh-in',
  'AM Skincare': 'skincare',
  'Morning Walk 👟 / Sun ☀️ / Day Prep': 'morning-walk',
  'Guitar — session 1': 'guitar',
  'Reading on the taxi': 'reading',
  'Night Walk 5K': 'night-walk',
  'Family Time 🐻 / Dinner': 'family-time',
  'Work Diary 📗 / Plan 💭 / English Shadow': 'work-diary',
  'Bath 🧼 / Brush': 'bath',
  Isabgol: 'fiber',
}

// Demo XP assignment for the 2026-07-04 stack (Rishabh: "you decide the xp by
// importance for my goals"). Keyed by id; only applies to habits the live
// config hasn't seen yet — existing habits keep their app-owned tier.
const STACK_TIERS: Record<string, Tier> = {
  // core 20 XP — moves the mission (PS2 / CAT / LeetCode / cut / discipline)
  'leetcode-1-easy': 'core',
  'ai-dev-time': 'core',
  'day-tasks-9-5': 'core',
  calisthenics: 'core',
  'sleep-before-10': 'core',
  'no-junk-food': 'core',
  'no-goon': 'core',
  // standard 10 XP — training volume & compounding skills
  'push-ups': 'standard',
  'pull-ups': 'standard',
  'lateral-raises': 'standard',
  'l-sit': 'standard',
  'ab-roller': 'standard',
  'guitar-session-2': 'standard',
  'weekly-goal-work': 'standard',
  'green-blend': 'standard',
  'walk-14k-steps': 'standard',
  'logged-work-next-day-plan': 'standard',
  // basic 1 XP — hygiene, fuel, logistics
  'pull-guitar-out': 'basic',
  'make-bed': 'basic',
  'water-1l-morning': 'basic',
  'water-1l-midday': 'basic',
  'water-1l-afternoon': 'basic',
  'water-1l-evening': 'basic',
  'chia-seeds-15g': 'basic',
  breakfast: 'basic',
  lunch: 'basic',
  'eye-drops': 'basic',
  'anime-movie-game': 'basic',
  'pm-skincare': 'basic',
  'creatine-medicine': 'basic',
  'crafts-youtube': 'basic',
}

export const DEFAULT_TIERS: Record<string, Tier> = {
  ...Object.fromEntries(DEFAULT_HABITS.map((h) => [h.id, h.tier])),
  ...STACK_TIERS,
}

// Hydration left the habit stack (2026-07-09) — it lives on the Health tab as
// one water meter now. Ticks keyed on these ids stay in the ledger as history;
// the live list just never shows them again.
export function isWaterHabit(id: string): boolean {
  return /^water-1l/.test(id)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function habitIdFor(name: string): string {
  return LEGACY_IDS[name] ?? slugify(name)
}

/**
 * Parse habit lines out of the daily template's `## Habits` section.
 * Line shape: `- [ ] Name Emoji` — the emoji is the last whitespace-separated
 * token; lines whose last token isn't pictographic keep it as part of the name.
 * Returns null when no Habits section (or zero habits) is found, so a broken
 * template can never wipe the live list.
 */
export function parseTemplateHabits(text: string): { name: string; emoji: string }[] | null {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+Habits\b/i.test(l))
  if (start === -1) return null
  const out: { name: string; emoji: string }[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s/.test(line)) break
    const m = line.match(/^\s*-\s*\[[ xX]\]\s+(.+?)\s*$/)
    if (!m) continue
    const body = m[1]
    const split = body.match(/^(.*\S)\s+(\S+)$/)
    if (split && /\p{Extended_Pictographic}/u.test(split[2])) {
      out.push({ name: split[1], emoji: split[2] })
    } else {
      out.push({ name: body, emoji: '✅' })
    }
  }
  return out.length > 0 ? out : null
}
