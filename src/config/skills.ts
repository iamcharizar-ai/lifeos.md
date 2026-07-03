// Calisthenics & Movement skill DAG. Authority: vault →
//   Mini Notes/Calisthenics Progress.md  (milestone tiers + current states)
//   Mini Notes/2026 Goals.md             (2026 targets, ⭐ priorities)
//   wiki/topics/calisthenics-goals.md    (baselines, long-term bucket list)
//
// GATING LAW (decided 2026-07-04, filed in NOW.md): gates are STRUCTURAL, never
// economic. `locked` means "prerequisites not yet unlocked" — XP never blocks a
// real achievement. 'available' is DERIVED at render time and never stored, so
// the ledger's `skill` event schema and every historical event stay valid.
//
// Legacy ids from v0.3 are preserved verbatim so old ledger events keep folding.

export type SkillStatus = 'locked' | 'training' | 'unlocked' // stored in ledger — do not extend
export type NodeState = SkillStatus | 'available' // derived only — never emitted

export type PathId = 'pull' | 'levers' | 'push' | 'balance' | 'legs' | 'core' | 'moves' | 'craft'

export interface Skill {
  id: string
  name: string
  emoji: string
  path: PathId
  /** prereq skill ids — ALL must be unlocked for this node to become available */
  requires: string[]
  /** [unlock, in-progress, mastery] milestone targets from the vault tracker */
  tiers?: [string, string, string]
  /** 2026 goal line, when the vault sets one */
  goal?: string
  /** ⭐ priority in 2026 Goals */
  star?: boolean
  /** grid position within the path: [row, col 0–2] */
  pos: [number, number]
  initial: SkillStatus
}

export const PATH_META: Record<PathId, { label: string; hint: string; hue: string }> = {
  pull: { label: 'Pull', hint: 'dead hang → explosive muscle-up', hue: '#5b8def' },
  levers: { label: 'Levers', hint: 'hangs → full front lever', hue: '#8b7cff' },
  push: { label: 'Push & Planche', hint: 'push-up → planche', hue: '#ff5c38' },
  balance: { label: 'Balance', hint: 'crow → 20s handstand', hue: '#4ae0d8' },
  legs: { label: 'Legs', hint: 'squat → dragon squat', hue: '#f0b429' },
  core: { label: 'Core', hint: 'hollow body → human flag', hue: '#7bd88a' },
  moves: { label: 'Dynamics & Groove', hint: 'kip up · flips · footwork', hue: '#ff4a8b' },
  craft: { label: 'Dexterity', hint: 'hand skills — side quests', hue: '#8b94a7' },
}

