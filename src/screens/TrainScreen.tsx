// Train tab — Phase 4 workout engine.
// Planning state: anatomical map + split cards; selecting a split or a single
// exercise shades its target muscles red. Starting a split enters the tracking
// state: the map disappears (layout priority), replaced by a dense set/kg/rep
// log with rest countdowns. Finish Workout folds the session into an immutable
// summary → App emits the ledger event + vault write-back; the map then glows
// on the muscles trained for the rest of the day.
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { motion } from 'framer-motion'
import {
  EXERCISES,
  EXERCISE_MAP,
  MUSCLE_LABEL,
  SPLITS,
  musclesFor,
  type Split,
} from '../config/exercises'
import { WORKOUT_XP } from '../lib/xp'
import type { DayWorkout } from '../lib/ledger'
import {
  DEFAULT_REST_SEC,
  loadActiveSession,
  newSetEntry,
  saveActiveSession,
  sessionExerciseFor,
  summarize,
  type ActiveSession,
  type WorkoutSummary,
} from '../lib/workout'
import { MuscleMap } from '../components/MuscleMap'

type Selection = { kind: 'split' | 'exercise'; id: string } | null

export function TrainScreen({
  workout,
  onFinishWorkout,
  onClearWorkout,
}: {
  workout: DayWorkout | undefined
  onFinishWorkout: (summary: WorkoutSummary) => void
  onClearWorkout: () => void
}) {
  const [session, setSession] = useState<ActiveSession | null>(() => loadActiveSession())
  useEffect(() => saveActiveSession(session), [session])

  if (session)
    return (
      <ActiveWorkout
        session={session}
        setSession={setSession}
        onFinish={(summary) => {
          setSession(null)
          onFinishWorkout(summary)
        }}
      />
    )
  return (
    <Planner
      workout={workout}
      onStart={(s) => setSession(s)}
      onClearWorkout={onClearWorkout}
    />
  )
}

// ── Planning state: map + splits ─────────────────────────────────────

