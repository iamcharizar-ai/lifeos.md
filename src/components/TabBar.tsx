import { motion } from 'framer-motion'

// Two tabs, by design. The Library tab merged back into Daily (2026-09-07):
// shaping the day and running it were one job split across two screens, so the
// checklist, the shelf of switched-off habits, and the add/edit/reorder
// controls all live on Daily now. Monthly is read-only history.
export type Tab = 'daily' | 'monthly'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'daily', emoji: '⚡', label: 'Daily' },
  { id: 'monthly', emoji: '📅', label: 'Monthly' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t-4 border-black bg-neo-white">
      <div className="mx-auto flex max-w-md items-stretch justify-around sm:max-w-2xl lg:max-w-4xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5"
          >
            {tab === t.id && (
              <motion.span
                layoutId="tab-glow"
                className="absolute top-0 h-1.5 w-12 rounded-b-md border-x-2 border-b-2 border-black bg-neo-blue"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative text-lg ${tab === t.id ? '' : 'opacity-40 grayscale'}`}>
              {t.emoji}
            </span>
            <span
              className={`font-display text-[10px] font-bold uppercase tracking-[0.1em] ${
                tab === t.id ? 'text-neo-blue' : 'text-neo-gray-dark'
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
