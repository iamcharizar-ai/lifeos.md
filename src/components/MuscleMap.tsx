// Anatomical muscle map — flat angular front/back silhouette in the cyberware-
// screen tradition. Muscles are separate vector plates keyed by MuscleId:
//   primary   → shaded ember red (what a split/exercise is about to hit)
//   secondary → faint red wash (assisting muscles)
//   glow      → emissive activation (trained today, after Finish Workout)
// Pure presentational; state priority is glow > primary > secondary > idle.
import { MUSCLE_LABEL, type MuscleId } from '../config/exercises'

type Pt = [number, number]
const CX = 105 // figure centerline; back view renders at +210

const pts = (p: Pt[]) => p.map((x) => x.join(',')).join(' ')
const mirrored = (p: Pt[]): Pt[] => p.map(([x, y]) => [2 * CX - x, y] as Pt).reverse()

interface Region {
  muscle: MuscleId
  poly: Pt[]
  /** symmetric pair — also render the mirror across the centerline */
  both?: boolean
}

// Left-side (or central) plates; `both` mirrors across x=105.
const FRONT: Region[] = [
  { muscle: 'traps', poly: [[96, 48], [96, 56], [72, 60]], both: true },
  { muscle: 'front-delts', poly: [[66, 58], [82, 60], [78, 80], [68, 80]], both: true },
  { muscle: 'side-delts', poly: [[54, 64], [66, 58], [68, 80], [56, 88]], both: true },
  { muscle: 'chest', poly: [[70, 64], [103, 66], [103, 108], [80, 110], [68, 88]], both: true },
  { muscle: 'biceps', poly: [[58, 90], [72, 86], [70, 126], [60, 128]], both: true },
  { muscle: 'forearms', poly: [[56, 132], [70, 130], [66, 170], [58, 170]], both: true },
  { muscle: 'obliques', poly: [[78, 112], [88, 114], [90, 172], [82, 166], [74, 136]], both: true },
  { muscle: 'abs', poly: [[90, 114], [103, 114], [103, 174], [92, 174]], both: true },
  { muscle: 'quads', poly: [[76, 186], [102, 190], [100, 268], [82, 268], [72, 226]], both: true },
  { muscle: 'calves', poly: [[84, 278], [98, 278], [94, 350], [86, 350]], both: true },
]

const BACK: Region[] = [
  { muscle: 'traps', poly: [[96, 46], [114, 46], [132, 62], [105, 96], [78, 62]] },
  { muscle: 'rear-delts', poly: [[54, 62], [68, 58], [70, 82], [56, 86]], both: true },
  { muscle: 'upper-back', poly: [[80, 64], [103, 66], [103, 104], [82, 98]], both: true },
  { muscle: 'lats', poly: [[72, 90], [100, 106], [98, 150], [86, 152], [68, 114]], both: true },
  { muscle: 'lower-back', poly: [[94, 152], [103, 152], [103, 184], [96, 182]], both: true },
  { muscle: 'triceps', poly: [[58, 88], [72, 84], [70, 124], [60, 126]], both: true },
  { muscle: 'forearms', poly: [[56, 130], [70, 128], [66, 168], [58, 168]], both: true },
  { muscle: 'glutes', poly: [[78, 188], [103, 190], [101, 224], [80, 222]], both: true },
  { muscle: 'hamstrings', poly: [[80, 230], [101, 230], [99, 274], [84, 274]], both: true },
  { muscle: 'calves', poly: [[84, 282], [100, 282], [96, 352], [88, 352]], both: true },
]

// Body outline, left half top→down; right half is the mirror. Same skeleton
// for both views — angular on purpose (chamfer language, not anatomy class).
const OUTLINE_LEFT: Pt[] = [
  [105, 8], [96, 10], [89, 20], [89, 34], [96, 44], [97, 54],
  [68, 58], [56, 64], [50, 92], [52, 130], [48, 170], [44, 188], [56, 192], [62, 172], [66, 132], [70, 96],
  [76, 112], [79, 150], [72, 180],
  [74, 200], [78, 268], [80, 300], [82, 348], [78, 356], [74, 368], [94, 372], [96, 356], [94, 300], [98, 272], [100, 240], [105, 200],
]
const OUTLINE: Pt[] = [...OUTLINE_LEFT, ...mirrored(OUTLINE_LEFT)]

type PlateState = 'idle' | 'secondary' | 'primary' | 'glow'

const PLATE_STYLE: Record<PlateState, { fill: string; stroke: string; filter?: string }> = {
  idle: { fill: '#1a2230', stroke: '#2a3548' },
  secondary: { fill: 'rgba(255,92,56,0.22)', stroke: 'rgba(255,92,56,0.45)' },
  primary: { fill: 'rgba(255,92,56,0.85)', stroke: '#ff8a66' },
  glow: { fill: '#ff6a3d', stroke: '#ffb340', filter: 'url(#mm-glow)' },
}

function View({
  regions,
  state,
}: {
  regions: Region[]
  state: (m: MuscleId) => PlateState
}) {
  return (
    <>
      <polygon points={pts(OUTLINE)} fill="#10151e" stroke="#2a3548" strokeWidth="1" />
      {regions.map((r, i) => {
        const polys = r.both ? [r.poly, mirrored(r.poly)] : [r.poly]
        const s = PLATE_STYLE[state(r.muscle)]
        return polys.map((p, j) => (
          <polygon
            key={`${r.muscle}-${i}-${j}`}
            points={pts(p)}
            fill={s.fill}
            stroke={s.stroke}
            strokeWidth="0.8"
            filter={s.filter}
            style={{ transition: 'fill 0.25s, stroke 0.25s' }}
          >
            <title>{MUSCLE_LABEL[r.muscle]}</title>
          </polygon>
        ))
      })}
    </>
  )
}

export function MuscleMap({
  primary = [],
  secondary = [],
  glow = [],
  className = '',
}: {
  primary?: MuscleId[]
  secondary?: MuscleId[]
  glow?: MuscleId[]
  className?: string
}) {
  const pSet = new Set(primary)
  const sSet = new Set(secondary)
  const gSet = new Set(glow)
  const state = (m: MuscleId): PlateState =>
    gSet.has(m) ? 'glow' : pSet.has(m) ? 'primary' : sSet.has(m) ? 'secondary' : 'idle'

  return (
    <svg viewBox="0 0 420 396" className={className} role="img" aria-label="muscle map">
      <defs>
        <filter id="mm-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ff5c38" floodOpacity="0.9" />
        </filter>
      </defs>
      <g>
        <View regions={FRONT} state={state} />
      </g>
      <g transform="translate(210,0)">
        <View regions={BACK} state={state} />
      </g>
      <text
        x="105"
        y="390"
        textAnchor="middle"
        fill="#525b6e"
        fontSize="10"
        fontFamily="'Chakra Petch', sans-serif"
        letterSpacing="3"
      >
        FRONT
      </text>
      <text
        x="315"
        y="390"
        textAnchor="middle"
        fill="#525b6e"
        fontSize="10"
        fontFamily="'Chakra Petch', sans-serif"
        letterSpacing="3"
      >
        BACK
      </text>
    </svg>
  )
}
