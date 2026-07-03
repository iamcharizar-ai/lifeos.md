import { motion } from 'framer-motion'
import { HABITS, TIER_XP, type Tier } from '../config/habits'
import { habitXp } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { metricsComplete, METRICS_BONUS, type DayMetrics } from '../lib/ledger'

export const TIER_META: Record<Tier, { label: string; accent: string; ring: string; chip: string }> = {
  core: {
    label: 'Core',
    accent: 'border-amber-400/60 bg-amber-400/10',
    ring: 'text-amber-400',
    chip: 'bg-amber-400/15 text-amber-300',
  },
  standard: {
    label: 'Standard',
    accent: 'border-cyan-400/60 bg-cyan-400/10',
    ring: 'text-cyan-400',
    chip: 'bg-cyan-400/15 text-cyan-300',
  },
  basic: {
    label: 'Basic',
    accent: 'border-zinc-400/60 bg-zinc-400/10',
    ring: 'text-zinc-300',
    chip: 'bg-zinc-400/15 text-zinc-300',
  },
}

const METRIC_FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'kg', emoji: '⚖️' },
  { key: 'kcal', label: 'Calories', unit: 'kcal', emoji: '🔥' },
  { key: 'protein', label: 'Protein', unit: 'g', emoji: '🥚' },
] as const

export function HabitsScreen({
  ticks,
  today,
  onToggle,
  metrics,
  onMetric,
}: {
  ticks: Ticks
  today: string
  onToggle: (habitId: string) => void
  metrics: DayMetrics | undefined
  onMetric: (key: keyof DayMetrics, value: string) => void
}) {
  const todayTicks = ticks[today] ?? {}

  return (
    <div>
      {(['core', 'standard', 'basic'] as Tier[]).map((tier) => {
        const meta = TIER_META[tier]
        const list = HABITS.filter((h) => h.tier === tier)
        return (
          <section key={tier} className="mb-7">
            <div className="mb-3 flex items-center gap-2">
              <h2 className={`text-xs font-bold uppercase tracking-widest ${meta.ring}`}>
                {meta.label}
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}>
                {TIER_XP[tier]} XP
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((h, i) => {
                const ticked = Boolean(todayTicks[h.id])
                const streak = streakFor(ticks, h.id, today)
                const xp = habitXp(h.tier, ticked ? streak : streak + 1)
                return (
                  <motion.button
                    key={h.id}
                    onClick={() => onToggle(h.id)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 24 }}
                    whileTap={{ scale: 0.94 }}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                      ticked ? meta.accent : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                    }`}
                  >
                    <motion.span
                      animate={ticked ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] } : {}}
                      transition={{ duration: 0.35 }}
                      className="text-xl"
                    >
                      {h.emoji}
                    </motion.span>
                    <span
                      className={`flex-1 text-sm font-medium ${
                        ticked ? 'text-zinc-100' : 'text-zinc-400'
                      }`}
                    >
                      {h.name}
                    </span>
                    {streak >= 3 && (
                      <span className="text-xs font-semibold text-orange-400">🔥{streak}</span>
                    )}
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        ticked ? meta.ring : 'text-zinc-600'
                      }`}
                    >
                      {ticked ? `+${xp}` : xp}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Metrics */}
      <section className="mb-7">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Metrics</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              metricsComplete(metrics)
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'bg-zinc-400/15 text-zinc-400'
            }`}
          >
            {metricsComplete(metrics) ? `+${METRICS_BONUS} earned` : `all 3 = +${METRICS_BONUS} XP`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {METRIC_FIELDS.map((f) => (
            <label
              key={f.key}
              className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {f.emoji} {f.label}
              </span>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={metrics?.[f.key] ?? ''}
                  onChange={(e) => onMetric(f.key, e.target.value)}
                  placeholder="—"
                  className="w-full bg-transparent text-sm font-semibold tabular-nums outline-none placeholder:text-zinc-700"
                />
                <span className="text-[10px] text-zinc-600">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
