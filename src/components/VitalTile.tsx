// Steps and Water: tiles that fill with the day.
//
// The tile is the progress bar: the share of the goal done is the share of the row that is coloured, so 5,000 of
// 10,000 steps is half a tile. Google Health fills them, so nothing here is tappable. Under 100% it shows the
// percentage and pays nothing (the habit is only ticked at the goal, see lib/vitalHabits.ts); at 100% it pays.
// Water also has bubbles rising in the part that is full (sprites cut from the artist's sheet, src/assets/bubbles).
import bubbleL from '../assets/bubbles/bubble-l.png'
import bubbleM from '../assets/bubbles/bubble-m.png'
import bubbleS from '../assets/bubbles/bubble-s.png'
import { progressOf, type VitalKind } from '../lib/vitalHabits'

const BUBBLES = { l: bubbleL, m: bubbleM, s: bubbleS } as const
/** Where each bubble floats across the row (%), which size, how long a rise takes and when it starts. They are clipped to the water, so one shows once the level reaches it. */
const FLOAT: { size: keyof typeof BUBBLES; left: number; dur: number; delay: number }[] = [
  { size: 'm', left: 6, dur: 7.5, delay: 0 },
  { size: 's', left: 14, dur: 5.2, delay: -2.1 },
  { size: 'l', left: 24, dur: 9.5, delay: -4 },
  { size: 's', left: 35, dur: 6.1, delay: -0.8 },
  { size: 'm', left: 46, dur: 8.2, delay: -5.5 },
  { size: 's', left: 57, dur: 5.6, delay: -3.3 },
  { size: 'l', left: 66, dur: 10.5, delay: -7 },
  { size: 'm', left: 78, dur: 7, delay: -1.6 },
  { size: 's', left: 87, dur: 5.9, delay: -4.4 },
  { size: 'm', left: 94, dur: 8.8, delay: -6.2 },
]
/** Drawn at whole multiples of the sprite's own pixels, so the pixel art stays crisp. */
const PX: Record<keyof typeof BUBBLES, number> = { l: 25, m: 14, s: 10 }

const num = (n: number) => n.toLocaleString('en-IN')
/** 3250 -> "3.25 L", 4000 -> "4 L" */
const litres = (ml: number) => `${+(ml / 1000).toFixed(2)} L`

export function VitalTile({ kind, name, emoji, reading, ticked, xp }: { kind: VitalKind; name: string; emoji: string; reading: number | undefined; ticked: boolean; xp: number }) {
  const p = progressOf(kind, reading)
  const full = ticked || p.done
  const pct = full ? 100 : p.pct
  const fmt = kind === 'steps' ? num : litres
  const unit = kind === 'steps' ? ' steps' : ''
  const sub = p.value === null ? 'Waiting for Google Health' : full ? `Goal reached · ${fmt(p.value)}${unit}` : `${fmt(p.value)} of ${fmt(p.goal)}${unit}`
  return (
    <div
      className="vital-body flex min-w-0 flex-1 items-center gap-3 py-2.5"
      role="progressbar"
      aria-label={`${name}: ${sub}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      title={`Filled by Google Health. Counts as done at 100% (${fmt(p.goal)}${unit}) and pays ${xp} XP; below that it pays nothing.`}
      style={{ ['--fill' as string]: `${pct}%` }}
    >
      <span className="vital-fill" aria-hidden />
      {kind === 'water' && (
        <span className="vital-bubbles" aria-hidden>
          {FLOAT.map((b, i) => (
            <img key={i} src={BUBBLES[b.size]} alt="" draggable={false} style={{ left: `${b.left}%`, width: PX[b.size], height: PX[b.size], animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />
          ))}
        </span>
      )}
      <span className="vital-icon" aria-hidden>{emoji}</span>
      <span className="vital-text min-w-0 flex-1">
        <span className="vit-title block truncate">{name}</span>
        <span className="block truncate text-[11px] font-bold">{sub}</span>
      </span>
      <span className="vital-pct num shrink-0">{pct}%</span>
      <span className="vital-xp num shrink-0">{ticked ? `+${xp}` : xp}</span>
    </div>
  )
}
