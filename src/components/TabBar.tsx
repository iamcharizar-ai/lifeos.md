import { motion } from 'framer-motion'

// Health + Train tabs retired 2026-07-10: health data now arrives via the
// Google Health pipeline (ghealth/JARVIS) and workouts via Project Strong —
// both land in the same ledger events, so state/XP/write-back are unchanged.
// Body tab (skill constellation) retired 2026-07-11: skills live in ARBOR
// (dev/arbor, port 5178), which syncs straight to the vault. Skill state and
// its cloud events are kept so old ledgers still replay cleanly.
// Wallet + Graph tabs retired 2026-07-13: LifeOS is a habit tracker, not a
// currency/economy app (Rishabh's call) — see wiki/outputs/system-simplification-2026-07-13.
// Spend ledger events + skill cloud events are kept so old history replays.
export type Tab = 'daily' | 'monthly'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'daily', emoji: '⚡', label: 'Daily' },
  { id: 'monthly', emoji: '📅', label: 'Monthly' },
]

export function TabBar({
  tab,
  onChange,
  alerts,
}: {
  tab: Tab
  onChange: (t: Tab) => void
  /** tabs wearing a red attention dot (e.g. health when thirsty) */
  alerts?: Partial<Record<Tab, boolean>>
}) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t-4 border-black bg-neo-white">
      <div className="mx-auto flex max-w-md items-stretch justify-around sm:max-w-2xl lg:max-w-4xl">
        {TABS.map((t) => {
          const alerted = Boolean(alerts?.[t.id])
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-glow"
                  className="absolute top-0 h-1.5 w-12 bg-neo-blue border-x-2 border-b-2 border-black rounded-b-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={`relative text-lg ${tab === t.id ? '' : 'opacity-40 grayscale'} ${
                  alerted ? 'animate-pulse !opacity-100 !grayscale-0' : ''
                }`}
              >
                {t.emoji}
                {alerted && (
                  <span className="absolute -right-1.5 -top-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neo-red opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-black bg-neo-red" />
                  </span>
                )}
              </span>
              <span
                className={`font-display text-[10px] font-bold uppercase tracking-[0.1em] ${
                  tab === t.id ? 'text-neo-blue' : alerted ? 'text-neo-red' : 'text-neo-gray-dark'
                }`}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
