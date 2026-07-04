// Phase 4 workout engine — exercise catalog, muscle groups, and split templates.
// Muscles key the anatomical map (MuscleMap.tsx) and the post-workout glow;
// ids are stable forever — they ride inside `workout` event payloads.

export type MuscleId =
  | 'chest'
  | 'front-delts'
  | 'side-delts'
  | 'rear-delts'
  | 'traps'
  | 'lats'
  | 'upper-back'
  | 'lower-back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  chest: 'Chest',
  'front-delts': 'Front delts',
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  traps: 'Traps',
  lats: 'Lats',
  'upper-back': 'Upper back',
  'lower-back': 'Lower back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
}

/** 'weight' logs kg×reps · 'reps' logs bodyweight reps · 'time' logs seconds */
export type ExerciseKind = 'weight' | 'reps' | 'time'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  primary: MuscleId[]
  secondary: MuscleId[]
}

export const EXERCISES: Exercise[] = [
  // ── Push ──────────────────────────────────────────────────────────
  { id: 'bench-press', name: 'Bench Press', kind: 'weight', primary: ['chest'], secondary: ['front-delts', 'triceps'] },
  { id: 'incline-db-press', name: 'Incline DB Press', kind: 'weight', primary: ['chest', 'front-delts'], secondary: ['triceps'] },
  { id: 'overhead-press', name: 'Overhead Press', kind: 'weight', primary: ['front-delts', 'side-delts'], secondary: ['triceps', 'traps'] },
  { id: 'lateral-raise', name: 'Lateral Raise', kind: 'weight', primary: ['side-delts'], secondary: ['traps'] },
  { id: 'cable-fly', name: 'Cable Fly', kind: 'weight', primary: ['chest'], secondary: ['front-delts'] },
  { id: 'dips', name: 'Dips', kind: 'reps', primary: ['chest', 'triceps'], secondary: ['front-delts'] },
  { id: 'push-up', name: 'Push-Up', kind: 'reps', primary: ['chest'], secondary: ['triceps', 'front-delts', 'abs'] },
  { id: 'pike-push-up', name: 'Pike Push-Up', kind: 'reps', primary: ['front-delts', 'side-delts'], secondary: ['triceps', 'traps'] },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', kind: 'weight', primary: ['triceps'], secondary: [] },
  { id: 'overhead-extension', name: 'Overhead Triceps Ext', kind: 'weight', primary: ['triceps'], secondary: [] },

  // ── Pull ──────────────────────────────────────────────────────────
  { id: 'pull-up', name: 'Pull-Up', kind: 'reps', primary: ['lats', 'upper-back'], secondary: ['biceps', 'forearms'] },
  { id: 'lat-pulldown', name: 'Lat Pulldown', kind: 'weight', primary: ['lats'], secondary: ['biceps', 'upper-back'] },
  { id: 'barbell-row', name: 'Barbell Row', kind: 'weight', primary: ['upper-back', 'lats'], secondary: ['biceps', 'lower-back', 'rear-delts'] },
  { id: 'seated-cable-row', name: 'Seated Cable Row', kind: 'weight', primary: ['upper-back'], secondary: ['lats', 'biceps'] },
  { id: 'face-pull', name: 'Face Pull', kind: 'weight', primary: ['rear-delts', 'traps'], secondary: ['upper-back'] },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', kind: 'weight', primary: ['rear-delts'], secondary: ['upper-back'] },
  { id: 'barbell-curl', name: 'Barbell Curl', kind: 'weight', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'hammer-curl', name: 'Hammer Curl', kind: 'weight', primary: ['biceps', 'forearms'], secondary: [] },
  { id: 'shrug', name: 'Shrug', kind: 'weight', primary: ['traps'], secondary: ['forearms'] },
  { id: 'deadlift', name: 'Deadlift', kind: 'weight', primary: ['lower-back', 'glutes', 'hamstrings'], secondary: ['traps', 'forearms', 'quads', 'lats'] },
  { id: 'dead-hang', name: 'Dead Hang', kind: 'time', primary: ['forearms'], secondary: ['lats', 'traps'] },

  // ── Legs ──────────────────────────────────────────────────────────
  { id: 'squat', name: 'Squat', kind: 'weight', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower-back', 'abs'] },
  { id: 'leg-press', name: 'Leg Press', kind: 'weight', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', kind: 'weight', primary: ['hamstrings', 'glutes'], secondary: ['lower-back', 'forearms'] },
  { id: 'leg-extension', name: 'Leg Extension', kind: 'weight', primary: ['quads'], secondary: [] },
  { id: 'leg-curl', name: 'Leg Curl', kind: 'weight', primary: ['hamstrings'], secondary: ['calves'] },
  { id: 'walking-lunge', name: 'Walking Lunge', kind: 'weight', primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', kind: 'weight', primary: ['quads', 'glutes'], secondary: ['hamstrings'] },
  { id: 'hip-thrust', name: 'Hip Thrust', kind: 'weight', primary: ['glutes'], secondary: ['hamstrings', 'quads'] },
  { id: 'calf-raise', name: 'Calf Raise', kind: 'weight', primary: ['calves'], secondary: [] },

  // ── Core ──────────────────────────────────────────────────────────
  { id: 'ab-roller', name: 'Ab-Roller', kind: 'reps', primary: ['abs'], secondary: ['obliques', 'lats'] },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', kind: 'reps', primary: ['abs'], secondary: ['obliques', 'forearms'] },
  { id: 'plank', name: 'Plank', kind: 'time', primary: ['abs'], secondary: ['obliques', 'lower-back'] },
  { id: 'l-sit', name: 'L-Sit', kind: 'time', primary: ['abs'], secondary: ['quads', 'triceps'] },
  { id: 'cable-crunch', name: 'Cable Crunch', kind: 'weight', primary: ['abs'], secondary: [] },
  { id: 'russian-twist', name: 'Russian Twist', kind: 'reps', primary: ['obliques'], secondary: ['abs'] },

  // ── Calisthenics (feeds the Body constellation work) ──────────────
  { id: 'muscle-up', name: 'Muscle-Up', kind: 'reps', primary: ['lats', 'chest'], secondary: ['triceps', 'biceps', 'abs', 'forearms'] },
  { id: 'handstand-hold', name: 'Handstand Hold', kind: 'time', primary: ['front-delts', 'side-delts'], secondary: ['traps', 'triceps', 'abs'] },
  { id: 'front-lever-hold', name: 'Front Lever Hold', kind: 'time', primary: ['lats', 'abs'], secondary: ['upper-back', 'forearms'] },
  { id: 'planche-lean', name: 'Planche Lean', kind: 'time', primary: ['front-delts', 'chest'], secondary: ['abs', 'forearms'] },
  { id: 'archer-push-up', name: 'Archer Push-Up', kind: 'reps', primary: ['chest'], secondary: ['triceps', 'front-delts', 'abs'] },
]

export const EXERCISE_MAP: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]))

