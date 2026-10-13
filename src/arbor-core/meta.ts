// What the coach needs to know about skills beyond the tree itself: which
// kind of training slot a skill fills, where it can be done, and what you are
// ultimately training toward.
import type { Skill } from './model.ts'

export type Category = 'push' | 'pull' | 'core' | 'legs' | 'balance' | 'mobility' | 'bar' | 'out'

const BRANCH_CATEGORY: Record<string, Category> = {
  'Physical Foundations': 'core',
  'Horizontal Push': 'push',
  'Vertical Push': 'push',
  'Horizontal Pull': 'pull',
  'Vertical Pull': 'pull',
  'Bar Dynamics': 'bar',
  Core: 'core',
  Legs: 'legs',
  'Mobility Foundations': 'mobility',
  Flexibility: 'mobility',
  'Yoga Holds': 'mobility',
  'Arm Balances': 'balance',
  // Movement arts are not calisthenics: browsable in the tree, never auto-suggested.
  'Acrobatics Foundations': 'out',
  Kicks: 'out',
  'Flips & Twists': 'out',
  Breaking: 'out',
  Dance: 'out',
}

// Handstand-line work lives under "Vertical Push" in the tree but trains
// balance, not pressing strength — it can go on any day.
const BALANCE = new Set([
  'crow-pose', 'assisted-handstand', 'wall-handstand', 'wall-line-drill', 'handstand-bail', 'toe-pulls',
  'freestanding-kickups', 'handstand-shape', 'handstand', 'press-to-handstand', 'one-arm-handstand',
  'headstand', 'forearm-stand', 'shoulder-stand', 'elbow-lever',
])

export function categoryOf(s: Skill): Category {
  if (BALANCE.has(s.id)) return 'balance'
  return BRANCH_CATEGORY[s.branch] ?? 'out'
}

export type Where = 'home' | 'gym'

// Needs rings, dip bars, a pole, a rope, or a high bar with clearance — gym only.
// Everything else works at home with a pull-up bar, parallettes and a mat.
const GYM_ONLY = new Set([
  'rto-support-hold', 'rto-dip', 'straight-arm-rto-dip', 'iron-cross-fly', 'iron-cross', 'maltese', 'victorian-cross', 'pelican-curl',
  'dip', 'weighted-dip', 'chest-dip', 'archer-dip', 'bulgarian-dip', 'korean-dip', 'elbow-dip', 'russian-dip', 'impossible-dip',
  'straight-bar-dip', 'support-hold',
  'rope-climb', 'pullover', 'waist-pullup', 'false-grip-transition', 'banded-muscle-up-transition', 'muscle-up-negative',
  'muscle-up', 'strict-muscle-up',
  'dead-hang-human-flag', 'tuck-human-flag', 'straddle-human-flag', 'human-flag',
  'german-hang', 'skin-the-cat', 'back-lever-skin-cat-volume',
])

export const canDo = (s: Skill, where: Where): boolean =>
  where === 'gym' ? true : !(GYM_ONLY.has(s.id) || s.branch === 'Bar Dynamics')

export const gymOnly = (s: Skill): boolean => !canDo(s, 'home')

/** What all of this is for. Skills on the path to these are trained first. */
export const GOALS = [
  'muscle-up', 'handstand', 'lsit', 'elbow-lever', 'skin-the-cat', 'german-hang', 'weighted-pullup',
  'pistol-squat', 'pull-360', 'monkey-bar-traverse', 'pancake', 'pushup',
]

/** How many skills of each category stay "in rotation" at once. */
export const WORKING_SIZE: Record<Category, number> = {
  push: 2, pull: 2, core: 2, legs: 1, balance: 3, mobility: 2, bar: 2, out: 0,
}

/**
 * Loading a movement needs a real base, not just the entry criterion: these
 * only open once every prerequisite is "in progress" or better.
 */
export const STRICT = new Set(['weighted-pullup', 'weighted-dip', 'oap-negative', 'oac-negative', 'oap-eccentric'])
