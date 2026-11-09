// Tiles for the habits that other apps feed (see lib/arborLink.ts and
// lib/guitarLink.ts). Each wears its own app's look so it is obvious at a
// glance that it is not an ordinary tick: Strong's is a yellow neo-brutalist
// slab with a padlock, Arbor's is a dark pixel-art panel that opens into
// today's skills, Woodshed's is a painted guitar body with cream plates that
// opens the app.
import { useMemo, useState } from 'react'
import { targetFor as skillTarget } from '../arbor-core/coach.ts'
import { practicedOn, valueOf, type ArborState, type DayPlan } from '../arbor-core/model.ts'
import { G, renderPose } from '../arbor-core/pixel/figure.js'
import { POSES } from '../arbor-core/pixel/poses.js'
import { poseOf } from '../arbor-core/pixel/skillPoses.js'
import { SKILL_BY_ID } from '../arbor-core/skills.ts'
import { ARBOR_URL, STRONG_URL } from '../lib/arborLink'
import { WOODSHED_URL } from '../lib/guitarLink'
import type { ShedState } from '../woodshed-core/model.ts'
import type { DayWorkout } from '../lib/ledger'
import type { SleepNight } from '../game-core/events.ts'
import type { SleepState } from '../lib/gameLink'
import type { CheckAnswer } from '../lib/healthCheck'

