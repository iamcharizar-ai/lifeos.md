// Tiles for the two habits that other apps feed (see lib/arborLink.ts). Each
// wears its own app's look so it is obvious at a glance that it is not an
// ordinary tick: Strong's is a yellow neo-brutalist slab with a padlock,
// Arbor's is a dark pixel-art panel that opens into today's skills.
import { useMemo, useState } from 'react'
import { targetFor } from '../arbor-core/coach.ts'
import { practicedOn, valueOf, type ArborState, type DayPlan } from '../arbor-core/model.ts'
import { G, renderPose } from '../arbor-core/pixel/figure.js'
import { POSES } from '../arbor-core/pixel/poses.js'
import { poseOf } from '../arbor-core/pixel/skillPoses.js'
import { gymDayFor } from '../arbor-core/schedule.ts'
import { SKILL_BY_ID } from '../arbor-core/skills.ts'
import { ARBOR_URL, STRONG_URL } from '../lib/arborLink'
import type { DayWorkout } from '../lib/ledger'

export interface LinkedCtx {
  workout: DayWorkout | undefined
  arbor: ArborState
  plan: DayPlan
  onSkill: (skillId: string, done: boolean, value?: number) => void
}

// ── pixel pictograms (same engine Arbor draws its tree with) ────────────────
const TONES_TODO = ['', '#f2efe6', '#a8a2bd', '#5f5980', '#f2c14e']
const TONES_DONE = ['', '#d3f79a', '#7fb63f', '#4b6a2a', '#f2efe6']
const figureCache = new Map<string, string>()

function figureURL(skillId: string, done: boolean): string {
  const key = `${poseOf(skillId)}|${done ? 1 : 0}`
  const hit = figureCache.get(key)
  if (hit) return hit
  const px = renderPose(POSES[poseOf(skillId)] ?? POSES.stand)
  const tones = done ? TONES_DONE : TONES_TODO
  const c = document.createElement('canvas')
  c.width = G
  c.height = G
  const ctx = c.getContext('2d')
  if (ctx) {
    for (let y = 0; y < G; y++)
      for (let x = 0; x < G; x++) {
        const t = px[y * G + x]
        if (t) {
          ctx.fillStyle = tones[t]
          ctx.fillRect(x, y, 1, 1)
        }
      }
  }
  const url = c.toDataURL()
  figureCache.set(key, url)
  return url
}

const Dumbbell = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="shrink-0">
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />
    </g>
  </svg>
)

const Lock = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="shrink-0">
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d={open ? 'M8 11V7.5a4 4 0 0 1 7.6-1.7' : 'M8 11V7.5a4 4 0 0 1 8 0V11'} />
    </g>
  </svg>
)

/**
 * Body of the Gym row. Once Strong is linked it is not tickable: it opens
 * Strong, and Strong ticks it. Before the first workout has come through, it
 * still ticks by hand so you are never locked out.
 */
export function StrongTile({
  name, xp, ticked, today, workout, locked, onToggle,
}: {
  name: string
  xp: number
  ticked: boolean
  today: string
  workout: DayWorkout | undefined
  locked: boolean
  onToggle: () => void
}) {
  const s = workout?.session
  const sub = ticked
    ? s
      ? `Done · ${s.durationMin} min · ${s.totalSets} sets`
      : 'Done'
    : `Today: ${gymDayFor(today).name}`
  if (!locked) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Tap to tick. Locks to Strong after your first workout logged there.">
          <Dumbbell />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-base font-bold ${ticked ? 'line-through opacity-80' : ''}`}>{name}</span>
            <span className="block truncate text-[11px] font-bold opacity-75">{ticked ? 'Done' : `Today: ${gymDayFor(today).name}`}</span>
          </span>
        </button>
        <a href={STRONG_URL} target="_blank" rel="noreferrer" className="shrink-0 border-2 border-black bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase no-underline" title="Open Strong">Strong ↗</a>
        <span className="num shrink-0 text-base font-bold">{ticked ? `+${xp}` : xp}</span>
      </div>
    )
  }
  return (
    <a
      href={STRONG_URL}
      target="_blank"
      rel="noreferrer"
      title={ticked ? 'Logged in Strong' : 'Locked: finish the workout in Strong and this ticks itself'}
      className="flex min-w-0 flex-1 items-center gap-3 py-2 no-underline"
    >
      <Dumbbell />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-base font-bold ${ticked ? 'line-through opacity-80' : ''}`}>{name}</span>
        <span className="block truncate text-[11px] font-bold opacity-75">{sub}{!ticked && ' ↗'}</span>
      </span>
      <Lock open={ticked} />
      <span className="num shrink-0 text-base font-bold">{ticked ? `+${xp}` : xp}</span>
    </a>
  )
}

