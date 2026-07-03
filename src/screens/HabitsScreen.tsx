import { useState } from 'react'
import { motion } from 'framer-motion'
import { TIER_XP, type Habit, type Tier } from '../config/habits'
import { habitXp } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { metricsComplete, METRICS_BONUS, type DayMetrics } from '../lib/ledger'
import { MonthView } from '../components/MonthView'

// Tier = XP value class → shades of the currency, not new hues. The list is a
// single ordered stack (the day's actual sequence) — tiers show as XP chips.
export const TIER_META: Record<Tier, { ring: string; accent: string }> = {
  core: { ring: 'text-gold', accent: 'border-gold-dim bg-gold/10' },
  standard: { ring: 'text-bone', accent: 'border-line2 bg-plate2' },
  basic: { ring: 'text-ash', accent: 'border-line bg-plate' },
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
  const [view, setView] = useState<'today' | 'month'>('today')
  const doneCount = habits.filter((h) => todayTicks[h.id]).length

  return (
    <div>
      {/* view toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          {(['today', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`chip border px-3 py-1 font-display text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                view === v
                  ? 'border-gold-dim bg-gold/10 text-gold'
                  : 'border-line bg-plate text-ash hover:border-line2'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'today' && (
          <div className="flex items-center gap-2">
            <span className="num text-[10px] text-dim">
              {doneCount}/{habits.length}
            </span>
            <button
              onClick={() => setEditTiers((x) => !x)}
              className={`chip border px-3 py-1 font-display text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                editTiers
                  ? 'border-gold-dim bg-gold/10 text-gold'
                  : 'border-line bg-plate text-ash hover:border-line2'
              }`}
            >
              {editTiers ? 'done' : '⚙️ xp'}
            </button>
          </div>
        )}
      </div>

      {view === 'month' ? (
        <MonthView habits={habits} ticks={ticks} today={today} />
      ) : (
        <>
          {editTiers && (
            <div className="mb-3 text-center text-[10px] text-dim">
              tap a habit to cycle its XP tier · {TIER_XP.core}/{TIER_XP.standard}/{TIER_XP.basic}
            </div>
          )}

          {/* the stack — one ordered vertical list, the day in sequence */}
          <div className="space-y-1.5">
            {habits.map((h, i) => {
              const ticked = Boolean(todayTicks[h.id])
              const streak = streakFor(ticks, h.id, today)
              const xp = habitXp(h.tier, ticked ? streak : streak + 1)
              const meta = TIER_META[h.tier]
              return (
                <motion.button
                  key={h.id}
                  onClick={() => (editTiers ? onCycleTier(h.id) : onToggle(h.id))}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.012, 0.5), type: 'spring', stiffness: 260, damping: 24 }}
                  whileTap={{ scale: 0.97 }}
                  className={`chip flex w-full items-center gap-3 border px-3.5 py-2 text-left transition-colors ${
                    ticked ? meta.accent : 'border-line bg-plate hover:border-line2'
                  }`}
                >
                  <span className="num w-5 shrink-0 text-right text-[9px] text-dim">{i + 1}</span>
                  <motion.span
                    animate={ticked ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : {}}
                    transition={{ duration: 0.3 }}
                    className="text-lg leading-none"
                  >
                    {h.emoji}
                  </motion.span>
                  <span
                    className={`flex-1 truncate text-[13px] font-medium ${
                      ticked ? 'text-bone' : 'text-ash'
                    }`}
                  >
                    {h.name}
                  </span>
                  {streak >= 3 && (
                    <span className="num shrink-0 text-[10px] font-semibold text-ember">
                      🔥{streak}
                    </span>
                  )}
                  <span
                    className={`num shrink-0 text-xs font-bold ${ticked ? meta.ring : 'text-dim'}`}
                  >
                    {ticked ? `+${xp}` : xp}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* Metrics */}
          <section className="mb-7 mt-6">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="hud-label !text-sage">Metrics</h2>
              <span
                className={`chip num px-2 py-0.5 text-[10px] font-semibold ${
                  metricsComplete(metrics)
                    ? 'border border-sage/40 bg-sage/10 text-sage'
                    : 'border border-line bg-plate text-ash'
                }`}
              >
                {metricsComplete(metrics)
                  ? `+${METRICS_BONUS} earned`
                  : `all 3 = +${METRICS_BONUS} XP`}
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
        </>
      )}
    </div>
  )
}
