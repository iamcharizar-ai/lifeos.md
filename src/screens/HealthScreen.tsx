import { motion } from 'framer-motion'
import { sleepXp, stepsXp, STEPS_XP_CAP, SLEEP_XP } from '../lib/xp'
import { healthEarned, type DayHealth } from '../lib/ledger'
import { AnimatedNumber } from '../components/AnimatedNumber'

const FIELDS = [
  { key: 'steps', label: 'Steps', unit: 'steps', emoji: '👟', hint: `1 XP / 1k · cap ${STEPS_XP_CAP}` },
  { key: 'sleep', label: 'Sleep', unit: 'h', emoji: '😴', hint: `≥7h = +${SLEEP_XP} XP` },
  { key: 'hr', label: 'Resting HR', unit: 'bpm', emoji: '🫀', hint: 'tracked, no XP' },
] as const

// F4: body metrics render as instrument rings — ember while filling, gold when banked.
function MetricRing({
  pct,
  value,
  target,
  caption,
}: {
  pct: number
  value: string
  target: string
  caption: string
}) {
  const full = pct >= 1
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
          <circle cx="38" cy="38" r="32" fill="none" stroke="#232d3d" strokeWidth="5" />
          <motion.circle
            cx="38"
            cy="38"
            r="32"
            fill="none"
            stroke={full ? '#f0b429' : '#ff5c38'}
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: Math.min(pct, 1) }}
            transition={{ type: 'spring', stiffness: 55, damping: 15 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`num text-sm font-bold ${full ? 'text-gold' : 'text-bone'}`}>
            {value}
          </span>
          <span className="num text-[9px] text-dim">{target}</span>
        </div>
      </div>
      <span className="hud-label !text-[9px]">{caption}</span>
    </div>
  )
}

export function HealthScreen({
  health,
  onChange,
}: {
  health: DayHealth | undefined
  onChange: (key: keyof DayHealth, value: string) => void
}) {
  const earned = healthEarned(health)
  const steps = parseFloat(health?.steps ?? '0') || 0
  const sleep = parseFloat(health?.sleep ?? '0') || 0

  return (
    <div className="space-y-4">
      <div className="plate plate-raised p-5">
        <div className="hud-label text-center">Health XP today</div>
        <div className="mt-3 flex items-center justify-around">
          <MetricRing
            pct={steps / (STEPS_XP_CAP * 1000)}
            value={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`}
            target={`of ${STEPS_XP_CAP}k`}
            caption="Steps"
          />
          <div className="text-center">
            <div className="num font-display text-4xl font-bold text-sage">
              +<AnimatedNumber value={earned} />
            </div>
            <div className="num mt-1 text-[10px] text-ash">
              {stepsXp(steps)} steps · {sleepXp(sleep)} sleep
            </div>
          </div>
          <MetricRing
            pct={sleep / 7}
            value={sleep ? `${sleep}h` : '—'}
            target="of 7h+"
            caption="Sleep"
          />
        </div>
      </div>

      <div className="space-y-2">
        {FIELDS.map((f, i) => (
          <motion.label
            key={f.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="chip flex items-center gap-4 border border-line bg-plate px-4 py-3.5"
          >
            <span className="text-2xl">{f.emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-bone">{f.label}</div>
              <div className="text-[10px] text-dim">{f.hint}</div>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={health?.[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder="—"
              className="num chip w-24 border border-line bg-ink px-3 py-2 text-right text-sm font-semibold outline-none placeholder:text-dim focus:border-sage/50"
            />
            <span className="w-10 text-[10px] text-dim">{f.unit}</span>
          </motion.label>
        ))}
      </div>

      <div className="chip border border-dashed border-line p-4 text-center text-xs text-dim">
        Manual entry for now — Phase 3 automates steps &amp; sleep. 🫀
      </div>
    </div>
  )
}