export interface LinkedCtx {
  workout: DayWorkout | undefined
  /** name of the session that is next in the split (follows the last workout, not the calendar) */
  gymNext: string
  arbor: ArborState
  plan: DayPlan
  onSkill: (skillId: string, done: boolean, value?: number) => void
  guitar: {
    shed: ShedState
    /** today's session: item ids, in order */
    session: string[]
  }
  /** last night: measured by the band, waiting for its reading, or no band in use */
  sleep: { state: SleepState; night: SleepNight | undefined; check?: CheckAnswer | null }
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
  name, xp, ticked, next, workout, locked, onToggle,
}: {
  name: string
  xp: number
  ticked: boolean
  next: string
  workout: DayWorkout | undefined
  locked: boolean
  onToggle: () => void
}) {
  const s = workout?.session
  const sub = ticked
    ? s
      ? `Done · ${s.durationMin} min · ${s.totalSets} sets`
      : 'Done'
    : `Next up: ${next}`
  if (!locked) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Tap to tick. Locks to Strong after your first workout logged there.">
          <Dumbbell />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-base font-bold ${ticked ? 'line-through opacity-80' : ''}`}>{name}</span>
            <span className="block truncate text-[11px] font-bold opacity-75">{ticked ? 'Done' : `Next up: ${next}`}</span>
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

/** Today's coach-picked skills. Ticking one logs the practice for Arbor; a number logs what you actually did (higher or lower) too. */
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
              <span className="arbor-skill-target block">{skillTarget(sk, ctx.arbor.progress)}</span>
            </span>
            {sk.unit && (
              <input
                inputMode="numeric"
                value={drafts[sk.id] ?? ''}
                placeholder={cur ? String(cur) : sk.unit}
                aria-label={`Today's ${sk.unit} for ${sk.name}`}
                onChange={(e) => setDrafts((d) => ({ ...d, [sk.id]: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))}
                className="arbor-input num"
              />
            )}
            <button
              type="button"
              aria-pressed={done}
              aria-label={`${sk.name} practised`}
              onClick={() => {
                // Whatever you typed is what you did today, higher OR lower than last time. `cur` is the
                // current ability (last write wins), not a high-water mark, so a weaker day is recorded too.
                const n = Number(drafts[sk.id])
                ctx.onSkill(sk.id, !done, !done && drafts[sk.id] && Number.isFinite(n) && n > 0 && n !== cur ? n : undefined)
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

/**
 * The Woodshed row when Woodshed has a URL: like Gym, it opens the app, and the
 * habit ticks itself when the day's session is logged there. No panel here.
 */
export function GuitarTile({ name, xp, ticked, done, total }: { name: string; xp: number; ticked: boolean; done: number; total: number }) {
  return (
    <a
      href={WOODSHED_URL}
      target="_blank"
      rel="noreferrer"
      title={ticked ? 'Logged in Woodshed' : 'Practise in Woodshed and this ticks itself'}
      className="flex min-w-0 flex-1 items-center gap-3 py-2 no-underline"
    >
      <span className="shed-frets" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="shed-title block truncate">{name}</span>
        <span className="block truncate text-[11px] opacity-80">
          {total === 0 ? 'Nothing in rotation' : ticked ? 'Session done' : `${done}/${total} practised`}{!ticked && ' ↗'}
        </span>
      </span>
      <span className="shed-count num shrink-0">{done}/{total}</span>
      <span className="num shrink-0 text-base font-bold">{ticked ? `+${xp}` : xp}</span>
    </a>
  )
}

// ── Sleep: the night as the band measured it ────────────────────────────────
const Moon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="shrink-0">
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
  </svg>
)
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
const clock = (s?: string) => (s ? s.slice(11, 16) : '')

/** Samsung Health's words for a score (the ones Vitals uses). */
const scoreWord = (n: number) => (n >= 90 ? 'Excellent' : n >= 80 ? 'Good' : n >= 70 ? 'Fair' : 'Poor')
const STAGES: [keyof SleepNight, string][] = [['deepMin', '#6b5be0'], ['remMin', '#63c6ff'], ['lightMin', '#a9b3d6'], ['awakeMin', '#ff7aa8']]

/**
 * Sleep, the pillar the band fills. With last night's reading it is a small sleep card in the Vitals way (the score on a ring, how
 * long, from when to when, the stages, and what it paid). Without one it waits and says what it is waiting on (the phone has not
 * synced, or the night is being scored); from version 14 the night can be reported by hand, paid as a core habit with no Bells,
 * until the reading comes and replaces it. Left alone, a night with no reading is simply not part of the day.
 */
export function SleepTile({ name, state, night, ticked, selfXp, onToggle, check }: { name: string; state: SleepState; night: SleepNight | undefined; ticked?: boolean; selfXp?: number; onToggle?: () => void; check?: CheckAnswer | null }) {
  if (state === 'measured' && night) {
    const score = night.score ?? 0
    const bells = score >= 90 ? 2 : score >= 80 ? 1 : 0
    const total = STAGES.reduce((n, [k]) => n + ((night[k] as number | undefined) ?? 0), 0)
    const r = 15, c = 2 * Math.PI * r
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3 py-2" title="Measured by your band: the score is the pillar's XP; 80 or more fills it and pays a Bell, 90 two.">
        <span className="sleep-ring" aria-label={`Sleep score ${score}`}>
          <svg viewBox="0 0 36 36" width="46" height="46" aria-hidden>
            <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
            <circle cx="18" cy="18" r={r} fill="none" stroke={score >= 80 ? '#f2c14e' : '#8f86ff'} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(c * score) / 100} ${c}`} transform="rotate(-90 18 18)" />
          </svg>
          <b className="num">{score}</b>
        </span>
        <span className="min-w-0 flex-1">
          <span className="vit-title block truncate">{name} <small className="sleep-word">{scoreWord(score)}</small></span>
          <span className="block truncate text-[11px] font-bold opacity-85">
            {[night.sleepMin !== undefined ? hm(night.sleepMin) : '', night.bed && night.wake ? `${clock(night.bed)} to ${clock(night.wake)}` : ''].filter(Boolean).join(' · ')}
          </span>
          {total > 0 && (
            <span className="sleep-stages" aria-hidden>
              {STAGES.map(([k, col]) => ((night[k] as number | undefined) ? <i key={k} style={{ flex: night[k] as number, background: col }} /> : null))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="num text-base font-bold">+{score}</span>
          {bells > 0 && <span className="sleep-bells">{bells === 2 ? '🔔🔔' : '🔔'}</span>}
        </span>
      </div>
    )
  }
  const line = state !== 'waiting' ? 'Filled by your band\'s reading of the night'
    : ticked ? 'Reported by hand · the band\'s reading replaces it'
      : check && check.state !== 'measured' ? (check.warning ?? check.message)
        : 'Waiting for last night\'s reading · it fills when the band syncs'
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 py-2" title="Filled by your band's reading of the night. A night with no reading is never a miss; you can report it by hand for a core habit's XP.">
      <span className={`sleep-ring waiting ${check?.state === 'not-synced' ? 'nudge' : ''}`} aria-hidden><Moon /></span>
      <span className="min-w-0 flex-1">
        <span className="vit-title block truncate">{name}</span>
        <span className="block text-[11px] font-bold leading-tight opacity-80">{line}</span>
      </span>
      {state === 'waiting' && onToggle
        ? <button type="button" className={`sleep-self num shrink-0 ${ticked ? 'on' : ''}`} aria-pressed={Boolean(ticked)} onClick={onToggle} title={ticked ? 'Take the hand report back' : `No reading yet: report the night yourself (+${selfXp ?? 30} XP, no Bells). The band's reading replaces it when it comes.`}>{ticked ? `✓ +${selfXp ?? 30}` : 'Slept?'}</button>
        : <span className="num shrink-0 text-sm font-bold opacity-70">0 to 100</span>}
    </div>
  )
}

// ── Pillars with no app of their own (LeetCode, and any pillar added later) ──
/**
 * The default look for a pillar that no other app feeds: an ink slab charged in
 * its kind of work's colour. A bar along the bottom runs while it is waiting and
 * fills when it is done, and the line under the name is the run it is on. Being
 * built differently from an ordinary row is what says "pillar"; it needs no badge.
 */
export function PillarTile({ name, emoji, xp, ticked, run, onToggle, xpRef }: { name: string; emoji: string; xp: number; ticked: boolean; run: number; onToggle: () => void; xpRef?: React.Ref<HTMLSpanElement> }) {
  const line = ticked
    ? run > 1 ? `Done · ${run} days running` : 'Done · a run starts today'
    : run > 0 ? `${run}-day run · keep it going` : 'Start a run today'
  return (
    <button type="button" onClick={onToggle} aria-pressed={ticked} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
      <span className="pillar-key" aria-hidden>{ticked ? '✓' : emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="pillar-title block truncate">{name}</span>
        <span className="pillar-line block truncate">{run > 1 && <i className="pillar-run" aria-hidden />}{line}</span>
      </span>
      <span ref={xpRef} className="pillar-xp num shrink-0">{ticked ? `+${xp}` : xp}</span>
    </button>
  )
}