export const SKILLS: Skill[] = [
  // ── PULL ──────────────────────────────────────────────────────────
  { id: 'dead-hang', name: 'Dead hang', emoji: '🪢', path: 'pull', requires: [], tiers: ['45s', '90s', '120s'], goal: '2026 ⭐ 120s', star: true, pos: [0, 1], initial: 'unlocked' },
  { id: 'scapula-pullup', name: 'Scapula pull-up', emoji: '🦴', path: 'pull', requires: ['dead-hang'], tiers: ['5', '10', '15'], pos: [1, 0], initial: 'unlocked' },
  { id: 'inverted-row', name: 'Inverted row', emoji: '🛶', path: 'pull', requires: ['dead-hang'], tiers: ['8', '12', '25'], pos: [1, 2], initial: 'unlocked' },
  { id: 'pull-up', name: 'Pull-up', emoji: '🐒', path: 'pull', requires: ['scapula-pullup'], tiers: ['5', '12', '25'], goal: '2026: 25 (now 8)', pos: [2, 0], initial: 'unlocked' },
  { id: 'rope-climb', name: 'Rope climb', emoji: '🧗', path: 'pull', requires: ['pull-up'], pos: [3, 2], initial: 'unlocked' },
  { id: 'chest-pullup', name: 'Chest pull-up', emoji: '🎯', path: 'pull', requires: ['pull-up'], tiers: ['3', '6', '10'], pos: [3, 0], initial: 'unlocked' },
  { id: 'waist-pullup', name: 'Explosive waist PU', emoji: '💨', path: 'pull', requires: ['chest-pullup'], tiers: ['1', '3', '5'], pos: [4, 1], initial: 'unlocked' },
  { id: 'muscle-up', name: 'Muscle-up', emoji: '💥', path: 'pull', requires: ['waist-pullup'], goal: 'key 2026 milestone', pos: [5, 1], initial: 'training' },
  { id: 'explosive-muscle-up', name: 'Explosive muscle-up', emoji: '🚀', path: 'pull', requires: ['muscle-up'], goal: '2026: 1 clean', pos: [6, 0], initial: 'locked' },
  { id: 'pullover', name: 'Pullover', emoji: '🎡', path: 'pull', requires: ['muscle-up'], goal: '2026: 1', pos: [6, 2], initial: 'locked' },

  // ── LEVERS ────────────────────────────────────────────────────────
  { id: 'active-hang', name: 'Active hang', emoji: '🐵', path: 'levers', requires: [], tiers: ['30s', '45s', '60s'], pos: [0, 0], initial: 'unlocked' },
  { id: 'german-hang', name: 'German hang', emoji: '🙃', path: 'levers', requires: [], tiers: ['20s', '30s', '40s'], pos: [0, 2], initial: 'unlocked' },
  { id: 'skin-the-cat', name: 'Skin the cat', emoji: '🐈', path: 'levers', requires: ['german-hang'], goal: 'done — 1 clean ✅', pos: [1, 2], initial: 'unlocked' },
  { id: 'tuck-fl-row', name: 'Tuck FL row', emoji: '⚙️', path: 'levers', requires: ['active-hang'], tiers: ['3', '6', '12'], pos: [1, 0], initial: 'unlocked' },
  { id: 'tuck-front-lever', name: 'Tuck front lever', emoji: '🏋️', path: 'levers', requires: ['tuck-fl-row'], tiers: ['5s', '10s', '15s'], goal: '15s done ✅', pos: [2, 0], initial: 'unlocked' },
  { id: 'single-leg-fl', name: 'Single-leg tuck FL', emoji: '🦵', path: 'levers', requires: ['tuck-front-lever'], goal: '2026: 15s', pos: [3, 0], initial: 'locked' },
  { id: 'adv-single-leg-fl', name: 'Adv single-leg FL', emoji: '📐', path: 'levers', requires: ['single-leg-fl'], goal: '2026: 15s', pos: [4, 0], initial: 'locked' },
  { id: 'straddle-fl', name: 'Straddle front lever', emoji: '✴️', path: 'levers', requires: ['adv-single-leg-fl'], goal: '2026: 15s', pos: [5, 0], initial: 'locked' },
  { id: 'front-lever', name: 'Full front lever', emoji: '➖', path: 'levers', requires: ['straddle-fl'], goal: '2026: 15s', pos: [6, 1], initial: 'locked' },
  { id: 'tuck-back-lever', name: 'Tuck back lever', emoji: '🔙', path: 'levers', requires: ['skin-the-cat'], goal: '2026: 15s', pos: [2, 2], initial: 'training' },
  { id: 'adv-tuck-bl', name: 'Adv tuck back lever', emoji: '🔧', path: 'levers', requires: ['tuck-back-lever'], goal: '2026: 15s', pos: [3, 2], initial: 'locked' },

  // ── PUSH & PLANCHE ────────────────────────────────────────────────
  { id: 'push-up', name: 'Push-up', emoji: '🫷', path: 'push', requires: [], tiers: ['10', '20', '40'], goal: '2026 ⭐ 40', star: true, pos: [0, 1], initial: 'unlocked' },
  { id: 'dips', name: 'Dips', emoji: '⬇️', path: 'push', requires: ['push-up'], tiers: ['5', '10', '20'], pos: [1, 2], initial: 'unlocked' },
  { id: 'pike-pushup', name: 'Pike push-up', emoji: '🗻', path: 'push', requires: ['push-up'], tiers: ['5', '10', '20'], goal: '2026: 15', pos: [1, 1], initial: 'unlocked' },
  { id: 'pseudo-pushup', name: 'Pseudo push-up', emoji: '🐊', path: 'push', requires: ['push-up'], tiers: ['5', '10', '20'], pos: [1, 0], initial: 'unlocked' },
  { id: 'archer-pushup', name: 'Archer push-up', emoji: '🏹', path: 'push', requires: ['push-up'], goal: '2026: 20', pos: [2, 2], initial: 'locked' },
  { id: 'planche-lean', name: 'Planche lean', emoji: '🪵', path: 'push', requires: ['pseudo-pushup'], tiers: ['10s', '20s', '30s'], goal: '2026: 30s', pos: [2, 0], initial: 'unlocked' },
  { id: 'elbow-lever', name: 'Elbow lever', emoji: '🎚️', path: 'push', requires: ['pseudo-pushup'], tiers: ['5s', '10s', '20s'], goal: '2026: 12s', pos: [2, 1], initial: 'unlocked' },
  { id: 'ninety-pushup', name: '90° push-up', emoji: '🟦', path: 'push', requires: ['archer-pushup', 'planche-lean'], goal: '2026: 1', pos: [3, 1], initial: 'locked' },
  { id: 'planche', name: 'Planche', emoji: '🛩️', path: 'push', requires: ['ninety-pushup'], goal: 'long-term capstone', pos: [4, 1], initial: 'locked' },

  // ── BALANCE ───────────────────────────────────────────────────────
  { id: 'crow-pose', name: 'Crow pose', emoji: '🐦', path: 'balance', requires: [], tiers: ['20s', '40s', '60s'], goal: '60s mastery ✅', pos: [0, 0], initial: 'unlocked' },
  { id: 'one-leg-crow', name: 'One-leg crow', emoji: '🐦‍⬛', path: 'balance', requires: ['crow-pose'], goal: '2026: 10s', pos: [1, 0], initial: 'locked' },
  { id: 'side-crow', name: 'Side crow', emoji: '↩️', path: 'balance', requires: ['crow-pose'], goal: '2026: 15s', pos: [1, 1], initial: 'locked' },
  { id: 'firefly', name: 'Firefly pose', emoji: '🐦‍🔥', path: 'balance', requires: ['one-leg-crow'], goal: '2026: 10s', pos: [2, 0], initial: 'locked' },
  { id: 'shoulder-stand', name: 'Shoulder stand', emoji: '🧍', path: 'balance', requires: [], goal: '2026: 60s', pos: [0, 2], initial: 'locked' },
  { id: 'headstand', name: 'Headstand', emoji: '🙃', path: 'balance', requires: ['shoulder-stand'], goal: '2026: 45s', pos: [1, 2], initial: 'locked' },
  { id: 'forearm-stand', name: 'Forearm stand', emoji: '🦾', path: 'balance', requires: ['headstand'], goal: '2026: 30s', pos: [2, 2], initial: 'locked' },
  { id: 'assisted-handstand', name: 'Assisted handstand', emoji: '🧱', path: 'balance', requires: ['crow-pose'], tiers: ['20s', '45s', '60s'], pos: [2, 1], initial: 'unlocked' },
  { id: 'handstand-10s', name: 'Handstand 10s', emoji: '🤸', path: 'balance', requires: ['assisted-handstand'], goal: 'fix fwd-head posture first', pos: [3, 1], initial: 'training' },
  { id: 'handstand-20s', name: 'Handstand 20s', emoji: '🤸‍♂️', path: 'balance', requires: ['handstand-10s'], goal: '2026: 20s', pos: [4, 1], initial: 'locked' },

  // ── LEGS ──────────────────────────────────────────────────────────
  { id: 'bw-squats', name: 'BW squats ×60', emoji: '🦿', path: 'legs', requires: [], goal: 'done ✅', pos: [0, 1], initial: 'unlocked' },
  { id: 'cossack-squat', name: 'Cossack squat', emoji: '🪑', path: 'legs', requires: ['bw-squats'], goal: '2026: 10', pos: [1, 2], initial: 'locked' },
  { id: 'shrimp-squat', name: 'Shrimp squat', emoji: '🦐', path: 'legs', requires: ['bw-squats'], goal: '2026 ⭐ 12', star: true, pos: [1, 0], initial: 'locked' },
  { id: 'hawaiian-squat', name: 'Hawaiian squat', emoji: '🌴', path: 'legs', requires: ['cossack-squat'], goal: '2026: 12', pos: [2, 2], initial: 'locked' },
  { id: 'sissy-squat', name: 'Sissy squat', emoji: '🐭', path: 'legs', requires: ['shrimp-squat'], goal: '2026: 12', pos: [2, 0], initial: 'locked' },
  { id: 'pistol-squat', name: 'Pistol squat', emoji: '🔫', path: 'legs', requires: ['shrimp-squat', 'cossack-squat'], goal: '2026: 12', pos: [3, 1], initial: 'locked' },
  { id: 'dragon-squat', name: 'Dragon squat', emoji: '🐉', path: 'legs', requires: ['pistol-squat'], goal: '2026: 5', pos: [4, 1], initial: 'locked' },

  // ── CORE ──────────────────────────────────────────────────────────
  { id: 'plank', name: 'Plank 2 min', emoji: '🧱', path: 'core', requires: [], goal: 'done ✅', pos: [0, 1], initial: 'unlocked' },
  { id: 'hollow-body', name: 'Hollow body hold', emoji: '🥣', path: 'core', requires: ['plank'], tiers: ['20s', '40s', '60s'], pos: [1, 1], initial: 'unlocked' },
  { id: 'lsit-compression', name: 'L-sit compression', emoji: '🗜️', path: 'core', requires: ['hollow-body'], tiers: ['10', '20', '30'], pos: [2, 0], initial: 'unlocked' },
  { id: 'l-sit', name: 'L-sit', emoji: '🦶', path: 'core', requires: ['lsit-compression'], tiers: ['10s', '20s', '30s'], goal: '2026 ⭐ 30s', star: true, pos: [3, 0], initial: 'training' },
  { id: 'v-sit', name: 'V-sit', emoji: '🥕', path: 'core', requires: ['l-sit'], goal: '2026: 3s', pos: [4, 0], initial: 'locked' },
  { id: 'toes-to-bar', name: 'Toes to bar', emoji: '🛝', path: 'core', requires: ['hollow-body', 'dead-hang'], goal: '2026: 12', pos: [2, 2], initial: 'locked' },
  { id: 'dragon-flag', name: 'Dragon flag', emoji: '🐲', path: 'core', requires: ['hollow-body'], tiers: ['1', '3', '5'], goal: '2026: 3', pos: [3, 2], initial: 'unlocked' },
  { id: 'human-flag-tuck', name: 'Tuck human flag', emoji: '🏁', path: 'core', requires: ['dragon-flag', 'pull-up'], goal: '2026: 5s', pos: [4, 2], initial: 'locked' },

  // ── DYNAMICS & GROOVE ────────────────────────────────────────────
  { id: 'kip-up', name: 'Kip up', emoji: '🦘', path: 'moves', requires: [], goal: '2026 ⭐', star: true, pos: [0, 0], initial: 'locked' },
  { id: 'aerial', name: 'Aerial', emoji: '🍃', path: 'moves', requires: [], goal: '2026', pos: [0, 2], initial: 'locked' },
  { id: 'backflip', name: 'Back flip', emoji: '🌀', path: 'moves', requires: ['kip-up'], goal: '2026', pos: [1, 0], initial: 'locked' },
  { id: 'side-flip', name: 'Side flip', emoji: '🌪️', path: 'moves', requires: ['aerial'], goal: '2026', pos: [1, 2], initial: 'locked' },
  { id: 'moon-kick', name: 'Moon kick', emoji: '🦵', path: 'moves', requires: ['aerial'], goal: '2026', pos: [2, 2], initial: 'locked' },
  { id: 'baki-pose', name: 'Baki pose', emoji: '💪', path: 'moves', requires: [], goal: '2026 — flex node', pos: [2, 0], initial: 'locked' },
  { id: 'moonwalk', name: 'Moonwalk', emoji: '🌙', path: 'moves', requires: [], goal: '2026', pos: [3, 1], initial: 'locked' },
  { id: 'airwalk', name: 'Airwalk', emoji: '💨', path: 'moves', requires: ['moonwalk'], goal: '2026 ⭐', star: true, pos: [4, 0], initial: 'locked' },
  { id: 'worm', name: 'Worm', emoji: '🐛', path: 'moves', requires: [], goal: '2026', pos: [4, 2], initial: 'locked' },
  { id: 'flexibility', name: 'Pancake stretch', emoji: '🥞', path: 'moves', requires: [], goal: '2026 ⭐ 30s', star: true, pos: [5, 2], initial: 'locked' },
  { id: 'flare', name: 'Flare', emoji: '🧨', path: 'moves', requires: ['worm', 'flexibility'], goal: '2026 — power move', pos: [6, 2], initial: 'locked' },
  { id: 'dance', name: 'Freestyle groove', emoji: '🕺', path: 'moves', requires: ['moonwalk', 'airwalk', 'worm'], goal: 'capstone — own the floor', pos: [6, 0], initial: 'locked' },

  // ── DEXTERITY (side quests — flat strip, no edges) ───────────────
  { id: 'pen-spinning', name: 'Pen spinning', emoji: '🖊️', path: 'craft', requires: [], pos: [0, 0], initial: 'locked' },
  { id: 'cardistry', name: 'Cardistry', emoji: '🃏', path: 'craft', requires: [], pos: [0, 1], initial: 'locked' },
  { id: 'yoyo', name: 'Yo-yo', emoji: '🪀', path: 'craft', requires: [], pos: [0, 2], initial: 'locked' },
  { id: 'juggling', name: 'Juggling', emoji: '🤹', path: 'craft', requires: [], pos: [1, 1], initial: 'locked' },
]