export interface Split {
  id: string
  name: string
  emoji: string
  /** exercise id → default set count */
  plan: { exerciseId: string; sets: number }[]
}

export const SPLITS: Split[] = [
  {
    id: 'push-day',
    name: 'Push Day',
    emoji: '🫷',
    plan: [
      { exerciseId: 'bench-press', sets: 4 },
      { exerciseId: 'overhead-press', sets: 3 },
      { exerciseId: 'incline-db-press', sets: 3 },
      { exerciseId: 'lateral-raise', sets: 3 },
      { exerciseId: 'triceps-pushdown', sets: 3 },
      { exerciseId: 'dips', sets: 3 },
    ],
  },
  {
    id: 'pull-day',
    name: 'Pull Day',
    emoji: '🐒',
    plan: [
      { exerciseId: 'pull-up', sets: 4 },
      { exerciseId: 'barbell-row', sets: 4 },
      { exerciseId: 'lat-pulldown', sets: 3 },
      { exerciseId: 'face-pull', sets: 3 },
      { exerciseId: 'barbell-curl', sets: 3 },
      { exerciseId: 'hammer-curl', sets: 2 },
    ],
  },
  {
    id: 'leg-day',
    name: 'Leg Day',
    emoji: '🦵',
    plan: [
      { exerciseId: 'squat', sets: 4 },
      { exerciseId: 'romanian-deadlift', sets: 3 },
      { exerciseId: 'leg-press', sets: 3 },
      { exerciseId: 'leg-curl', sets: 3 },
      { exerciseId: 'calf-raise', sets: 4 },
    ],
  },
  {
    id: 'core-day',
    name: 'Core & Abs',
    emoji: '🍥',
    plan: [
      { exerciseId: 'ab-roller', sets: 3 },
      { exerciseId: 'hanging-leg-raise', sets: 3 },
      { exerciseId: 'l-sit', sets: 3 },
      { exerciseId: 'cable-crunch', sets: 3 },
      { exerciseId: 'russian-twist', sets: 3 },
    ],
  },
  {
    id: 'calisthenics',
    name: 'Calisthenics',
    emoji: '🐍',
    plan: [
      { exerciseId: 'muscle-up', sets: 3 },
      { exerciseId: 'front-lever-hold', sets: 3 },
      { exerciseId: 'handstand-hold', sets: 3 },
      { exerciseId: 'planche-lean', sets: 3 },
      { exerciseId: 'archer-push-up', sets: 3 },
      { exerciseId: 'dead-hang', sets: 2 },
    ],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    emoji: '🧬',
    plan: [
      { exerciseId: 'squat', sets: 3 },
      { exerciseId: 'bench-press', sets: 3 },
      { exerciseId: 'barbell-row', sets: 3 },
      { exerciseId: 'overhead-press', sets: 2 },
      { exerciseId: 'romanian-deadlift', sets: 2 },
      { exerciseId: 'ab-roller', sets: 2 },
    ],
  },
]

export const SPLIT_MAP: ReadonlyMap<string, Split> = new Map(SPLITS.map((s) => [s.id, s]))

/** Primary/secondary muscle sets across a list of exercise ids (deduped, primary wins). */
export function musclesFor(exerciseIds: string[]): { primary: MuscleId[]; secondary: MuscleId[] } {
  const primary = new Set<MuscleId>()
  const secondary = new Set<MuscleId>()
  for (const id of exerciseIds) {
    const ex = EXERCISE_MAP.get(id)
    if (!ex) continue
    for (const m of ex.primary) primary.add(m)
    for (const m of ex.secondary) secondary.add(m)
  }
  for (const m of primary) secondary.delete(m)
  return { primary: [...primary], secondary: [...secondary] }
}