/** Header of the Arbor row: tap to fold the skill list in or out. */
export function ArborHead({ name, xp, ticked, done, total, open, onToggle }: { name: string; xp: number; ticked: boolean; done: number; total: number; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
      <span className="arbor-sprout" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="arbor-title block truncate">{name}</span>
        <span className="block truncate text-[11px] opacity-75">
          {total === 0 ? 'Nothing planned today' : ticked ? 'All skills practised' : `${done}/${total} practised · ${open ? 'tap to fold' : 'tap to open'}`}
        </span>
      </span>
      <span className="arbor-count num shrink-0">{done}/{total}</span>
      <span className="num shrink-0 text-base font-bold">{ticked ? `+${xp}` : xp}</span>
    </button>
  )
}

/** Today's coach-picked skills. Ticking one logs the practice for Arbor; a number logs a new best too. */
export function ArborSkills({ ctx, today }: { ctx: LinkedCtx; today: string }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const skills = useMemo(
    () => ctx.plan.morning.map((id) => SKILL_BY_ID.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x)),
    [ctx.plan],
  )
  return (
    <div className="arbor-panel">
      {skills.map((sk) => {
        const done = practicedOn(ctx.arbor, today, sk.id)
        const cur = valueOf(sk, ctx.arbor.progress[sk.id])
        return (
          <div key={sk.id} className={`arbor-skill ${done ? 'is-done' : ''}`}>
            <img src={figureURL(sk.id, done)} alt="" width={40} height={40} className="arbor-fig" />
            <span className="min-w-0 flex-1">
              <span className="arbor-skill-name block truncate">{sk.name}</span>
              <span className="arbor-skill-target block">{targetFor(sk, ctx.arbor.progress)}</span>
            </span>
            {sk.unit && (
              <input
                inputMode="numeric"
                value={drafts[sk.id] ?? ''}
                placeholder={cur ? String(cur) : sk.unit}
                aria-label={`New best for ${sk.name} (${sk.unit})`}
                onChange={(e) => setDrafts((d) => ({ ...d, [sk.id]: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))}
                className="arbor-input num"
              />
            )}
            <button
              type="button"
              aria-pressed={done}
              aria-label={`${sk.name} practised`}
              onClick={() => {
                const n = Number(drafts[sk.id])
                ctx.onSkill(sk.id, !done, !done && drafts[sk.id] && n > cur ? n : undefined)
                setDrafts((d) => ({ ...d, [sk.id]: '' }))
              }}
              className="arbor-tick"
            >
              <svg viewBox="0 0 7 7" width="16" height="16" shapeRendering="crispEdges" aria-hidden="true">
                <path fill="currentColor" d="M6 1h1v1H6zM5 2h2v1H5zM0 3h1v1H0zM4 3h2v1H4zM0 4h2v1H0zM3 4h2v1H3zM1 5h3v1H1zM2 6h1v1H2z" />
              </svg>
            </button>
          </div>
        )
      })}
      <a href={ARBOR_URL} target="_blank" rel="noreferrer" className="arbor-link">open the tree ↗</a>
    </div>
  )
}
