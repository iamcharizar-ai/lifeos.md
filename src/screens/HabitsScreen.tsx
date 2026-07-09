import { useCallback, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { TIER_XP, type Habit } from '../config/habits'
import { habitXp } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { MonthView } from '../components/MonthView'

// Done is done — every completed habit wears the same gold, whatever it pays.
// Tier only decides the XP number, never the color (green tea must read as
// ticked exactly like L-sit does).
const DONE_ACCENT = 'border-gold-dim bg-gold/10'
const DONE_RING = 'text-gold'

// React Bits AnimatedList treatment: rows scale/fade with viewport visibility
// inside a dedicated scroll well with edge gradients. One component per row —
// useInView is a hook, so the row owns its own ref.
function AnimatedRow({
  index,
  children,
  onClick,
}: {
  index: number
  children: React.ReactNode
  onClick: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.5 })
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay: 0.05 }}
      onClick={onClick}
      className="cursor-pointer"
    >
      {children}
    </motion.div>
  )
}

export function HabitsScreen({
  habits,
  ticks,
  today,
  onToggle,
  onCycleTier,
}: {
  habits: Habit[]
  ticks: Ticks
  today: string
  onToggle: (habitId: string) => void
  onCycleTier: (habitId: string) => void
}) {
  const todayTicks = ticks[today] ?? {}
  const [editTiers, setEditTiers] = useState(false)
  const [view, setView] = useState<'today' | 'month'>('today')
  const [topFade, setTopFade] = useState(0)
  const [bottomFade, setBottomFade] = useState(1)
  const doneCount = habits.filter((h) => todayTicks[h.id]).length

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    setTopFade(Math.min(scrollTop / 50, 1))
    const bottomDistance = scrollHeight - (scrollTop + clientHeight)
    setBottomFade(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1))
  }, [])

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

          {/* the stack — one ordered scroll well, the day in sequence */}
          <div className="relative">
            <div
              onScroll={handleScroll}
              className="scroll-list max-h-[62vh] space-y-1.5 overflow-y-auto pb-2 pr-1"
            >
              {habits.map((h, i) => {
                const ticked = Boolean(todayTicks[h.id])
                const streak = streakFor(ticks, h.id, today)
                const xp = habitXp(h.tier, ticked ? streak : streak + 1)
                return (
                  <AnimatedRow
                    key={h.id}
                    index={i}
                    onClick={() => (editTiers ? onCycleTier(h.id) : onToggle(h.id))}
                  >
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      className={`chip flex w-full items-center gap-3 border px-3.5 py-2 text-left transition-colors ${
                        ticked ? DONE_ACCENT : 'border-line bg-plate hover:border-line2'
                      }`}
                    >
                      <span className="num w-5 shrink-0 text-right text-[9px] text-dim">
                        {i + 1}
                      </span>
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
                        className={`num shrink-0 text-xs font-bold ${
                          ticked ? DONE_RING : 'text-dim'
                        }`}
                      >
                        {ticked ? `+${xp}` : xp}
                      </span>
                    </motion.div>
                  </AnimatedRow>
                )
              })}
            </div>
            {/* edge gradients — fade with scroll position, AnimatedList-style */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-ink to-transparent transition-opacity duration-300"
              style={{ opacity: topFade }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink to-transparent transition-opacity duration-300"
              style={{ opacity: bottomFade }}
            />
          </div>
        </>
      )}
    </div>
  )
}
