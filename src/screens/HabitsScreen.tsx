// The one screen that both runs the day and shapes it.
//
// Everything a habit needs is here: drag it into place, tap it to tick, open
// its row to rename / re-tier / switch off / delete, and add new ones from the
// same place. The old split (add in Library → walk to Daily to arrange) is gone.
// Habits you switch off drop into the Shelf below, still ordered, one tap from
// coming back.
import { useMemo, useRef, useState } from 'react'
import { Reorder, motion, useDragControls } from 'framer-motion'
import { TIERS, TIER_XP, type Habit, type Tier } from '../config/habits'
import { dayEarned, type Stores } from '../lib/ledger'
import { habitXp, DAILY_CAP } from '../lib/xp'
import { streakFor, type Ticks } from '../lib/store'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ProgressRing } from '../components/ProgressRing'

export interface HabitActions {
  onToggle: (habitId: string) => void
  onToggleLive: (habitId: string, live: boolean) => void
  onEdit: (habitId: string, patch: Partial<Pick<Habit, 'name' | 'emoji' | 'tier'>>) => void
  onDelete: (habitId: string) => void
  onDeleteMany: (habitIds: string[]) => void
  onAdd: (draft: { name: string; emoji: string; tier: Tier }) => string | null
  onReorder: (orderedIds: string[]) => void
}

const HANDLE = (
  <span aria-hidden className="select-none text-base leading-none text-black/35">
    ⠿
  </span>
)

/**
 * Grab bar. Dragging lives here only, so the rest of the row stays tappable.
 * Arrow keys move the row too — dropping the old ▲▼ buttons shouldn't cost
 * keyboard users the ability to reorder at all.
 */
function Grip({
  onPointerDown,
  onNudge,
  label,
}: {
  onPointerDown: (e: React.PointerEvent) => void
  onNudge: (dir: -1 | 1) => void
  label: string
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        onNudge(e.key === 'ArrowUp' ? -1 : 1)
      }}
      aria-label={`Reorder ${label} — drag, or use the arrow keys`}
      title="Drag to reorder (or use ↑ ↓)"
      className="shrink-0 cursor-grab touch-none px-1 py-2 active:cursor-grabbing"
    >
      {HANDLE}
    </button>
  )
}

function TierPicker({ value, onChange }: { value: Tier; onChange: (t: Tier) => void }) {
  return (
    <div className="flex gap-1">
      {TIERS.map((t) => (
        <button
          key={t}
          // TierPicker also renders inside the add-habit <form>; without this a
          // tier tap submits it.
          type="button"
          onClick={() => onChange(t)}
          className={`neo-button px-2 py-1 text-[10px] font-bold uppercase ${
            t === value ? 'neo-card-yellow' : 'bg-white'
          }`}
        >
          {t} · {TIER_XP[t]}
        </button>
      ))}
    </div>
  )
}

