// The coach: decides what goes in today's session and at what tempo.
//
// Design rules (from how it is meant to be used):
//  • Same things every day until they are yours. The rotation is derived from
//    progress alone, so it changes only when you own something. A missed day
//    (or week) reshuffles nothing.
//  • Owning takes days, not one good take: an item leaves the rotation only
//    after it has been logged clean at its target tempo on several separate days.
//  • One new thing at a time. A slot opens only when its item is owned, and
//    the next item in course order takes it.
//  • Old material stays alive. One owned item comes back per session, at
//    intervals that double each time (2, 4, 8, 16, 30 days).
//  • Tempo moves by how it felt: clean goes up a notch, getting-there stays,
//    rough comes down.
import { OWN_DAYS, daysBetween, isParked, rankOf, statsOf, type Item, type Rank, type ShedState, type Stats } from './model.ts'

/** technique drills in rotation at once */
const DRILL_SLOTS = 3
/** song phrases in rotation at once */
const PHRASE_SLOTS = 2
/** song parts worked on at once */
const PARTS_IN_PLAY = 2
const REVIEW_MAX_DAYS = 30

export interface View {
  stats: Map<string, Stats>
  rank: Map<string, Rank>
}

export function analyse(items: Item[], s: ShedState): View {
  const stats = new Map<string, Stats>()
  const rank = new Map<string, Rank>()
  for (const it of items) {
    const st = statsOf(it, s)
    stats.set(it.id, st)
    rank.set(it.id, rankOf(it, st))
  }
  return { stats, rank }
}

/** Open to practise: already started, or everything it builds on is at least solid. */
export const unlocked = (it: Item, v: View): boolean =>
  (v.rank.get(it.id) ?? 0) >= 1 || it.req.every((id) => (v.rank.get(id) ?? 0) >= 2)

const isSong = (it: Item) => it.lane === 'songs'
/** the song part an item belongs to (a part belongs to itself) */
const partOf = (it: Item) => it.part ?? it.id
/** Parked directly, or a phrase of a parked part. */
export const benched = (it: Item, s: ShedState): boolean => isParked(s, it.id) || Boolean(it.part && isParked(s, it.part))

/** The song parts being learned right now: the first few in course order that are not owned yet. */
export function partsInPlay(items: Item[], s: ShedState, v: View = analyse(items, s)): string[] {
  return items
    .filter((it) => it.kind === 'song' && (v.rank.get(it.id) ?? 0) < 3 && !isParked(s, it.id))
    .slice(0, PARTS_IN_PLAY)
    .map((it) => it.id)
}

/**
 * What is in rotation: the first few open, un-owned items in course order
 * (the order of the list). Phrases come only from the parts in play, so the
 * coach never wanders off to a later song because one of its bars happens to
 * be open. Slots a lane cannot fill go to the other lane.
 */
export function rotation(items: Item[], s: ShedState): Item[] {
  const v = analyse(items, s)
  const playing = new Set(partsInPlay(items, s, v))
  const open = items.filter((it) => (v.rank.get(it.id) ?? 0) < 3 && !benched(it, s) && unlocked(it, v))
  const drills = open.filter((it) => !isSong(it))
  const phrases = open.filter((it) => isSong(it) && playing.has(partOf(it)))
  const nPhrases = Math.min(phrases.length, PHRASE_SLOTS + Math.max(0, DRILL_SLOTS - drills.length))
  const nDrills = Math.min(drills.length, DRILL_SLOTS + PHRASE_SLOTS - nPhrases)
  return [...drills.slice(0, nDrills), ...phrases.slice(0, nPhrases)]
}

/** Days to wait before an owned item comes back: 2, 4, 8, 16, then monthly. */
export const reviewGap = (st: Stats): number => Math.min(REVIEW_MAX_DAYS, 2 * 2 ** st.reviews)

/** The owned item that is most overdue for a revisit, if any is due. */
export function reviewDue(items: Item[], s: ShedState, day: string): Item | undefined {
  const v = analyse(items, s)
  let best: Item | undefined
  let worst = 1
  for (const it of items) {
    const st = v.stats.get(it.id) as Stats
    if (!st.ownedOn || !st.last || benched(it, s)) continue
    // a whole part covers its phrases: once the part is owned, only the part comes back
    if (it.part && (v.rank.get(it.part) ?? 0) >= 3) continue
    const overdue = daysBetween(st.last, day) / reviewGap(st)
    if (overdue >= worst) { worst = overdue; best = it }
  }
  return best
}

/** Compute the session for `day` from scratch. Deterministic for a given state. */
export function planDay(items: Item[], s: ShedState, day: string): string[] {
  const plan = rotation(items, s).map((it) => it.id)
  const review = reviewDue(items, s, day)
  if (review) plan.push(review.id)
  return plan
}

/** Today's session: the frozen one if a device already published it, else freshly computed. */
export function planFor(items: Item[], s: ShedState, day: string): { plan: string[]; frozen: boolean } {
  const saved = s.plans[day]
  return saved ? { plan: saved.items, frozen: true } : { plan: planDay(items, s, day), frozen: false }
}

/** How far the metronome moves after a clean (up) or rough (down) day. */
export const tempoStep = (it: Item): number => Math.max(2, Math.round((it.target ?? 80) * 0.05))

/** The tempo to practise at today, from how the last session went. */
export function tempoFor(it: Item, st: Stats): number | undefined {
  if (!it.target || !it.start) return undefined
  if (st.ownedOn) return it.target
  const last = st.lastBpm
  if (!last) return it.start
  const step = tempoStep(it)
  const floor = Math.round(it.start * 0.75)
  if (st.lastFeel === 2) return Math.min(it.target, last + step)
  if (st.lastFeel === 0) return Math.max(floor, last - step)
  return Math.min(it.target, last)
}

/** One line telling you what to aim for. */
export function targetFor(it: Item, st: Stats): string {
  const need = it.own ?? OWN_DAYS
  if (st.ownedOn) return it.target ? `Owned. Revisit at ${it.target} bpm` : 'Owned. Keep it sharp'
  if (!it.target) return st.days === 0 ? `Own it: clean on ${need} separate days` : `Clean on ${st.cleanDays} of ${need} days`
  const bpm = tempoFor(it, st)
  if (bpm === it.target) return `${bpm} bpm, full tempo. Clean on ${st.cleanDays} of ${need} days`
  return `Today ${bpm} bpm. Full tempo is ${it.target}`
}
