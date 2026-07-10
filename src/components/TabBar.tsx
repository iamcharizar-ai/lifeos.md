import { motion } from 'framer-motion'

// Health + Train tabs retired 2026-07-10: health data now arrives via the
// Google Health pipeline (ghealth/JARVIS) and workouts via Project Strong —
// both land in the same ledger events, so state/XP/write-back are unchanged.
export type Tab = 'dashboard' | 'habits' | 'body' | 'wallet' | 'graph'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'dashboard', emoji: '🎛️', label: 'HUD' },
  { id: 'habits', emoji: '✅', label: 'Habits' },
  { id: 'body', emoji: '🧗', label: 'Body' },
  { id: 'wallet', emoji: '💠', label: 'Wallet' },
  { id: 'graph', emoji: '🕸️', label: 'Graph' },
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
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/90 backdrop-blur">
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
                  className="absolute -top-px h-0.5 w-9 bg-gold"
                  style={{ clipPath: 'polygon(0 0, calc(100% - 3px) 0, 100% 100%, 0 100%)' }}
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
                  <span className="absolute -right-1.5 -top-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ember opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-ember" />
                  </span>
                )}
              </span>
              <span
                className={`font-display text-[9px] font-semibold uppercase tracking-[0.18em] ${
                  tab === t.id ? 'text-gold' : alerted ? 'text-ember' : 'text-dim'
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
