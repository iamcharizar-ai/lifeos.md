import { useState } from 'react'
import { motion } from 'framer-motion'
import { TIER_XP, type Habit, type Tier } from '../config/habits'
import { habitXp } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { metricsComplete, METRICS_BONUS, type DayMetrics } from '../lib/ledger'

// Tier = XP value class → shades of the currency, not new hues.
export const TIER_META: Record<
  Tier,
  { label: string; accent: string; ring: string; chip: string; head: string }
> = {
  core: {
    label: 'Core',
    accent: 'border-gold-dim bg-gold/10',
    ring: 'text-gold',
    chip: 'border border-gold-dim bg-gold/10 text-gold',
    head: '!text-gold',
  },
  standard: {
    label: 'Standard',
    accent: 'border-line2 bg-plate2',
    ring: 'text-bone',
    chip: 'border border-line2 bg-plate2 text-bone',
    head: '!text-bone',
  },
  basic: {
    label: 'Basic',
    accent: 'border-line bg-plate',
    ring: 'text-ash',
    chip: 'border border-line bg-plate text-ash',
    head: '',
  },
}

const METRIC_FIELDS = [
  { key: 'weight', label: 'Weight', unit: 'kg', emoji: '⚖️' },
  { key: 'kcal', label: 'Calories', unit: 'kcal', emoji: '🔥' },
  { key: 'protein', label: 'Protein', unit: 'g', emoji: '🥚' },
] as const

export function HabitsScreen({
  habits,
  ticks,
  today,
  onToggle,
  onCycleTier,
  metrics,
  onMetric,
}: {
  habits: Habit[]
  ticks: Ticks
  today: string
  onToggle: (habitId: string) => void
  onCycleTier: (habitId: string) => void
  metrics: DayMetrics | undefined
  onMetric: (key: keyof DayMetrics, value: string) => void
}) {
  const todayTicks = ticks[today] ?? {}
  const [editTiers, setEditTiers] = useState(false)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] text-dim">
          {editTiers
            ? 'tap a habit to move it between tiers'
            : 'list follows templates/daily-template.md'}
        </span>
        <button
          onClick={() => setEditTiers((v) => !v)}
          className={`chip border px-3 py-1 font-display text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            editTiers
              ? 'border-gold-dim bg-gold/10 text-gold'
              : 'border-line bg-plate text-ash hover:border-line2'
          }`}
        >
          {editTiers ? 'done' : '⚙️ tiers'}
        </button>
      </div>
      {(['core', 'standard', 'basic'] as Tier[]).map((tier) => {
        const meta = TIER_META[tier]
        const list = habits.filter((h) => h.tier === tier)
        return (
          <section key={tier} className="mb-7">
            <div className="mb-3 flex items-center gap-2">
              <h2 className={`hud-label ${meta.head}`}>{meta.label}</h2>
              <span className={`chip num px-2 py-0.5 text-[10px] font-semibold ${meta.chip}`}>
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
                    onClick={() => (editTiers ? onCycleTier(h.id) : onToggle(h.id))}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 24 }}
                    whileTap={{ scale: 0.94 }}
                    className={`chip flex items-center gap-3 border px-4 py-3 text-left transition-colors ${
                      ticked ? meta.accent : 'border-line bg-plate hover:border-line2'
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
                      className={`flex-1 text-sm font-medium ${ticked ? 'text-bone' : 'text-ash'}`}
                    >
                      {h.name}
                    </span>
                    {streak >= 3 && (
                      <span className="num text-xs font-semibold text-ember">🔥{streak}</span>
                    )}
                    <span
                      className={`num text-xs font-bold ${ticked ? meta.ring : 'text-dim'}`}
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
          <h2 className="hud-label !text-sage">Metrics</h2>
          <span
            className={`chip num px-2 py-0.5 text-[10px] font-semibold ${
              metricsComplete(metrics)
                ? 'border border-sage/40 bg-sage/10 text-sage'
                : 'border border-line bg-plate text-ash'
            }`}
          >
            {metricsComplete(metrics) ? `+${METRICS_BONUS} earned` : `all 3 = +${METRICS_BONUS} XP`}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {METRIC_FIELDS.map((f) => (
            <label
              key={f.key}
              className="chip flex flex-col gap-1 border border-line bg-plate px-3 py-2.5"
            >
              <span className="hud-label !text-[9px]">
                {f.emoji} {f.label}
              </span>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={metrics?.[f.key] ?? ''}
                  onChange={(e) => onMetric(f.key, e.target.value)}
                  placeholder="—"
                  className="num w-full bg-transparent text-sm font-semibold text-bone outline-none placeholder:text-dim"
                />
                <span className="text-[10px] text-dim">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
