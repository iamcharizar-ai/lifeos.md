// A pillar's track, drawn on its tile with no words (the owner's decision, 12 Nov 2026): seven pips that fill as the track fills, glowing when the prize
// waits; and, in a corner, the type of the gym leader who is up when this pillar hits that leader hardest. Both come from the game core (game.tracks,
// game.league); nothing is stored here.
import { leaderOf, type Game } from '../game-core/fold.ts'
import { POKEDEX_URL } from '../lib/game'
import { domainOf, type Habit } from '../config/habits'

export interface TrackMarkData { pips: number; of: number; full: boolean; foe?: string }

/** What a pillar's tile shows of the game, or nothing: version 22 only, a pillar only, and only a kind of work that has a track. */
export function trackMarkFor(game: Game, habit: Pick<Habit, 'id' | 'tier' | 'domain'>): TrackMarkData | undefined {
  if (!game.v22 || habit.tier !== 'pillar') return undefined
  const tag = domainOf(habit)
  const track = (game.tracks as Record<string, Game['tracks'][keyof Game['tracks']] | undefined>)[tag]
  if (!track) return undefined
  const weak = !game.league.waiting && (game.league.weak as string[]).includes(tag)
  return { pips: track.pips, of: track.of, full: track.ready, foe: weak ? leaderOf(game.league.index, game.league.slot)?.type : undefined }
}

export function TrackMark({ pips, of, full, foe }: TrackMarkData) {
  return (
    <>
      <span className={`track-pips ${full ? 'is-full' : ''}`} aria-hidden>
        {Array.from({ length: of }, (_, i) => <i key={i} className={full || i < pips ? 'on' : ''} />)}
      </span>
      {foe && (
        <img
          className="track-foe"
          src={`${POKEDEX_URL}/sprites/types/${foe}.png`}
          alt=""
          role="presentation"
          width={22}
          height={22}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
    </>
  )
}
