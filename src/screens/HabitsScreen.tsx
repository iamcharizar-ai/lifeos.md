// The one screen that both runs the day and shapes it.
//
// Everything a habit needs is here: drag it into place, tap it to tick, open
// its row to rename / re-tier / switch off / delete, and add new ones from the
// same place. The old split (add in Library → walk to Daily to arrange) is gone.
// Habits you switch off drop into the Shelf below, still ordered, one tap from
// coming back.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { flyReward } from '../lib/flyReward'
import * as kit from '../ui-kit/motion.js'
import { TIERS, TIER_XP, domainOf, type Habit, type Tier } from '../config/habits'
import { dateISO, streakFor, type Ticks } from '../lib/store'
import { PartnerStrip } from '../components/PartnerStrip'
import { nameOf, type Game } from '../game-core/fold.ts'
import { SLEEP_HABIT, TAGS, tierXp, type Tag } from '../game-core/rules.ts'
import { ArborHead, ArborSkills, GuitarTile, PillarTile, SleepTile, StrongTile, type LinkedCtx } from '../components/LinkedTiles'
import { TrackMark, trackMarkFor, type TrackMarkData } from '../components/TrackMark'
import { MonthReviews, SundayPanel, type WeeklyCtx } from '../components/WeeklyPanels'
import { linkOf, useStrongLinked } from '../lib/arborLink'
import { practicedOn } from '../arbor-core/model.ts'

export interface HabitActions {
  onToggle: (habitId: string) => void
  onToggleLive: (habitId: string, live: boolean) => void
  onEdit: (habitId: string, patch: Partial<Pick<Habit, 'name' | 'emoji' | 'tier' | 'domain'>>) => void
  onDelete: (habitId: string) => void
  onDeleteMany: (habitIds: string[]) => void
  onAdd: (draft: { name: string; emoji: string; tier: Tier }) => string | null
  onReorder: (orderedIds: string[]) => void
}

const HANDLE = (
  <span aria-hidden className="select-none text-xl leading-none text-black/50">
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
      className="shrink-0 cursor-grab touch-none px-2 py-3 active:cursor-grabbing"
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

const DOMAIN_NAME: Record<Tag, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep', routine: 'Chore' }

/** What kind of work a habit is, for the game: which gym leaders it hits hardest, which way a partner leans. */
function DomainPicker({ value, onChange }: { value: Tag; onChange: (t: Tag) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Kind of work">
      {TAGS.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={t === value}
          onClick={() => onChange(t)}
          className={`neo-button px-2 py-1 text-[10px] font-bold uppercase ${t === value ? 'neo-card-yellow' : 'bg-white'}`}
        >
          {DOMAIN_NAME[t]}
        </button>
      ))}
    </div>
  )
}

