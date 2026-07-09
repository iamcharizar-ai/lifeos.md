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

// ── Muscle intel — the aesthetics dossier behind the Train-tab guide ─
// roi: aesthetic return per unit of training effort (5 = physique-defining).
// growth: realistic time to *visible* change with consistent training + food.
// best: ranked movers for that muscle; these rankings also seeded the split
// ordering below (highest-ROI muscles get first-slot, fresh-energy exercises).

export interface MuscleIntel {
  roi: 1 | 2 | 3 | 4 | 5
  growth: string
  note: string
  best: { exerciseId: string; stars: 1 | 2 | 3 | 4 | 5 }[]
}

export const MUSCLE_INTEL: Record<MuscleId, MuscleIntel> = {
  'side-delts': {
    roi: 5,
    growth: '3–6 months',
    note: 'The width illusion. Capped side delts broaden the frame in a T-shirt more than anything else per set invested.',
    best: [
      { exerciseId: 'lateral-raise', stars: 5 },
      { exerciseId: 'overhead-press', stars: 3 },
      { exerciseId: 'pike-push-up', stars: 3 },
    ],
  },
  chest: {
    roi: 5,
    growth: '3–6 months',
    note: 'The armor plate. Upper (clavicular) chest is the aesthetic half — it fills the collarbone shelf; lower chest grows almost by accident.',
    best: [
      { exerciseId: 'incline-db-press', stars: 5 },
      { exerciseId: 'bench-press', stars: 4 },
      { exerciseId: 'dips', stars: 4 },
      { exerciseId: 'cable-fly', stars: 3 },
      { exerciseId: 'push-up', stars: 3 },
    ],
  },
  lats: {
    roi: 5,
    growth: '4–8 months',
    note: 'The V-taper engine. Wide lats shrink your visual waist from behind and fill a shirt from the front. Slowest of the big three to show, most transformative when it does.',
    best: [
      { exerciseId: 'pull-up', stars: 5 },
      { exerciseId: 'lat-pulldown', stars: 4 },
      { exerciseId: 'barbell-row', stars: 4 },
    ],
  },
  abs: {
    roi: 5,
    growth: '8–12 weeks (diet)',
    note: 'Made in the gym, revealed in the kitchen — visible abs are ~90% body-fat percentage. Train them heavy like any muscle so they pop when the cut lands.',
    best: [
      { exerciseId: 'hanging-leg-raise', stars: 5 },
      { exerciseId: 'ab-roller', stars: 5 },
      { exerciseId: 'cable-crunch', stars: 4 },
      { exerciseId: 'l-sit', stars: 4 },
    ],
  },
  biceps: {
    roi: 4,
    growth: '3–6 months',
    note: 'The flex muscle — small, fast to pump, always on display. Peak is genetic; thickness is trainable.',
    best: [
      { exerciseId: 'barbell-curl', stars: 5 },
      { exerciseId: 'hammer-curl', stars: 4 },
      { exerciseId: 'pull-up', stars: 3 },
    ],
  },
  triceps: {
    roi: 4,
    growth: '3–6 months',
    note: 'Two-thirds of arm size lives here, not in the biceps. The long head (overhead work) is what hangs and fills sleeves.',
    best: [
      { exerciseId: 'dips', stars: 5 },
      { exerciseId: 'overhead-extension', stars: 4 },
      { exerciseId: 'triceps-pushdown', stars: 4 },
    ],
  },
  quads: {
    roi: 4,
    growth: '4–8 months',
    note: 'The base of the physique — quad sweep separates “lifts” from “skips leg day”. Also the biggest calorie burner in the catalog.',
    best: [
      { exerciseId: 'squat', stars: 5 },
      { exerciseId: 'leg-press', stars: 4 },
      { exerciseId: 'bulgarian-split-squat', stars: 4 },
      { exerciseId: 'walking-lunge', stars: 4 },
      { exerciseId: 'leg-extension', stars: 3 },
    ],
  },
  'upper-back': {
    roi: 3,
    growth: '3–6 months',
    note: 'Thickness and posture. A dense mid-back makes you look strong from every angle and fixes the desk slouch.',
    best: [
      { exerciseId: 'barbell-row', stars: 5 },
      { exerciseId: 'seated-cable-row', stars: 4 },
      { exerciseId: 'face-pull', stars: 3 },
    ],
  },
  'rear-delts': {
    roi: 3,
    growth: '4–8 months',
    note: 'The 3D-shoulder finisher — invisible from the front, obvious in every side profile. Chronically undertrained; cheap insurance for shoulder health.',
    best: [
      { exerciseId: 'rear-delt-fly', stars: 5 },
      { exerciseId: 'face-pull', stars: 4 },
    ],
  },
  traps: {
    roi: 3,
    growth: '2–4 months',
    note: 'Fast responder. Upper traps read “powerful” in a collared shirt — but overgrown traps steal width from the delts. Moderate dose.',
    best: [
      { exerciseId: 'shrug', stars: 4 },
      { exerciseId: 'deadlift', stars: 3 },
      { exerciseId: 'face-pull', stars: 3 },
    ],
  },
  forearms: {
    roi: 3,
    growth: '4–8 months',
    note: 'Always visible, slow to grow, high grind. Grip work doubles as pull-day insurance — dead hangs pay twice.',
    best: [
      { exerciseId: 'hammer-curl', stars: 4 },
      { exerciseId: 'dead-hang', stars: 4 },
      { exerciseId: 'shrug', stars: 2 },
    ],
  },
  glutes: {
    roi: 3,
    growth: '3–6 months',
    note: 'Power center. Strong glutes carry the squat and deadlift up and balance the physique from the side.',
    best: [
      { exerciseId: 'hip-thrust', stars: 5 },
      { exerciseId: 'squat', stars: 4 },
      { exerciseId: 'romanian-deadlift', stars: 4 },
      { exerciseId: 'bulgarian-split-squat', stars: 4 },
    ],
  },
  hamstrings: {
    roi: 3,
    growth: '4–8 months',
    note: 'The side-profile muscle — hamstring hang separates real legs from quad-only legs. Injury armor for sprinting.',
    best: [
      { exerciseId: 'romanian-deadlift', stars: 5 },
      { exerciseId: 'leg-curl', stars: 4 },
    ],
  },
  calves: {
    roi: 3,
    growth: '6–12 months',
    note: 'Stubbornest muscle on the chart — high frequency, full stretch, patience. Genetics deal the hand; volume plays it.',
    best: [
      { exerciseId: 'calf-raise', stars: 5 },
    ],
  },
  'front-delts': {
    roi: 2,
    growth: '2–4 months',
    note: 'Already paid for — every press hits them. Direct front-raise work is usually wasted volume.',
    best: [
      { exerciseId: 'overhead-press', stars: 5 },
      { exerciseId: 'incline-db-press', stars: 3 },
      { exerciseId: 'handstand-hold', stars: 3 },
    ],
  },
  'lower-back': {
    roi: 2,
    growth: '3–6 months',
    note: 'Foundation, not decoration. Erectors let you load everything else heavier — train for strength, not looks.',
    best: [
      { exerciseId: 'deadlift', stars: 5 },
      { exerciseId: 'romanian-deadlift', stars: 4 },
    ],
  },
  obliques: {
    roi: 2,
    growth: '2–4 months',
    note: 'Handle with care — thick obliques widen the waist and blunt the V-taper. Anti-rotation and moderate volume only.',
    best: [
      { exerciseId: 'russian-twist', stars: 3 },
      { exerciseId: 'plank', stars: 3 },
    ],
  },
}

