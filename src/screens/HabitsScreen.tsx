import { useState } from 'react'
import { motion } from 'framer-motion'
import { TIER_XP, habitIdFor, type Habit, type Tier } from '../config/habits'
import { dayEarned, type Stores } from '../lib/ledger'
import { habitXp, DAILY_CAP } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { MonthView } from '../components/MonthView'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ProgressRing } from '../components/ProgressRing'
import type { Tab } from '../components/TabBar'

const DONE_ACCENT = 'neo-card-green'
const DONE_RING = 'text-black'

export function HabitsScreen({
  tab,
  habits,
  ticks,
  today,
  stores,
  onToggle,
  onSaveHabits,
}: {
  tab: Tab
  habits: Habit[]
  ticks: Ticks
  today: string
  stores: Stores
  onToggle: (habitId: string) => void
  onCycleTier?: (habitId: string) => void
  onSaveHabits: (newHabits: Habit[]) => void
}) {
  const todayTicks = ticks[today] ?? {}
  const [isEditing, setIsEditing] = useState(false)
  const [editList, setEditList] = useState<Habit[]>(habits)
  const [error, setError] = useState<string | null>(null)

  // New habit state
  const [newEmoji, setNewEmoji] = useState('⭐')
  const [newName, setNewName] = useState('')
  const [newTier, setNewTier] = useState<Tier>('standard')

  const todayXp = dayEarned(stores, today)
  const doneCount = habits.filter((h) => todayTicks[h.id]).length

  const streaks = habits
    .map((h) => ({ h, s: streakFor(ticks, h.id, today) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)

  const handleStartEditing = () => {
    setEditList([...habits])
    setError(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setError(null)
    setIsEditing(false)
  }

  const handleSaveEdit = () => {
    const cleaned = editList.map((h) => ({
      ...h,
      name: h.name.trim(),
      emoji: h.emoji.trim() || '⭐',
    }))
    if (cleaned.length === 0) {
      setError('Keep at least one habit.')
      return
    }
    if (cleaned.some((h) => !h.name)) {
      setError('Every habit needs a name.')
      return
    }
    const ids = new Set<string>()
    for (const h of cleaned) {
      if (ids.has(h.id)) {
        setError(`Two habits share the id "${h.id}" — rename one.`)
        return
      }
      ids.add(h.id)
    }
    setError(null)
    onSaveHabits(cleaned)
    setIsEditing(false)
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= editList.length) return
    const updated = [...editList]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp
    setEditList(updated)
  }

  const handleUpdateItem = (index: number, key: keyof Habit, val: string) => {
    const updated = [...editList]
    updated[index] = { ...updated[index], [key]: val }
    setEditList(updated)
  }

  const handleDeleteItem = (index: number) => {
    if (editList.length <= 1) {
      setError('Keep at least one habit.')
      return
    }
    const updated = editList.filter((_, i) => i !== index)
    setEditList(updated)
  }

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = habitIdFor(name)
    if (editList.some((h) => h.id === id)) {
      setError(`"${name}" already exists.`)
      return
    }
    const newHabit: Habit = {
      id,
      name,
      emoji: newEmoji.trim() || '⭐',
      tier: newTier,
    }
    setEditList([...editList, newHabit])
    setNewName('')
    setNewEmoji('⭐')
    setError(null)
  }

  if (tab === 'monthly') {
    return <MonthView habits={habits} ticks={ticks} today={today} />
  }

  return (
    <div className="space-y-4">
      {/* Neo-Brutalist Compact Hero Card */}
      <div className="neo-card neo-card-yellow p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="hud-label border-black">Today&apos;s XP</div>
            <div className="num mt-1 font-display text-3xl font-bold tracking-tight text-black">
              <AnimatedNumber value={todayXp} />
              <span className="ml-1.5 font-sans text-sm font-bold text-black/70">/ {DAILY_CAP}</span>
            </div>
            {streaks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {streaks.map(({ h, s }) => (
                  <span
                    key={h.id}
                    className="inline-flex items-center gap-1 border-2 border-black bg-white px-2 py-0.5 text-[11px] font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {h.emoji} 🔥{s}d
                  </span>
                ))}
              </div>
            )}
          </div>
          <ProgressRing pct={habits.length > 0 ? doneCount / habits.length : 0} label={`${doneCount}/${habits.length}`} size={68} />
        </div>
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between">
        <div className="hud-label border-black text-sm">
          {isEditing ? 'Habit Manager' : 'Daily Checklist'}
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="neo-button bg-white px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="neo-button neo-card-green px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black"
            >
              ✓ Save Changes
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartEditing}
            className="neo-button neo-card-pink px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-black"
          >
            ⚙️ Edit Habits
          </button>
        )}
      </div>

      {/* Editor View vs Normal View */}
      {isEditing ? (
        <div className="space-y-3">
          {error && (
            <div className="neo-card bg-neo-red px-3 py-2 text-xs font-bold text-white">
              {error}
            </div>
          )}
          <div className="neo-card p-4 space-y-3 bg-white">
            <div className="text-xs font-bold uppercase tracking-wider text-neo-gray-dark border-b-2 border-black pb-1">
              Reorder & Edit Habits
            </div>
            {editList.map((h, i) => (
              <div
                key={h.id + i}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-2 border-black p-2 bg-neo-bg rounded-md"
              >
                {/* Reorder Buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMove(i, -1)}
                    disabled={i === 0}
                    className="neo-button px-2 py-1 text-xs disabled:opacity-30 disabled:pointer-events-none"
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMove(i, 1)}
                    disabled={i === editList.length - 1}
                    className="neo-button px-2 py-1 text-xs disabled:opacity-30 disabled:pointer-events-none"
                    title="Move Down"
                  >
                    ▼
                  </button>
                </div>

                {/* Emoji Input */}
                <input
                  type="text"
                  value={h.emoji}
                  onChange={(e) => handleUpdateItem(i, 'emoji', e.target.value)}
                  className="w-10 border-2 border-black px-1.5 py-1 text-center font-bold text-sm bg-white"
                />

                {/* Name Input */}
                <input
                  type="text"
                  value={h.name}
                  onChange={(e) => handleUpdateItem(i, 'name', e.target.value)}
                  className="flex-1 border-2 border-black px-2 py-1 font-bold text-sm bg-white min-w-[120px]"
                />

                {/* Tier selector */}
                <button
                  onClick={() => {
                    const tiers: Tier[] = ['core', 'standard', 'basic']
                    const next = tiers[(tiers.indexOf(h.tier) + 1) % tiers.length]
                    handleUpdateItem(i, 'tier', next)
                  }}
                  className="neo-button px-2 py-1 text-[11px] font-bold uppercase"
                >
                  {h.tier} ({TIER_XP[h.tier]} XP)
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteItem(i)}
                  disabled={editList.length <= 1}
                  className="neo-button bg-neo-red text-white px-2 py-1 text-xs font-bold disabled:opacity-30 disabled:pointer-events-none"
                  title="Delete Habit"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* Add Habit Form */}
          <form onSubmit={handleAddHabit} className="neo-card p-4 space-y-2 bg-white">
            <div className="text-xs font-bold uppercase tracking-wider text-neo-gray-dark border-b-2 border-black pb-1">
              + Add New Habit
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                placeholder="Emoji"
                className="w-12 border-2 border-black px-2 py-1.5 text-center font-bold bg-neo-bg text-sm"
              />
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Habit Title (e.g. Meditate)"
                className="flex-1 border-2 border-black px-3 py-1.5 font-bold bg-neo-bg text-sm min-w-[140px]"
              />
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as Tier)}
                className="border-2 border-black px-2 py-1.5 font-bold bg-neo-bg text-xs"
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
      ) : (
        /* Normal Habit List */
        <div className="space-y-2">
          {habits.map((h, i) => {
            const ticked = Boolean(todayTicks[h.id])
            const streak = streakFor(ticks, h.id, today)
            const xp = habitXp(h.tier, ticked ? streak : streak + 1)
            return (
              <motion.div
                key={h.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onToggle(h.id)}
                className={`neo-button flex w-full items-center gap-3 px-4 py-3 text-left ${
                  ticked ? DONE_ACCENT : 'bg-neo-white'
                }`}
              >
                <span className={`num w-6 shrink-0 text-right text-xs font-bold ${ticked ? 'text-black/50' : 'text-neo-gray-dark'}`}>
                  {i + 1}
                </span>
                <motion.span
                  animate={ticked ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : {}}
                  transition={{ duration: 0.3 }}
                  className="text-xl leading-none"
                >
                  {h.emoji}
                </motion.span>
                <span
                  className={`flex-1 truncate text-base font-bold ${
                    ticked ? 'text-black line-through opacity-80' : 'text-neo-black'
                  }`}
                >
                  {h.name}
                </span>
                {streak >= 3 && (
                  <span className="num shrink-0 text-xs font-bold text-neo-red">
                    🔥{streak}
                  </span>
                )}
                <span
                  className={`num shrink-0 text-base font-bold ${
                    ticked ? DONE_RING : 'text-neo-gray-dark'
                  }`}
                >
                  {ticked ? `+${xp}` : xp}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
