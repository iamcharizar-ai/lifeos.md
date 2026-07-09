// Anatomical muscle map — flat angular front/back silhouette in the cyberware-
// screen tradition, v1.1 detail pass: muscles render as their real heads
// (clavicular/sternal chest, three quad heads, six-pack segments, two-head
// arms, gastroc + soleus calves) with a fiber-striation overlay. Plates are
// separate vectors keyed by MuscleId — several plates may share one id:
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
  /** fiber direction for the striation overlay */
  grain?: 'v' | 'd'
}

// Left-side (or central) plates; `both` mirrors across x=105. Seams between
// plates of the same muscle are the detail — don't close the gaps.
const FRONT: Region[] = [
  { muscle: 'traps', poly: [[96, 48], [96, 56], [72, 60]], both: true, grain: 'd' },
  { muscle: 'front-delts', poly: [[66, 58], [82, 60], [78, 80], [68, 80]], both: true, grain: 'v' },
  { muscle: 'side-delts', poly: [[54, 64], [66, 58], [68, 80], [56, 88]], both: true, grain: 'v' },
  // chest — clavicular (upper) and sternal (lower) heads
  { muscle: 'chest', poly: [[70, 64], [103, 66], [103, 85], [80, 87], [68, 82]], both: true, grain: 'd' },
  { muscle: 'chest', poly: [[68, 84], [80, 89], [103, 87], [103, 108], [80, 110], [68, 88]], both: true, grain: 'd' },
  // biceps — short (inner) and long (outer) heads
  { muscle: 'biceps', poly: [[58, 90], [64, 88], [63, 127], [60, 128]], both: true, grain: 'v' },
  { muscle: 'biceps', poly: [[65, 88], [72, 86], [70, 126], [64, 127]], both: true, grain: 'v' },
  // forearms — brachioradialis + flexor strip
  { muscle: 'forearms', poly: [[56, 132], [62, 131], [59, 170], [58, 170]], both: true, grain: 'v' },
  { muscle: 'forearms', poly: [[63, 131], [70, 130], [66, 170], [60, 170]], both: true, grain: 'v' },
  { muscle: 'obliques', poly: [[78, 112], [88, 114], [90, 172], [82, 166], [74, 136]], both: true, grain: 'd' },
  // abs — three segment rows per side (the six-pack grid)
  { muscle: 'abs', poly: [[90, 114], [103, 114], [103, 132], [91, 132]], both: true, grain: 'v' },
  { muscle: 'abs', poly: [[91, 134], [103, 134], [103, 152], [92, 152]], both: true, grain: 'v' },
  { muscle: 'abs', poly: [[92, 154], [103, 154], [103, 174], [92, 174]], both: true, grain: 'v' },
  // quads — vastus lateralis (outer sweep), rectus femoris (center), vastus medialis (teardrop)
  { muscle: 'quads', poly: [[76, 186], [83, 188], [82, 246], [79, 262], [74, 240], [72, 226]], both: true, grain: 'v' },
  { muscle: 'quads', poly: [[84, 188], [94, 190], [93, 258], [84, 260]], both: true, grain: 'v' },
  { muscle: 'quads', poly: [[95, 191], [102, 190], [100, 252], [95, 264], [94, 238]], both: true, grain: 'v' },
  { muscle: 'calves', poly: [[84, 278], [98, 278], [94, 350], [86, 350]], both: true, grain: 'v' },
]

const BACK: Region[] = [
  // traps — upper diamond + mid-trap sheet
  { muscle: 'traps', poly: [[96, 46], [114, 46], [132, 62], [105, 78], [78, 62]], grain: 'd' },
  { muscle: 'traps', poly: [[88, 68], [105, 80], [122, 68], [105, 96]], grain: 'd' },
  { muscle: 'rear-delts', poly: [[54, 62], [68, 58], [70, 82], [56, 86]], both: true, grain: 'v' },
  { muscle: 'upper-back', poly: [[80, 64], [103, 66], [103, 104], [82, 98]], both: true, grain: 'd' },
  // lats — upper fan + lower taper
  { muscle: 'lats', poly: [[72, 90], [100, 106], [98, 128], [80, 124], [68, 114]], both: true, grain: 'd' },
  { muscle: 'lats', poly: [[80, 126], [98, 130], [98, 150], [86, 152]], both: true, grain: 'd' },
  { muscle: 'lower-back', poly: [[94, 152], [103, 152], [103, 184], [96, 182]], both: true, grain: 'v' },
  // triceps — long (inner) and lateral heads
  { muscle: 'triceps', poly: [[58, 88], [64, 86], [63, 125], [60, 126]], both: true, grain: 'v' },
  { muscle: 'triceps', poly: [[65, 86], [72, 84], [70, 124], [64, 125]], both: true, grain: 'v' },
  { muscle: 'forearms', poly: [[56, 130], [62, 129], [59, 168], [58, 168]], both: true, grain: 'v' },
  { muscle: 'forearms', poly: [[63, 129], [70, 128], [66, 168], [60, 168]], both: true, grain: 'v' },
  // glutes — medius shelf + maximus mass
  { muscle: 'glutes', poly: [[78, 188], [103, 190], [102, 201], [79, 199]], both: true, grain: 'd' },
  { muscle: 'glutes', poly: [[79, 201], [102, 203], [101, 224], [80, 222]], both: true, grain: 'd' },
  // hamstrings — biceps femoris (outer) + semi (inner) strips
  { muscle: 'hamstrings', poly: [[80, 230], [89, 230], [87, 274], [84, 274]], both: true, grain: 'v' },
  { muscle: 'hamstrings', poly: [[90, 230], [101, 230], [99, 274], [88, 274]], both: true, grain: 'v' },
  // calves — gastroc medial/lateral heads over the soleus band
  { muscle: 'calves', poly: [[84, 282], [91, 282], [90, 334], [86, 334]], both: true, grain: 'v' },
  { muscle: 'calves', poly: [[92, 282], [100, 282], [98, 334], [91, 334]], both: true, grain: 'v' },
  { muscle: 'calves', poly: [[87, 337], [96, 337], [94, 352], [88, 352]], both: true, grain: 'v' },
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
          <g key={`${r.muscle}-${i}-${j}`}>
            <polygon
              points={pts(p)}
              fill={s.fill}
              stroke={s.stroke}
              strokeWidth="0.8"
              filter={s.filter}
              style={{ transition: 'fill 0.25s, stroke 0.25s' }}
            >
              <title>{MUSCLE_LABEL[r.muscle]}</title>
            </polygon>
            {/* fiber striations — hairline grain over every plate */}
            <polygon
              points={pts(p)}
              fill={r.grain === 'd' ? 'url(#mm-fibers-d)' : 'url(#mm-fibers-v)'}
              stroke="none"
              pointerEvents="none"
            />
          </g>
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
        {/* muscle-fiber grain: vertical for limbs, diagonal for fans/sheets */}
        <pattern id="mm-fibers-v" width="3" height="3" patternUnits="userSpaceOnUse">
          <line x1="1.5" y1="0" x2="1.5" y2="3" stroke="rgba(10,13,19,0.35)" strokeWidth="0.5" />
        </pattern>
        <pattern
          id="mm-fibers-d"
          width="3.5"
          height="3.5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <line x1="0" y1="1.75" x2="3.5" y2="1.75" stroke="rgba(10,13,19,0.35)" strokeWidth="0.5" />
        </pattern>
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
