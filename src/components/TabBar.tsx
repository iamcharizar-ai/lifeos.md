import { motion } from 'framer-motion'

export type Tab = 'dashboard' | 'habits' | 'health' | 'body' | 'wallet' | 'graph'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'dashboard', emoji: '🎛️', label: 'HUD' },
  { id: 'habits', emoji: '✅', label: 'Habits' },
  { id: 'health', emoji: '🫀', label: 'Health' },
  { id: 'body', emoji: '🧗', label: 'Body' },
  { id: 'wallet', emoji: '💠', label: 'Wallet' },
  { id: 'graph', emoji: '🕸️', label: 'Graph' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-around sm:max-w-2xl">
        {TABS.map((t) => (
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
            <span className={`text-lg ${tab === t.id ? '' : 'opacity-40 grayscale'}`}>
              {t.emoji}
            </span>
            <span
              className={`font-display text-[9px] font-semibold uppercase tracking-[0.18em] ${
                tab === t.id ? 'text-gold' : 'text-dim'
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
