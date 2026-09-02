// The habit library — every habit ever created, live or dropped.
// One tap puts a habit on today's checklist or takes it off; nothing here
// deletes history, so a dropped habit still renders in the months it ran.
// Permanent erase is deliberately gated to entries that were never ticked.
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  EPOCH_DAY,
  TIER_XP,
  archivedOn,
  firstDay,
  habitIdFor,
  isLive,
  type Habit,
  type Tier,
} from '../config/habits'
import type { Ticks } from '../lib/store'

function prettyDay(iso: string): string {
  if (iso === EPOCH_DAY) return 'the start'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export function LibraryScreen({
  habits,
  ticks,
  onToggleLive,
  onAdd,
  onPurge,
}: {
  habits: Habit[]
  ticks: Ticks
  onToggleLive: (habitId: string) => void
  onAdd: (habit: Omit<Habit, 'spans'>) => void
  onPurge: (habitId: string) => void
}) {
  const [manage, setManage] = useState(false)
  const [newEmoji, setNewEmoji] = useState('⭐')
  const [newName, setNewName] = useState('')
  const [newTier, setNewTier] = useState<Tier>('standard')
  const [error, setError] = useState<string | null>(null)

  // Lifetime ticks per habit — doubles as the guard on permanent erase.
  const tickCount = useMemo(() => {
    const out: Record<string, number> = {}
    for (const day of Object.values(ticks))
      for (const id of Object.keys(day)) out[id] = (out[id] ?? 0) + 1
    return out
  }, [ticks])

  const live = habits.filter(isLive)
  const dropped = habits.filter((h) => !isLive(h))

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = habitIdFor(name)
    if (habits.some((h) => h.id === id)) {
      setError(`"${name}" is already in the library — tap it to switch it on.`)
      return
    }
    onAdd({ id, name, emoji: newEmoji.trim() || '⭐', tier: newTier })
    setNewName('')
    setNewEmoji('⭐')
    setError(null)
  }

  const Tile = ({ h }: { h: Habit }) => {
    const on = isLive(h)
    const count = tickCount[h.id] ?? 0
    const dropDay = archivedOn(h)
    return (
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => onToggleLive(h.id)}
        title={
          on
            ? `On the checklist since ${prettyDay(firstDay(h))} — tap to drop`
            : `Dropped ${dropDay ? prettyDay(dropDay) : ''} — tap to bring back`
        }
        className={`neo-button relative flex flex-col items-center gap-1 px-2 py-3 text-center ${
          on ? 'neo-card-green' : 'bg-neo-white opacity-60 grayscale'
        }`}
      >
        <span className="text-2xl leading-none">{h.emoji}</span>
        <span className="w-full truncate text-[11px] font-bold text-black">{h.name}</span>
        <span className="num text-[9px] font-bold text-black/60">
          {TIER_XP[h.tier]} XP · {count}✓
        </span>
        {on ? (
          <span className="absolute right-1 top-1 text-[9px] font-bold text-black/50">ON</span>
        ) : (
          <span className="absolute right-1 top-1 text-[9px] font-bold text-black/50">OFF</span>
        )}
        {manage && count === 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Erase ${h.name} permanently`}
            onClick={(e) => {
              e.stopPropagation()
              onPurge(h.id)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                onPurge(h.id)
              }
            }}
            className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center border-2 border-black bg-neo-red text-[10px] font-bold text-white"
          >
            ✕
          </span>
        )}
      </motion.button>
    )
  }

  return (
    <div className="space-y-4">
      <div className="neo-card neo-card-blue p-4">
        <div className="hud-label border-black">Habit Library</div>
        <p className="mt-2 text-xs font-bold leading-relaxed text-black">
          Every habit you have ever made. Tap one to switch it on or off for today — dropping a
          habit never erases its past, it just leaves today&apos;s checklist.
        </p>
        <div className="num mt-2 text-xs font-bold text-black/70">
          {live.length} on · {dropped.length} off · {habits.length} total
        </div>
      </div>

      {error && (
        <div className="neo-card bg-neo-red px-3 py-2 text-xs font-bold text-white">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="hud-label border-black text-sm">On the checklist</div>
        <button
          onClick={() => setManage((m) => !m)}
          className={`neo-button px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black ${
            manage ? 'neo-card-pink' : 'bg-white'
          }`}
        >
          {manage ? '✓ Done' : '🗑️ Clean up'}
        </button>
      </div>

      {manage && (
        <div className="neo-card bg-white px-3 py-2 text-[11px] font-bold text-neo-gray-dark">
          The ✕ only shows on habits that were never ticked. Anything with history can be switched
          off, never erased — the monthly review needs it.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {live.map((h) => (
          <Tile key={h.id} h={h} />
        ))}
        {live.length === 0 && (
          <div className="col-span-full neo-card bg-white px-3 py-4 text-center text-xs font-bold text-neo-gray-dark">
            Nothing on the checklist. Tap a habit below to bring it back.
          </div>
        )}
      </div>

      {dropped.length > 0 && (
        <>
          <div className="hud-label border-black text-sm">Dropped</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {dropped.map((h) => (
              <Tile key={h.id} h={h} />
            ))}
          </div>
        </>
      )}

      <form onSubmit={handleAdd} className="neo-card space-y-2 bg-white p-4">
        <div className="border-b-2 border-black pb-1 text-xs font-bold uppercase tracking-wider text-neo-gray-dark">
          + New Habit
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value)}
            placeholder="Emoji"
            className="w-12 border-2 border-black bg-neo-bg px-2 py-1.5 text-center text-sm font-bold"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Habit name (e.g. Meditate)"
            className="min-w-[140px] flex-1 border-2 border-black bg-neo-bg px-3 py-1.5 text-sm font-bold"
          />
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value as Tier)}
            className="border-2 border-black bg-neo-bg px-2 py-1.5 text-xs font-bold"
          >
            <option value="core">Core ({TIER_XP.core} XP)</option>
            <option value="standard">Standard ({TIER_XP.standard} XP)</option>
            <option value="basic">Basic ({TIER_XP.basic} XP)</option>
          </select>
          <button
            type="submit"
            className="neo-button neo-card-yellow px-4 py-1.5 text-xs font-bold uppercase"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  )
}
