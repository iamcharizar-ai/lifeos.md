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
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Health XP today
        </div>
        <div className="mt-2 text-4xl font-bold tabular-nums text-emerald-300">
          +<AnimatedNumber value={earned} />
        </div>
        <div className="mt-1 text-xs text-zinc-500">
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
            className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5"
          >
            <span className="text-2xl">{f.emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-300">{f.label}</div>
              <div className="text-[10px] text-zinc-600">{f.hint}</div>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={health?.[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder="—"
              className="w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right text-sm font-semibold tabular-nums outline-none focus:border-emerald-400/50 placeholder:text-zinc-700"
            />
            <span className="w-10 text-[10px] text-zinc-600">{f.unit}</span>
          </motion.label>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-600">
        Manual entry for now — Phase 3 wires <span className="text-zinc-400">Health Connect</span>{' '}
        so steps, sleep &amp; HR flow in automatically. 🫀
      </div>
    </div>
  )
}
