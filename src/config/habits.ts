// Habit list + XP tiers. Authority: vault → wiki/outputs/lifeos-master-plan.md
// Ids must stay stable forever — they key the event ledger and the vault write-back.

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

export const HABITS: Habit[] = [
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
