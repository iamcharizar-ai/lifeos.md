// The two "not every day" blocks that sit on the Daily screen:
//   • MonthReviews — the month-end review, pinned to the top of Today until ticked
//   • SundayPanel  — the Sunday reset list, a panel of its own under the habits
// Each wears its own look (a tear-off calendar page, a lavender sticker sheet)
// so neither reads as an ordinary habit row. See lib/monthReview.ts and
// lib/sundayTasks.ts for the rules behind them.
import { useRef, useState } from 'react'
import { habitIdFor } from '../config/habits'
import type { Ticks } from '../lib/store'
import type { ReviewItem } from '../lib/monthReview'
import { sundayTickId, type SundayTask } from '../lib/sundayTasks'

export interface WeeklyCtx {
  reviews: ReviewItem[]
  onToggleReview: (ym: string) => void
  /** jump to the Monthly tab on this month */
  onOpenMonth: (ym: string) => void
  sunday: {
    tasks: SundayTask[]
    isSunday: boolean
    onChange: (tasks: SundayTask[]) => void
  }
}

const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** Month-end reviews: a tear-off calendar page per month still owed. */
export function MonthReviews({
  reviews,
  onToggle,
  onOpen,
}: {
  reviews: ReviewItem[]
  onToggle: (ym: string) => void
  onOpen: (ym: string) => void
}) {
  if (reviews.length === 0) return null
  return (
    <div className="space-y-3">
      {reviews.map(({ ym, done }) => (
        <div key={ym} className="neo-card overflow-hidden bg-white">
          <div className="flex items-center justify-between border-b-[3px] border-black bg-neo-red px-3 py-1 font-display text-[11px] font-bold uppercase tracking-widest text-white">
            <span>◉ Month-end review</span>
            <span className="num">{monthLabel(ym)}</span>
          </div>
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => onToggle(ym)}
              aria-pressed={done}
              className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left ${
                done ? 'bg-neo-green' : 'bg-white'
              }`}
            >
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center border-[3px] border-black text-base font-bold ${
                  done ? 'bg-white' : 'bg-neo-yellow'
                }`}
              >
                {done ? '✓' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-base font-bold ${done ? 'line-through opacity-80' : ''}`}>
                  Review {monthLabel(ym)}
                </span>
                <span className="block text-[11px] font-bold leading-snug text-black/60">
                  {done
                    ? 'Reviewed — tap to undo'
                    : 'Look over the graph, then tap to close the month. Stays here until you do.'}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(ym)}
              className="shrink-0 border-l-[3px] border-black bg-white px-3 text-[11px] font-bold uppercase leading-tight"
            >
              Graph
              <br />↗
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/** One task in the editor: name edits commit on blur so a keystroke isn't an event. */
function EditRow({
  task,
  first,
  last,
  onPatch,
  onMove,
  onDelete,
}: {
  task: SundayTask
  first: boolean
  last: boolean
  onPatch: (patch: Partial<SundayTask>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(task.name)
  const [emoji, setEmoji] = useState(task.emoji)
  const commitName = () => {
    const v = name.trim()
    if (!v) return setName(task.name)
    if (v !== task.name) onPatch({ name: v })
  }
  const commitEmoji = () => {
    const v = emoji.trim() || '⭐'
    setEmoji(v)
    if (v !== task.emoji) onPatch({ emoji: v })
  }
  return (
    <div className="flex items-center gap-1.5 border-2 border-black bg-white p-1.5">
      <input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={commitEmoji}
        aria-label="Emoji"
        className="w-10 shrink-0 border-2 border-black bg-neo-bg px-1 py-1 text-center text-sm font-bold"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Task name"
        className="min-w-0 flex-1 border-2 border-black bg-neo-bg px-2 py-1 text-sm font-bold"
      />
      <button
        type="button"
        disabled={first}
        onClick={() => onMove(-1)}
        aria-label={`Move ${task.name} up`}
        className="shrink-0 px-1.5 py-1 text-xs font-bold disabled:opacity-25"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={last}
        onClick={() => onMove(1)}
        aria-label={`Move ${task.name} down`}
        className="shrink-0 px-1.5 py-1 text-xs font-bold disabled:opacity-25"
      >
        ▼
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${task.name}`}
        className="shrink-0 border-2 border-black bg-neo-red px-2 py-1 text-xs font-bold text-white"
      >
        ✕
      </button>
    </div>
  )
}

/** Add / rename / reorder / delete the Sunday list. */
function ManageTasks({
  tasks,
  onChange,
}: {
  tasks: SundayTask[]
  onChange: (tasks: SundayTask[]) => void
}) {
  const [emoji, setEmoji] = useState('⭐')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const clash = tasks.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (clash) return setError(`"${clash.name}" is already on the list.`)
    const id = habitIdFor(trimmed, tasks.map((t) => t.id))
    onChange([...tasks, { id, name: trimmed, emoji: emoji.trim() || '⭐' }])
    setName('')
    setEmoji('⭐')
    setError(null)
    nameRef.current?.focus()
  }
  const move = (i: number, dir: -1 | 1) => {
    const next = [...tasks]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 && (
        <p className="text-[11px] font-bold text-black/60">
          Nothing on the list yet. Add your first Sunday task below.
        </p>
      )}
      {tasks.map((t, i) => (
        <EditRow
          key={t.id}
          task={t}
          first={i === 0}
          last={i === tasks.length - 1}
          onPatch={(patch) => onChange(tasks.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))}
          onMove={(dir) => move(i, dir)}
          onDelete={() => onChange(tasks.filter((x) => x.id !== t.id))}
        />
      ))}
      <form onSubmit={add} className="flex flex-wrap gap-2 border-t-2 border-dashed border-black/30 pt-2">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label="Emoji"
          className="w-10 border-2 border-black bg-white px-1 py-1.5 text-center text-sm font-bold"
        />
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New Sunday task — watch a film, buy a shirt…"
          aria-label="New Sunday task"
          className="min-w-[140px] flex-1 border-2 border-black bg-white px-3 py-1.5 text-sm font-bold"
        />
        <button type="submit" className="neo-button neo-card-yellow px-4 py-1.5 text-xs font-bold uppercase">
          Add
        </button>
        {error && <div className="w-full text-[11px] font-bold text-neo-red">{error}</div>}
      </form>
    </div>
  )
}

