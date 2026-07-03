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
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur">
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
                className="absolute -top-px h-0.5 w-8 rounded-full bg-cyan-400"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`text-lg ${tab === t.id ? '' : 'opacity-50 grayscale'}`}>
              {t.emoji}
            </span>
            <span
              className={`text-[9px] font-semibold uppercase tracking-wider ${
                tab === t.id ? 'text-cyan-300' : 'text-zinc-600'
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