/** The expandable editor shared by checklist rows and shelf rows. */
function RowEditor({
  habit,
  live,
  ticked,
  onEdit,
  onToggleLive,
  onDelete,
  onClose,
}: {
  habit: Habit
  live: boolean
  ticked: number
  onEdit: HabitActions['onEdit']
  onToggleLive: HabitActions['onToggleLive']
  onDelete: HabitActions['onDelete']
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  // Text fields are local until blur — otherwise every keystroke would commit a
  // config and fire a cloud event.
  const [name, setName] = useState(habit.name)
  const [emoji, setEmoji] = useState(habit.emoji)
  const commitName = () => {
    const v = name.trim()
    if (!v) return setName(habit.name)
    if (v !== habit.name) onEdit(habit.id, { name: v })
  }
  const commitEmoji = () => {
    const v = emoji.trim() || '⭐'
    setEmoji(v)
    if (v !== habit.emoji) onEdit(habit.id, { emoji: v })
  }
  return (
    <div className="overflow-hidden border-x-2 border-b-2 border-black bg-white">
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            onBlur={commitEmoji}
            aria-label="Emoji"
            className="w-12 border-2 border-black bg-neo-bg px-1 py-1.5 text-center text-sm font-bold"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="Habit name"
            className="min-w-[140px] flex-1 border-2 border-black bg-neo-bg px-2 py-1.5 text-sm font-bold"
          />
        </div>
        <TierPicker value={habit.tier} onChange={(tier) => onEdit(habit.id, { tier })} />
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-black/10 pt-2">
          <button
            onClick={() => {
              commitName()
              commitEmoji()
              onToggleLive(habit.id, !live)
              onClose()
            }}
            className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
          >
            {live ? '↓ Move to shelf' : '↑ Put on today'}
          </button>
          {confirm ? (
            <>
              <button
                onClick={() => onDelete(habit.id)}
                className="neo-button bg-neo-red px-3 py-1.5 text-[11px] font-bold uppercase text-white"
              >
                Delete for good
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
              >
                Keep
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-neo-red"
            >
              🗑 Delete
            </button>
          )}
          <span className="ml-auto text-[10px] font-bold text-neo-gray-dark">
            {ticked}✓ all-time
          </span>
        </div>
        {confirm && (
          <p className="text-[10px] font-bold leading-relaxed text-neo-gray-dark">
            Gone from the library and from this month. Finished months are already sealed —
            they keep showing it.
          </p>
        )}
      </div>
    </div>
  )
}

function ChecklistRow({
  habit,
  ticks,
  today,
  open,
  onOpen,
  onNudge,
  tickCount,
  actions,
}: {
  habit: Habit
  ticks: Ticks
  today: string
  open: boolean
  onOpen: (id: string | null) => void
  onNudge: (dir: -1 | 1) => void
  tickCount: number
  actions: HabitActions
}) {
  const controls = useDragControls()
  const ticked = Boolean(ticks[today]?.[habit.id])
  const streak = streakFor(ticks, habit.id, today)
  const xp = habitXp(habit.tier, ticked ? streak : streak + 1)

  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={controls}
      // position-only: the default also animates size, which scale-squashes the
      // row whenever its editor panel opens.
      layout="position"
      className="list-none"
      // Springy neighbours: rows shove each other aside while you drag.
      transition={{ type: 'spring', stiffness: 600, damping: 42 }}
      whileDrag={{ scale: 1.03, zIndex: 30 }}
    >
      <div
        className={`neo-button flex w-full items-center gap-1 py-1 pl-1 pr-3 text-left ${
          ticked ? 'neo-card-green' : 'bg-neo-white'
        } ${open ? 'mb-0' : ''}`}
      >
        <Grip
          label={habit.name}
          onNudge={onNudge}
          onPointerDown={(e) => {
            onOpen(null) // never drag a row with its editor panel hanging off it
            controls.start(e)
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => actions.onToggle(habit.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              actions.onToggle(habit.id)
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-3 py-2"
        >
          <motion.span
            animate={ticked ? { scale: [1, 1.3, 1], rotate: [0, -8, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="text-xl leading-none"
          >
            {habit.emoji}
          </motion.span>
          <span
            className={`flex-1 truncate text-base font-bold ${
              ticked ? 'text-black line-through opacity-80' : 'text-neo-black'
            }`}
          >
            {habit.name}
          </span>
          {streak >= 3 && (
            <span className="num shrink-0 text-xs font-bold text-neo-red">🔥{streak}</span>
          )}
          <span
            className={`num shrink-0 text-base font-bold ${
              ticked ? 'text-black' : 'text-neo-gray-dark'
            }`}
          >
            {ticked ? `+${xp}` : xp}
          </span>
        </div>
        <button
          onClick={() => onOpen(open ? null : habit.id)}
          aria-label={`Edit ${habit.name}`}
          aria-expanded={open}
          className="shrink-0 px-1 py-2 text-sm font-bold text-black/40"
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
      {open && (
        <RowEditor
          habit={habit}
          live
          ticked={tickCount}
          onEdit={actions.onEdit}
          onToggleLive={actions.onToggleLive}
          onDelete={actions.onDelete}
          onClose={() => onOpen(null)}
        />
      )}
    </Reorder.Item>
  )
}

function ShelfRow({
  habit,
  open,
  onOpen,
  onNudge,
  tickCount,
  actions,
  picking,
  picked,
  onPick,
}: {
  habit: Habit
  open: boolean
  onOpen: (id: string | null) => void
  onNudge: (dir: -1 | 1) => void
  tickCount: number
  actions: HabitActions
  picking: boolean
  picked: boolean
  onPick: (id: string) => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={controls}
      // position-only: the default also animates size, which scale-squashes the
      // row whenever its editor panel opens.
      layout="position"
      className="list-none"
      transition={{ type: 'spring', stiffness: 600, damping: 42 }}
      whileDrag={{ scale: 1.03, zIndex: 30 }}
    >
      <div
        className={`neo-button flex w-full items-center gap-1 py-1 pl-1 pr-3 ${
          picked ? 'bg-neo-red/20 opacity-100' : 'bg-neo-white opacity-70'
        }`}
      >
        {picking ? (
          <input
            type="checkbox"
            checked={picked}
            onChange={() => onPick(habit.id)}
            aria-label={`Select ${habit.name} for deletion`}
            className="mx-1.5 h-4 w-4 shrink-0 accent-neo-red"
          />
        ) : (
          <Grip
            label={habit.name}
            onNudge={onNudge}
            onPointerDown={(e) => {
              onOpen(null)
              controls.start(e)
            }}
          />
        )}
        <button
          onClick={() => (picking ? onPick(habit.id) : actions.onToggleLive(habit.id, true))}
          title={picking ? `Select ${habit.name}` : `Put ${habit.name} on today's checklist`}
          className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
        >
          <span className="text-lg leading-none grayscale">{habit.emoji}</span>
          <span className="flex-1 truncate text-sm font-bold text-neo-black">{habit.name}</span>
          <span className="num shrink-0 text-[10px] font-bold text-neo-gray-dark">
            {TIER_XP[habit.tier]} XP · {tickCount}✓
          </span>
          {!picking && (
            <span className="shrink-0 border-2 border-black bg-white px-1.5 text-[10px] font-bold">
              ＋
            </span>
          )}
        </button>
        <button
          onClick={() => onOpen(open ? null : habit.id)}
          aria-label={`Edit ${habit.name}`}
          aria-expanded={open}
          className="shrink-0 px-1 py-2 text-sm font-bold text-black/40"
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
      {open && (
        <RowEditor
          habit={habit}
          live={false}
          ticked={tickCount}
          onEdit={actions.onEdit}
          onToggleLive={actions.onToggleLive}
          onDelete={actions.onDelete}
          onClose={() => onOpen(null)}
        />
      )}
    </Reorder.Item>
  )
}

function AddHabit({ onAdd }: { onAdd: HabitActions['onAdd'] }) {
  const [open, setOpen] = useState(false)
  const [emoji, setEmoji] = useState('⭐')
  const [name, setName] = useState('')
  const [tier, setTier] = useState<Tier>('standard')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const err = onAdd({ name: trimmed, emoji: emoji.trim() || '⭐', tier })
    if (err) {
      setError(err)
      return
    }
    setName('')
    setEmoji('⭐')
    setError(null)
    nameRef.current?.focus()
  }

  if (!open)
    return (
      <button
        onClick={() => {
          setOpen(true)
          setTimeout(() => nameRef.current?.focus(), 0)
        }}
        className="neo-button w-full bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black"
      >
        ＋ New habit
      </button>
    )

  return (
    <form onSubmit={submit} className="neo-card space-y-2 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label="Emoji"
          className="w-12 border-2 border-black bg-neo-bg px-1 py-1.5 text-center text-sm font-bold"
        />
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Habit name"
          aria-label="Habit name"
          className="min-w-[140px] flex-1 border-2 border-black bg-neo-bg px-3 py-1.5 text-sm font-bold"
        />
        <button type="submit" className="neo-button neo-card-yellow px-4 py-1.5 text-xs font-bold uppercase">
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="neo-button bg-white px-3 py-1.5 text-xs font-bold uppercase"
        >
          Done
        </button>
      </div>
      <TierPicker value={tier} onChange={setTier} />
      {error && <div className="text-[11px] font-bold text-neo-red">{error}</div>}
    </form>
  )
}

export function HabitsScreen({
  habits,
  live,
  shelf,
  ticks,
  today,
  stores,
  actions,
}: {
  /** whole registry, in order */
  habits: Habit[]
  live: Habit[]
  shelf: Habit[]
  ticks: Ticks
  today: string
  stores: Stores
  actions: HabitActions
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [shelfOpen, setShelfOpen] = useState(false)
  // Bulk clean-up: deleting a long shelf one row at a time is three taps each.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const endPicking = () => {
    setPicking(false)
    setPicked([])
  }

  const todayTicks = ticks[today] ?? {}
  const todayXp = dayEarned(stores, today)
  const doneCount = live.filter((h) => todayTicks[h.id]).length

  const tickCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const day of Object.values(ticks))
      for (const id of Object.keys(day)) out[id] = (out[id] ?? 0) + 1
    return out
  }, [ticks])

  const streaks = live
    .map((h) => ({ h, s: streakFor(ticks, h.id, today) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)

  const commit = (next: Habit[]) => actions.onReorder(next.map((h) => h.id))
  /** Keyboard equivalent of a drag: swap one row with its neighbour. */
  const nudge = (list: Habit[], index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= list.length) return
    const next = [...list]
    ;[next[index], next[to]] = [next[to], next[index]]
    commit(next)
  }

  return (
    <div className="space-y-4">
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
          <ProgressRing
            pct={live.length > 0 ? doneCount / live.length : 0}
            label={`${doneCount}/${live.length}`}
            size={68}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="hud-label border-black text-sm">Today</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-neo-gray-dark">
          ⠿ drag · tap to tick · ⋯ to edit
        </div>
      </div>

      {live.length === 0 ? (
        <div className="neo-card bg-white px-4 py-6 text-center text-sm font-bold text-neo-gray-dark">
          Nothing on today&apos;s checklist. Add one below, or pull one off the shelf.
        </div>
      ) : (
        <Reorder.Group axis="y" values={live} onReorder={commit} className="space-y-2">
          {live.map((h, i) => (
            <ChecklistRow
              key={h.id}
              habit={h}
              onNudge={(dir) => nudge(live, i, dir)}
              ticks={ticks}
              today={today}
              open={openId === h.id}
              onOpen={setOpenId}
              tickCount={tickCounts[h.id] ?? 0}
              actions={actions}
            />
          ))}
        </Reorder.Group>
      )}

      <AddHabit onAdd={actions.onAdd} />

      {shelf.length > 0 && (
        <>
          <button
            onClick={() => setShelfOpen((s) => !s)}
            aria-expanded={shelfOpen}
            className="flex w-full items-center justify-between border-b-2 border-black pb-1"
          >
            <span className="hud-label border-black text-sm">Shelf · {shelf.length} off</span>
            <span className="text-xs font-bold text-neo-gray-dark">
              {shelfOpen ? 'Hide ▲' : 'Show ▼'}
            </span>
          </button>
          {shelfOpen && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex-1 text-[11px] font-bold leading-relaxed text-neo-gray-dark">
                  {picking
                    ? 'Pick the ones to erase. Sealed months keep showing them; this month will not.'
                    : 'Off the checklist, still in the library. Tap one to put it back on today, drag to reorder, ⋯ to rename or delete it.'}
                </p>
                {picking ? (
                  <div className="flex gap-2">
                    <button
                      onClick={endPicking}
                      className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={picked.length === 0}
                      onClick={() => {
                        actions.onDeleteMany(picked)
                        endPicking()
                      }}
                      className="neo-button bg-neo-red px-3 py-1.5 text-[11px] font-bold uppercase text-white disabled:pointer-events-none disabled:opacity-40"
                    >
                      Delete {picked.length}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPicking(true)}
                    className="neo-button bg-white px-3 py-1.5 text-[11px] font-bold uppercase"
                  >
                    🗑 Clean up
                  </button>
                )}
              </div>
              <Reorder.Group axis="y" values={shelf} onReorder={commit} className="space-y-2">
                {shelf.map((h, i) => (
                  <ShelfRow
                    key={h.id}
                    habit={h}
                    onNudge={(dir) => nudge(shelf, i, dir)}
                    open={openId === h.id}
                    onOpen={setOpenId}
                    tickCount={tickCounts[h.id] ?? 0}
                    actions={actions}
                    picking={picking}
                    picked={picked.includes(h.id)}
                    onPick={togglePick}
                  />
                ))}
              </Reorder.Group>
            </>
          )}
        </>
      )}

      <div className="text-center text-[10px] font-bold text-neo-gray-dark">
        {habits.length} habits in the library
      </div>
    </div>
  )
}
