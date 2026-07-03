// Habit types, XP tiers, defaults, and the vault-template parser.
// Authority chain: templates/daily-template.md (names/emoji/order/membership)
// → habit config events in the ledger → every device. Tiers are app-owned.
// Ids must stay stable forever — they key the event ledger and the vault
// write-back. LEGACY_IDS pins the pre-v0.5 ids; new habits get slugified names.

export type Tier = 'core' | 'standard' | 'basic'

export interface Habit {
  id: string
  name: string
  emoji: string
  tier: Tier
}

export const TIER_XP: Record<Tier, number> = {
  core: 20,
  standard: 10,
  basic: 5,
}

export const DEFAULT_HABITS: Habit[] = [
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

// Pre-v0.5 ids that a plain slug of the name would NOT reproduce. Ticks in the
// ledger are keyed on these — the map keeps history folding onto the right habit.
const LEGACY_IDS: Record<string, string> = {
  'Morning walk 5K': 'morning-walk',
  'Night walk 5K': 'night-walk',
  'Push-ups / pull-ups': 'pushups-pullups',
  'Stretching / calisthenics': 'stretching',
  'Fiber — chia / isabgol / bran': 'fiber',
  'Green tea / moringa': 'green-tea',
  'Work diary + planning': 'work-diary',
}

export const DEFAULT_TIERS: Record<string, Tier> = Object.fromEntries(
  DEFAULT_HABITS.map((h) => [h.id, h.tier]),
)

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