export interface Split {
  id: string
  name: string
  emoji: string
  /** exercise id → default set count */
  plan: { exerciseId: string; sets: number }[]
}

// Splits are intel-driven (2026-07-09): the highest-ROI muscle of the day owns
// the first fresh-energy slots — upper chest opens push, lats open pull, side
// delts and long-head triceps get guaranteed volume instead of leftover sets.
export const SPLITS: Split[] = [
  {
    id: 'push-day',
    name: 'Push Day',
    emoji: '🫷',
    plan: [
      { exerciseId: 'incline-db-press', sets: 4 }, // upper chest ★5 — fresh
      { exerciseId: 'bench-press', sets: 3 },
      { exerciseId: 'overhead-press', sets: 3 },
      { exerciseId: 'lateral-raise', sets: 4 }, // side delts ★5 — never skipped
      { exerciseId: 'dips', sets: 3 },
      { exerciseId: 'overhead-extension', sets: 3 }, // long head fills sleeves
    ],
  },
  {
    id: 'pull-day',
    name: 'Pull Day',
    emoji: '🐒',
    plan: [
      { exerciseId: 'pull-up', sets: 4 }, // lats ★5 — fresh
      { exerciseId: 'barbell-row', sets: 4 },
      { exerciseId: 'lat-pulldown', sets: 3 },
      { exerciseId: 'rear-delt-fly', sets: 3 }, // 3D shoulders
      { exerciseId: 'face-pull', sets: 2 },
      { exerciseId: 'barbell-curl', sets: 3 },
      { exerciseId: 'hammer-curl', sets: 2 },
    ],
  },
  {
    id: 'leg-day',
    name: 'Leg Day',
    emoji: '🦵',
    plan: [
      { exerciseId: 'squat', sets: 4 }, // quads ★5 — fresh
      { exerciseId: 'romanian-deadlift', sets: 3 },
      { exerciseId: 'leg-press', sets: 3 },
      { exerciseId: 'hip-thrust', sets: 3 }, // glute anchor
      { exerciseId: 'leg-curl', sets: 3 },
      { exerciseId: 'calf-raise', sets: 4 }, // stubborn — volume every week
    ],
  },
  {
    id: 'core-day',
    name: 'Core & Abs',
    emoji: '🍥',
    plan: [
      { exerciseId: 'hanging-leg-raise', sets: 3 }, // abs ★5 — fresh
      { exerciseId: 'ab-roller', sets: 3 },
      { exerciseId: 'cable-crunch', sets: 3 },
      { exerciseId: 'l-sit', sets: 3 },
      { exerciseId: 'plank', sets: 2 }, // obliques kept light — waist stays tight
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
