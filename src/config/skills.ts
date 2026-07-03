// Calisthenics skill tree. Authority: vault → wiki/topics/calisthenics-goals.md
// (baselines established Jun 2026; near-term targets = current focus).

export type SkillStatus = 'locked' | 'training' | 'unlocked'
export type Branch = 'foundation' | 'targets' | 'longterm' | 'art'

export interface Skill {
  id: string
  name: string
  emoji: string
  branch: Branch
  note?: string
  initial: SkillStatus
}

export const BRANCH_META: Record<Branch, { label: string; hint: string }> = {
  foundation: { label: 'Foundation', hint: 'baselines — already yours' },
  targets: { label: 'Current Targets', hint: 'the active grind' },
  longterm: { label: 'Long-Term', hint: 'bucket list — strength & skill' },
  art: { label: 'Performance / Art', hint: 'style points' },
}

export const SKILLS: Skill[] = [
  { id: 'crow-pose', name: 'Crow pose', emoji: '🐦', branch: 'foundation', note: '60s baseline', initial: 'unlocked' },
  { id: 'rope-climb', name: 'Full rope climb', emoji: '🧗', branch: 'foundation', initial: 'unlocked' },
  { id: 'german-hang', name: 'German hang', emoji: '🙃', branch: 'foundation', note: '40s baseline', initial: 'unlocked' },
  { id: 'active-hang', name: 'Active hang', emoji: '🐒', branch: 'foundation', note: '60s baseline', initial: 'unlocked' },
  { id: 'bw-squats', name: 'BW squats ×60', emoji: '🦵', branch: 'foundation', initial: 'unlocked' },
  { id: 'plank', name: 'Plank 2 min', emoji: '🧱', branch: 'foundation', initial: 'unlocked' },

  { id: 'tuck-front-lever', name: 'Tuck front lever', emoji: '🏋️', branch: 'targets', note: 'needs core + lat strength', initial: 'training' },
  { id: 'tuck-back-lever', name: 'Tuck back lever', emoji: '🔙', branch: 'targets', note: 'needs shoulder flexibility', initial: 'training' },
  { id: 'muscle-up', name: 'Muscle-up', emoji: '💥', branch: 'targets', note: 'key milestone — pull + dip', initial: 'training' },
  { id: 'l-sit', name: 'L-sit', emoji: '🪑', branch: 'targets', note: 'core endurance', initial: 'training' },
  { id: 'handstand-10s', name: 'Handstand 10s', emoji: '🤸', branch: 'targets', note: 'fix forward head posture first', initial: 'training' },

  { id: 'front-lever', name: 'Full front lever', emoji: '➖', branch: 'longterm', initial: 'locked' },
  { id: 'planche', name: 'Planche', emoji: '🛩️', branch: 'longterm', initial: 'locked' },
  { id: 'backflip', name: 'Back flip', emoji: '🌀', branch: 'longterm', initial: 'locked' },

  { id: 'moonwalk', name: 'Moonwalk', emoji: '🌙', branch: 'art', initial: 'locked' },
  { id: 'flare', name: 'Flare', emoji: '🌪️', branch: 'art', initial: 'locked' },
  { id: 'airwalk', name: 'Airwalk', emoji: '🚶', branch: 'art', initial: 'locked' },
  { id: 'cardistry', name: 'Cardistry', emoji: '🃏', branch: 'art', initial: 'locked' },
  { id: 'yoyo', name: 'Yo-yo', emoji: '🪀', branch: 'art', initial: 'locked' },
  { id: 'juggling', name: 'Juggling', emoji: '🤹', branch: 'art', initial: 'locked' },
  { id: 'pen-spinning', name: 'Pen spinning', emoji: '🖊️', branch: 'art', initial: 'locked' },
  { id: 'flexibility', name: 'Flexibility', emoji: '🧘', branch: 'art', initial: 'locked' },
  { id: 'dance', name: 'Dance', emoji: '🕺', branch: 'art', initial: 'locked' },
]

export const WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Calisthenics', 'Cardio', 'Walk+'] as const

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