function Planner({
  workout,
  onStart,
  onClearWorkout,
}: {
  workout: DayWorkout | undefined
  onStart: (s: ActiveSession) => void
  onClearWorkout: () => void
}) {
  const [sel, setSel] = useState<Selection>(null)

  const target = useMemo(() => {
    if (sel?.kind === 'exercise') {
      const ex = EXERCISE_MAP.get(sel.id)
      return ex ? { primary: ex.primary, secondary: ex.secondary } : { primary: [], secondary: [] }
    }
    if (sel?.kind === 'split') {
      const split = SPLITS.find((s) => s.id === sel.id)
      return musclesFor(split?.plan.map((p) => p.exerciseId) ?? [])
    }
    return { primary: [], secondary: [] }
  }, [sel])

  const glow = workout?.session?.muscles ?? []
  const selSplit = sel?.kind === 'split' ? SPLITS.find((s) => s.id === sel.id) : undefined

  const start = (split: Split) =>
    onStart({
      id: crypto.randomUUID(),
      name: split.name,
      splitId: split.id,
      startedAt: new Date().toISOString(),
      entries: split.plan.map((p) => sessionExerciseFor(p.exerciseId, p.sets)),
    })

  return (
    <div className="bleed bleed-pad space-y-5">
      <div className="plate p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="hud-label">Anatomy // target map</div>
          {glow.length > 0 && (
            <span className="num text-[10px] text-ember">⬢ trained today</span>
          )}
        </div>
        <MuscleMap
          primary={target.primary}
          secondary={target.secondary}
          glow={glow}
          className="mx-auto w-full max-w-xs"
        />
        {sel && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {target.primary.map((m) => (
              <span key={m} className="chip bg-ember/20 px-2 py-0.5 text-[10px] text-ember">
                {MUSCLE_LABEL[m]}
              </span>
            ))}
            {target.secondary.map((m) => (
              <span key={m} className="chip bg-plate2 px-2 py-0.5 text-[10px] text-ash">
                {MUSCLE_LABEL[m]}
              </span>
            ))}
          </div>
        )}
      </div>

      {workout && (
        <div className="plate p-4">
          <div className="mb-2 hud-label">Session logged</div>
          <div className="chip flex items-center justify-between border border-gold-dim bg-gold/10 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-bone">
                🏋️ {workout.type} <span className="num text-gold">+{WORKOUT_XP} XP</span>
              </div>
              {workout.session && (
                <div className="num mt-0.5 text-[11px] text-ash">
                  {workout.session.durationMin} min · {workout.session.totalSets} sets ·{' '}
                  {workout.session.volumeKg} kg volume
                </div>
              )}
            </div>
            <button onClick={onClearWorkout} className="text-xs text-ash hover:text-bone">
              undo
            </button>
          </div>
        </div>
      )}

      <div className="plate p-4">
        <div className="mb-3 hud-label">Splits — tap to scan · start to track</div>
        <div className="space-y-2">
          {SPLITS.map((split) => {
            const selected = sel?.kind === 'split' && sel.id === split.id
            return (
              <div
                key={split.id}
                className={`chip border px-3 py-2.5 transition-colors ${
                  selected ? 'border-ember-dim bg-ember/10' : 'border-line bg-plate2'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="flex-1 text-left"
                    onClick={() => setSel(selected ? null : { kind: 'split', id: split.id })}
                  >
                    <span className="text-sm font-semibold text-bone">
                      {split.emoji} {split.name}
                    </span>
                    <span className="num ml-2 text-[10px] text-dim">
                      {split.plan.length} exercises
                    </span>
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => start(split)}
                    className="chip bg-ember px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-ink"
                  >
                    ▶ Start
                  </motion.button>
                </div>
                {selected && selSplit && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                    {selSplit.plan.map((p) => {
                      const ex = EXERCISE_MAP.get(p.exerciseId)
                      if (!ex) return null
                      return (
                        <button
                          key={p.exerciseId}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSel({ kind: 'exercise', id: p.exerciseId })
                          }}
                          className="chip bg-plate px-2 py-1 text-[11px] text-ash hover:text-bone"
                        >
                          {ex.name} <span className="num text-dim">×{p.sets}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button
          onClick={() =>
            onStart({
              id: crypto.randomUUID(),
              name: 'Custom Session',
              startedAt: new Date().toISOString(),
              entries: [],
            })
          }
          className="chip mt-3 w-full border border-dashed border-line py-2 text-xs text-dim hover:text-ash"
        >
          + empty session (build as you go)
        </button>
      </div>
    </div>
  )
}

// ── Tracking state: the Strong engine ────────────────────────────────

function ActiveWorkout({
  session,
  setSession,
  onFinish,
}: {
  session: ActiveSession
  setSession: Dispatch<SetStateAction<ActiveSession | null>>
  onFinish: (summary: WorkoutSummary) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmAbort, setConfirmAbort] = useState(false)
  const restRef = useRef(rest)
  restRef.current = rest

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now())
      if (restRef.current && restRef.current.endsAt <= Date.now()) setRest(null)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedMin = Math.floor((now - new Date(session.startedAt).getTime()) / 60_000)
  const elapsedSec = Math.floor(((now - new Date(session.startedAt).getTime()) % 60_000) / 1000)
  const doneSets = session.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  // Functional update — rapid taps (done ✓ on two sets in one frame) must not
  // clobber each other via a stale render-time `session`.
  const patch = (fn: (s: ActiveSession) => ActiveSession) =>
    setSession((cur) => (cur ? fn(cur) : cur))

  const updateSet = (ei: number, si: number, field: 'weight' | 'reps', value: string) =>
    patch((s) => {
      const entries = s.entries.map((e, i) =>
        i !== ei
          ? e
          : { ...e, sets: e.sets.map((x, j) => (j !== si ? x : { ...x, [field]: value })) },
      )
      return { ...s, entries }
    })

  const toggleDone = (ei: number, si: number) => {
    const wasDone = session.entries[ei].sets[si].done
    patch((s) => {
      const entries = s.entries.map((e, i) =>
        i !== ei
          ? e
          : { ...e, sets: e.sets.map((x, j) => (j !== si ? x : { ...x, done: !x.done })) },
      )
      return { ...s, entries }
    })
    if (!wasDone) setRest({ endsAt: Date.now() + DEFAULT_REST_SEC * 1000, total: DEFAULT_REST_SEC })
  }

  const addSet = (ei: number) =>
    patch((s) => ({
      ...s,
      entries: s.entries.map((e, i) => (i !== ei ? e : { ...e, sets: [...e.sets, newSetEntry()] })),
    }))

  const removeExercise = (ei: number) =>
    patch((s) => ({ ...s, entries: s.entries.filter((_, i) => i !== ei) }))

  const addExercise = (exerciseId: string) => {
    patch((s) => ({ ...s, entries: [...s.entries, sessionExerciseFor(exerciseId, 3)] }))
    setPickerOpen(false)
  }

  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0

  return (
    <div className="bleed bleed-pad space-y-4">
      {/* command bar */}
      <div className="plate flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="hud-label">⬢ Tracking</div>
          <div className="truncate text-sm font-semibold text-bone">{session.name}</div>
          <div className="num text-[11px] text-ash">
            {elapsedMin}:{String(elapsedSec).padStart(2, '0')} · {doneSets} sets done
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.93 }}
            disabled={doneSets === 0}
            onClick={() => onFinish(summarize(session))}
            className={`chip px-4 py-2 font-display text-[10px] font-bold uppercase tracking-[0.15em] ${
              doneSets > 0 ? 'bg-gold text-ink' : 'bg-plate2 text-dim'
            }`}
          >
            Finish
          </motion.button>
          <button
            onClick={() => {
              if (!confirmAbort) {
                setConfirmAbort(true)
                setTimeout(() => setConfirmAbort(false), 2500)
              } else setSession(null)
            }}
            className={`chip px-2.5 py-2 text-xs ${
              confirmAbort ? 'bg-ember text-ink' : 'text-dim hover:text-ash'
            }`}
          >
            {confirmAbort ? 'sure?' : '✕'}
          </button>
        </div>
      </div>

      {/* rest countdown */}
      {rest && (
        <div className="plate flex items-center gap-3 border-ember-dim p-3">
          <span className="hud-label !text-ember">Rest</span>
          <div className="h-1.5 flex-1 bg-plate2">
            <div
              className="h-full bg-ember transition-all duration-1000 ease-linear"
              style={{ width: `${(restLeft / rest.total) * 100}%` }}
            />
          </div>
          <span className="num text-sm text-ember">{restLeft}s</span>
          <button onClick={() => setRest(null)} className="text-xs text-dim hover:text-ash">
            skip
          </button>
        </div>
      )}

      {/* exercise log */}
      {session.entries.map((e, ei) => (
        <div key={`${e.exerciseId}-${ei}`} className="plate p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div>
              <span className="text-sm font-semibold text-bone">{e.name}</span>
              <span className="num ml-2 text-[10px] text-dim">
                {EXERCISE_MAP.get(e.exerciseId)
                  ?.primary.map((m) => MUSCLE_LABEL[m])
                  .join(' · ')}
              </span>
            </div>
            <button onClick={() => removeExercise(ei)} className="text-xs text-dim hover:text-ember">
              ✕
            </button>
          </div>
          <div className="hud-label grid grid-cols-[2rem_1fr_1fr_2.6rem] gap-2 pb-1 !text-[9px]">
            <span>Set</span>
            <span>{e.kind === 'time' ? '—' : 'kg'}</span>
            <span>{e.kind === 'time' ? 'sec' : 'reps'}</span>
            <span className="text-center">✓</span>
          </div>
          <div className="space-y-1.5">
            {e.sets.map((x, si) => (
              <div key={si} className="grid grid-cols-[2rem_1fr_1fr_2.6rem] items-center gap-2">
                <span className="num text-xs text-dim">{si + 1}</span>
                {e.kind === 'time' ? (
                  <span className="text-center text-xs text-dim">–</span>
                ) : (
                  <input
                    inputMode="decimal"
                    value={x.weight}
                    onChange={(ev) => updateSet(ei, si, 'weight', ev.target.value)}
                    placeholder="0"
                    className="num w-full border border-line bg-plate2 px-2 py-1.5 text-center text-sm text-bone outline-none focus:border-line2"
                  />
                )}
                <input
                  inputMode="numeric"
                  value={x.reps}
                  onChange={(ev) => updateSet(ei, si, 'reps', ev.target.value)}
                  placeholder="0"
                  className="num w-full border border-line bg-plate2 px-2 py-1.5 text-center text-sm text-bone outline-none focus:border-line2"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleDone(ei, si)}
                  className={`chip py-1.5 text-center text-xs font-bold ${
                    x.done ? 'bg-ember text-ink' : 'bg-plate2 text-dim'
                  }`}
                >
                  ✓
                </motion.button>
              </div>
            ))}
          </div>
          <button
            onClick={() => addSet(ei)}
            className="chip mt-2 w-full border border-dashed border-line py-1.5 text-[11px] text-dim hover:text-ash"
          >
            + set
          </button>
        </div>
      ))}

      <button
        onClick={() => setPickerOpen(true)}
        className="chip w-full border border-dashed border-line py-2.5 text-xs text-ash hover:text-bone"
      >
        + add exercise
      </button>

      {pickerOpen && <ExercisePicker onPick={addExercise} onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const list = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/80 p-4" onClick={onClose}>
      <div
        className="plate flex max-h-[70vh] w-full max-w-md flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Add exercise</span>
          <button onClick={onClose} className="text-xs text-dim hover:text-ash">
            close
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search…"
          className="mb-2 w-full border border-line bg-plate2 px-3 py-2 text-sm text-bone outline-none focus:border-line2"
        />
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e.id)}
              className="chip flex w-full items-baseline justify-between bg-plate2 px-3 py-2 text-left hover:bg-line/40"
            >
              <span className="text-sm text-bone">{e.name}</span>
              <span className="num text-[10px] text-dim">
                {e.primary.map((m) => MUSCLE_LABEL[m]).join(' · ')}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <div className="py-6 text-center text-xs text-dim">no match — refine the search</div>
          )}
        </div>
      </div>
    </div>
  )
}
