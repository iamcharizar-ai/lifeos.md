import { motion } from 'framer-motion'
import { sleepXp, stepsXp, STEPS_XP_CAP, SLEEP_XP } from '../lib/xp'
import { healthEarned, type DayHealth } from '../lib/ledger'
import { AnimatedNumber } from '../components/AnimatedNumber'

const FIELDS = [
  { key: 'steps', label: 'Steps', unit: 'steps', emoji: '👟', hint: `1 XP / 1k · cap ${STEPS_XP_CAP}` },
  { key: 'sleep', label: 'Sleep', unit: 'h', emoji: '😴', hint: `≥7h = +${SLEEP_XP} XP` },
  { key: 'hr', label: 'Resting HR', unit: 'bpm', emoji: '🫀', hint: 'tracked, no XP' },
] as const

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
      <div className="plate p-5 text-center">
        <div className="hud-label">Health XP today</div>
        <div className="num mt-2 font-display text-4xl font-bold text-sage">
          +<AnimatedNumber value={earned} />
        </div>
        <div className="num mt-1 text-xs text-ash">
          {stepsXp(steps)} from steps · {sleepXp(sleep)} from sleep
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