export const SKILL_MAP: ReadonlyMap<string, Skill> = new Map(SKILLS.map((s) => [s.id, s]))

export const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Calisthenics', 'Cardio', 'Walk+'] as const

// ── Storage (ledger-facing — unchanged API from v0.3) ──────────────
const SKILLS_KEY = 'lifeos.skills.v1'
export type SkillState = Record<string, SkillStatus>

export function loadSkills(): SkillState {
  try {
    return JSON.parse(localStorage.getItem(SKILLS_KEY) ?? '{}') as SkillState
  } catch {
    return {}
  }
}
export function saveSkills(s: SkillState): void {
  localStorage.setItem(SKILLS_KEY, JSON.stringify(s))
}
export function skillStatus(state: SkillState, s: Skill): SkillStatus {
  return state[s.id] ?? s.initial
}

// ── Derived state (never stored, never emitted) ────────────────────
export function nodeState(state: SkillState, s: Skill): NodeState {
  const st = skillStatus(state, s)
  if (st !== 'locked') return st
  const ready = s.requires.every((id) => {
    const p = SKILL_MAP.get(id)
    return p ? skillStatus(state, p) === 'unlocked' : true
  })
  return ready ? 'available' : 'locked'
}

/** Nearest not-yet-unlocked prerequisites — shown as "route: …" on locked nodes. */
export function routeTo(state: SkillState, s: Skill): Skill[] {
  const blockers: Skill[] = []
  const walk = (id: string) => {
    const p = SKILL_MAP.get(id)
    if (!p || skillStatus(state, p) === 'unlocked') return
    const parentBlockers = p.requires.filter((r) => {
      const pp = SKILL_MAP.get(r)
      return pp && skillStatus(state, pp) !== 'unlocked'
    })
    if (parentBlockers.length === 0) blockers.push(p)
    else parentBlockers.forEach(walk)
  }
  s.requires.forEach(walk)
  return blockers
}