/**
 * The Sunday reset panel. On a Sunday it is the live checklist. On any other day
 * the tasks themselves stay hidden — only a folded bar remains, which opens the
 * editor, so the list can be built whenever the idea strikes.
 */
export function SundayPanel({
  tasks,
  isSunday,
  ticks,
  today,
  onToggle,
  onChange,
}: {
  tasks: SundayTask[]
  isSunday: boolean
  ticks: Ticks
  today: string
  onToggle: (tickId: string) => void
  onChange: (tasks: SundayTask[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const todayTicks = ticks[today] ?? {}
  const done = tasks.filter((t) => todayTicks[sundayTickId(t.id)]).length

  if (!isSunday) {
    return (
      <div className="sunday-panel">
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="sunday-stamp">☀ Sunday reset</span>
          <span className="text-[11px] font-bold text-black/70">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · only shows on Sundays ·{' '}
            {editing ? 'Hide ▲' : 'Edit ▼'}
          </span>
        </button>
        {editing && (
          <div className="mt-3">
            <ManageTasks tasks={tasks} onChange={onChange} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="sunday-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="sunday-stamp">☀ Sunday reset</span>
        <span className="flex items-center gap-2">
          <span className="num text-sm font-bold">
            {done}/{tasks.length}
          </span>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
            className="neo-button bg-white px-2.5 py-1 text-[11px] font-bold uppercase"
          >
            {editing ? 'Done' : '✎ Edit list'}
          </button>
        </span>
      </div>

      <div className="mt-3">
        {editing ? (
          <ManageTasks tasks={tasks} onChange={onChange} />
        ) : tasks.length === 0 ? (
          <p className="text-[11px] font-bold text-black/60">
            Nothing on the Sunday list yet — tap “Edit list” to add some.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const ticked = Boolean(todayTicks[sundayTickId(t.id)])
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggle(sundayTickId(t.id))}
                  aria-pressed={ticked}
                  className={`flex w-full items-center gap-3 border-2 border-black px-3 py-2.5 text-left ${
                    ticked ? 'bg-[#cdb8ff]' : 'bg-white'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 border-black text-sm font-bold ${
                      ticked ? 'bg-neo-yellow' : 'bg-white'
                    }`}
                  >
                    {ticked ? '✓' : ''}
                  </span>
                  <span className="text-lg leading-none">{t.emoji}</span>
                  <span
                    className={`flex-1 text-base font-bold ${ticked ? 'line-through opacity-70' : ''}`}
                  >
                    {t.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