/** The run a habit is on: counted through today when it is ticked, else through yesterday (today can still keep it going). */
function runOf(ticks: Ticks, id: string, today: string): number {
  if (ticks[today]?.[id]) return streakFor(ticks, id, today)
  const y = new Date(today + 'T12:00:00')
  y.setDate(y.getDate() - 1)
  return streakFor(ticks, id, dateISO(y))
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
        <DomainPicker value={domainOf(habit)} onChange={(domain) => onEdit(habit.id, { domain })} />
        <p className="text-[11px] font-medium opacity-60">
          {habit.tier === 'pillar' && domainOf(habit) === 'routine'
            ? 'A pillar counted as a chore: pick what kind of work it is, so it hits the right gym leaders.'
            : 'Tier and kind change from tomorrow: today’s list is already set.'}
        </p>
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
                className="neo-button neo-card-red px-3 py-1.5 text-[11px] font-bold uppercase"
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
  arranging,
  tickCount,
  actions,
  linked,
  mark,
}: {
  habit: Habit
  ticks: Ticks
  today: string
  open: boolean
  onOpen: (id: string | null) => void
  onNudge: (dir: -1 | 1) => void
  arranging: boolean
  tickCount: number
  actions: HabitActions
  linked: LinkedCtx
  /** version 22: the pillar's track and the leader's mark, drawn on the tile with no words */
  mark?: TrackMarkData
}) {
  const controls = useDragControls()
  const ticked = Boolean(ticks[today]?.[habit.id])
  // a tick lands with a flash on the row and the XP stamped in (and not on load, or when it is un-ticked)
  const rowEl = useRef<HTMLDivElement>(null)
  const xpEl = useRef<HTMLSpanElement>(null)
  const wasTicked = useRef(ticked)
  useEffect(() => {
    if (ticked && !wasTicked.current && rowEl.current && !kit.config.reduced) {
      void kit.flash(rowEl.current, '#ffffff', { dur: 300, peak: 0.55 })
      if (xpEl.current) void kit.motion.stampIn(xpEl.current, { from: 1.5, flashColor: '#fff' })
    }
    wasTicked.current = ticked
  }, [ticked])
  const xp = tierXp(habit.tier)
  // Linked habits are fed by Strong / Arbor and wear that app's look.
  // once the band is in use the Sleep row shows the night, or says it is waiting for it
  // Sleep is the band's (version 13): it always wears the night-sky tile and is never ticked by hand
  const link = habit.id === SLEEP_HABIT ? ('vitals' as const) : linkOf(habit.id)
  // a pillar no app feeds wears the default pillar look, charged in its kind of work's colour
  const pillar = !link && habit.tier === 'pillar'
  const run = useMemo(() => (pillar ? runOf(ticks, habit.id, today) : 0), [pillar, ticks, habit.id, today])
  const strongLinked = useStrongLinked()
  const planned = linked.plan.morning
  const practised = planned.filter((id) => practicedOn(linked.arbor, today, id)).length
  const [skillsOpen, setSkillsOpen] = useState<boolean | null>(null)
  const showSkills = link === 'arbor' && planned.length > 0 && (skillsOpen ?? false)
  const session = linked.guitar.session
  const played = session.filter((id) => linked.guitar.shed.logs[id]?.[today]?.done).length

  return (
    <Reorder.Item
      value={habit}
      dragListener={false}
      dragControls={controls}
      // position-only: the default also animates size, which scale-squashes the
      // row whenever its editor panel opens.
      layout="position"
      data-habit-row={habit.id}
      // leaving after its 10 seconds: shrinks away while its XP flies to the bar
      exit={{ opacity: 0, scale: 0.9, height: 0, marginTop: 0, transition: { duration: 0.28 } }}
      className="list-none"
      // Springy neighbours: rows shove each other aside while you drag.
      transition={{ type: 'spring', stiffness: 600, damping: 42 }}
      whileDrag={{ scale: 1.03, zIndex: 30 }}
    >
      <div
        ref={rowEl}
        className={`neo-button relative flex w-full items-center gap-1 py-1 pl-1 pr-3 text-left ${
          link ? `tile-${link} ${ticked ? 'is-done' : ''}` : pillar ? `tile-pillar ${ticked ? 'is-done' : ''}` : ticked ? 'neo-card-green' : 'bg-neo-white'
        } ${open ? 'mb-0' : ''}`}
        data-tag={pillar ? domainOf(habit) : undefined}
      >
        {mark && !arranging && <TrackMark {...mark} />}
        {arranging ? (
          <Grip
            label={habit.name}
            onNudge={onNudge}
            onPointerDown={(e) => {
              onOpen(null) // never drag a row with its editor panel hanging off it
              controls.start(e)
            }}
          />
        ) : (
          <span className="w-2 shrink-0" aria-hidden />
        )}
        {link === 'strong' ? (
          <StrongTile
            name={habit.name}
            xp={xp}
            ticked={ticked}
            next={linked.gymNext}
            workout={linked.workout}
            locked={strongLinked}
            onToggle={() => actions.onToggle(habit.id)}
          />
        ) : link === 'arbor' ? (
          <ArborHead
            name={habit.name}
            xp={xp}
            ticked={ticked}
            done={practised}
            total={planned.length}
            open={showSkills}
            onToggle={() => setSkillsOpen(!showSkills)}
          />
        ) : link === 'vitals' ? (
          <SleepTile name={habit.name} state={linked.sleep.state} night={linked.sleep.night} ticked={ticked} selfXp={TIER_XP.core} onToggle={() => actions.onToggle(habit.id)} check={linked.sleep.check} />
        ) : link === 'woodshed' ? (
          <GuitarTile name={habit.name} xp={xp} ticked={ticked} done={played} total={session.length} />
        ) : pillar ? (
          <PillarTile name={habit.name} emoji={habit.emoji} xp={xp} ticked={ticked} run={run} onToggle={() => actions.onToggle(habit.id)} xpRef={xpEl} />
        ) : (
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
          <span
            ref={xpEl}
            className={`num relative shrink-0 text-base font-bold ${
              ticked ? 'text-black' : 'text-neo-gray-dark'
            }`}
          >
            {ticked ? `+${xp}` : xp}
          </span>
        </div>
        )}
        <button
          onClick={() => onOpen(open ? null : habit.id)}
          aria-label={`Edit ${habit.name}`}
          aria-expanded={open}
          className="shrink-0 px-1 py-2 text-sm font-bold text-black/40"
        >
          {open ? '✕' : '⋯'}
        </button>
      </div>
      {showSkills && <ArborSkills ctx={linked} today={today} />}
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
  arranging,
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
  arranging: boolean
  tickCount: number
  actions: HabitActions
  picking: boolean
  picked: boolean
  onPick: (id: string) => void
}) {
  const controls = useDragControls()
  // pillars keep their own look on the shelf, just greyed and still
  const link = habit.id === SLEEP_HABIT ? ('vitals' as const) : linkOf(habit.id)
  const pillar = !link && habit.tier === 'pillar'
  const tile = link ? `tile-${link}` : pillar ? 'tile-pillar' : ''
  const titleClass = link === 'woodshed' ? 'shed-title' : link === 'arbor' ? 'arbor-title' : pillar ? 'pillar-title' : 'text-sm font-bold'
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
        data-tag={pillar ? domainOf(habit) : undefined}
        className={`neo-button flex w-full items-center gap-1 py-1 pl-1 pr-3 ${
          tile ? `${tile} is-shelved grayscale ${picked ? 'opacity-100 ring-4 ring-neo-red' : 'opacity-70'}` : picked ? 'bg-neo-red/20 opacity-100' : 'bg-neo-white opacity-70'
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
        ) : arranging ? (
          <Grip
            label={habit.name}
            onNudge={onNudge}
            onPointerDown={(e) => {
              onOpen(null)
              controls.start(e)
            }}
          />
        ) : (
          <span className="w-2 shrink-0" aria-hidden />
        )}
        <button
          onClick={() => (picking ? onPick(habit.id) : actions.onToggleLive(habit.id, true))}
          title={picking ? `Select ${habit.name}` : `Put ${habit.name} on today's checklist`}
          className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
        >
          <span className="text-lg leading-none grayscale">{habit.emoji}</span>
          <span className={`flex-1 truncate ${titleClass} ${tile ? '' : 'text-neo-black'}`}>{habit.name}</span>
          <span className={`num shrink-0 text-[10px] font-bold ${tile ? 'opacity-80' : 'text-neo-gray-dark'}`}>
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

/** A tick stays on the checklist this long, so a mis-tap can be undone. After it, the habit leaves today's view. */
const DONE_HIDE_MS = 10_000

export function HabitsScreen({
  habits,
  live,
  shelf,
  ticks,
  today,
  game,
  actions,
  linked,
  weekly,
}: {
  /** whole registry, in order */
  habits: Habit[]
  live: Habit[]
  shelf: Habit[]
  ticks: Ticks
  today: string
  game: Game
  actions: HabitActions
  linked: LinkedCtx
  /** month-end review + Sunday reset — the not-every-day blocks */
  weekly: WeeklyCtx
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [shelfOpen, setShelfOpen] = useState(false)
  // Dragging only works in arrange mode, so a scroll that starts on a row can never reorder it
  const [arranging, setArranging] = useState(false)
  // Bulk clean-up: deleting a long shelf one row at a time is three taps each.
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const endPicking = () => {
    setPicking(false)
    setPicked([])
  }

  const todayRaw = ticks[today]
  const todayTicks = todayRaw ?? {}
  // a measured night is logged whatever its score, so it counts as done even when too low to tick
  const isDone = (id: string): boolean => Boolean(todayTicks[id]) || (id === SLEEP_HABIT && linked.sleep.state === 'measured')
  const doneCount = live.filter((h) => isDone(h.id)).length
  // the clock the hiding is judged against; moved on by a timer for the next tick to expire
  const [now, setNow] = useState(() => Date.now())
  const [showDone, setShowDone] = useState(false)
  // arranging shows everything, so the order of hidden rows is never lost
  const showAll = showDone || arranging
  useEffect(() => {
    let soonest = Infinity
    for (const at of Object.values(todayRaw ?? {})) {
      const t = Date.parse(at) + DONE_HIDE_MS
      if (t > Date.now() && t < soonest) soonest = t
    }
    if (soonest === Infinity) return
    const id = window.setTimeout(() => {
      // whatever expires now flies its XP to the partner's bar as the row leaves
      if (!showAll) {
        const t0 = Date.now() + 25
        let n = 0
        for (const h of live) {
          const at = todayRaw?.[h.id]
          if (!at || Date.parse(at) + DONE_HIDE_MS > t0) continue
          const row = document.querySelector(`[data-habit-row="${CSS.escape(h.id)}"]`)
          if (row) flyReward(row, `+${tierXp(h.tier)}`, undefined, n++ * 180) // several leave one after another, not on top of each other
        }
      }
      setNow(Date.now())
    }, soonest - Date.now() + 20)
    return () => window.clearTimeout(id)
    // `now` re-arms the timer for the next tick in line once one has expired;
    // without it only the first tick ever disappeared.
  }, [todayRaw, now, live, showAll])
  // a tick older than DONE_HIDE_MS (or one with no usable time) is done and out of the way
  const isHidden = (id: string): boolean => {
    // a measured night is logged whatever its score: a low one is not ticked, but the row is still done
    if (id === SLEEP_HABIT && !todayTicks[id] && isDone(id)) return true
    const at = todayTicks[id]
    if (!at) return false
    const t = Date.parse(at)
    return Number.isNaN(t) || now - t >= DONE_HIDE_MS
  }
  const shown = showAll ? live : live.filter((h) => !isHidden(h.id))
  const doneHidden = live.filter((h) => isHidden(h.id)).length

  const tickCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const day of Object.values(ticks))
      for (const id of Object.keys(day)) out[id] = (out[id] ?? 0) + 1
    return out
  }, [ticks])

  // while arranging, a tap on a row does nothing (no stray ticks)
  const idle: HabitActions = { ...actions, onToggle: () => {} }
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
      <PartnerStrip game={game} />

      <MonthReviews
        reviews={weekly.reviews}
        onToggle={weekly.onToggleReview}
        onOpen={weekly.onOpenMonth}
      />

      <div className="today-head">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="today-title">Today</h2>
            <span className="num text-sm font-bold">
              {doneCount}/{live.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setArranging((a) => !a)
              setOpenId(null)
            }}
            aria-pressed={arranging}
            className={`neo-button px-3 py-1 text-[11px] font-bold uppercase ${arranging ? 'neo-card-yellow' : 'bg-white'}`}
          >
            {arranging ? '✓ Done arranging' : '⠿ Arrange'}
          </button>
        </div>
        {live.length > 0 && (
          <>
            <div
              className="day-track"
              role="progressbar"
              aria-label="Habits ticked today"
              aria-valuemin={0}
              aria-valuemax={live.length}
              aria-valuenow={doneCount}
              style={{ ['--n' as string]: live.length }}
            >
              {live.map((h) => (
                <i key={h.id} className={isDone(h.id) ? (h.tier === 'pillar' ? 'on is-pillar' : 'on') : h.tier === 'pillar' ? 'is-pillar' : ''} data-tag={h.tier === 'pillar' ? domainOf(h) : undefined} />
              ))}
            </div>
            <p className="day-caption">
              {doneCount === live.length
                ? 'Perfect day. Everything on the list is done.'
                : `${live.length - doneCount} to a perfect day${game.wild && !game.wild.caught ? `, which catches the wild ${nameOf(game.wild.form)}` : ''} · ${game.today.pillars}/${game.today.pillarTotal} pillars`}
            </p>
          </>
        )}
      </div>

      {arranging && (
        <p className="text-[11px] font-bold leading-relaxed text-neo-gray-dark">
          Arranging: drag the ⠿ handle, or focus it and press ↑ ↓. Ticking is paused until you are done.
        </p>
      )}

      {live.length === 0 ? (
        <div className="neo-card bg-white px-4 py-6 text-center text-sm font-bold text-neo-gray-dark">
          Nothing on today&apos;s checklist. Add one below, or pull one off the shelf.
        </div>
      ) : shown.length === 0 ? (
        <div className="all-done neo-card neo-card-yellow px-4 py-6 text-center">
          <div className="font-display text-2xl font-bold uppercase tracking-wider">All done</div>
          <div className="mt-1 text-sm font-bold opacity-75">Everything on today&apos;s list is ticked. Tap “show” below to look back over it.</div>
        </div>
      ) : (
        <Reorder.Group axis="y" values={shown} onReorder={commit} className="space-y-2">
          <AnimatePresence initial={false}>
          {shown.map((h, i) => (
            <ChecklistRow
              key={h.id}
              habit={h}
              onNudge={(dir) => nudge(shown, i, dir)}
              arranging={arranging}
              ticks={ticks}
              today={today}
              open={openId === h.id}
              onOpen={setOpenId}
              tickCount={tickCounts[h.id] ?? 0}
              actions={arranging ? idle : actions}
              linked={linked}
              mark={trackMarkFor(game, h)}
            />
          ))}
          </AnimatePresence>
        </Reorder.Group>
      )}
      {!arranging && !showDone && doneHidden > 0 && (
        <button type="button" onClick={() => setShowDone(true)} className="w-full text-center text-[11px] font-bold uppercase text-neo-gray-dark underline">
          {doneHidden} done today · show
        </button>
      )}
      {!arranging && showDone && doneCount > 0 && (
        <button type="button" onClick={() => setShowDone(false)} className="w-full text-center text-[11px] font-bold uppercase text-neo-gray-dark underline">
          Hide done ones
        </button>
      )}

      <SundayPanel
        tasks={weekly.sunday.tasks}
        isSunday={weekly.sunday.isSunday}
        ticks={ticks}
        today={today}
        onToggle={actions.onToggle}
        onChange={weekly.sunday.onChange}
      />

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
                    : 'Off the checklist, and off this month’s graph until you put one back. Tap one to return it to today, ⋯ to rename or delete it. Use Arrange to reorder.'}
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
                      className="neo-button neo-card-red px-3 py-1.5 text-[11px] font-bold uppercase disabled:pointer-events-none disabled:opacity-40"
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
                    arranging={arranging}
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
