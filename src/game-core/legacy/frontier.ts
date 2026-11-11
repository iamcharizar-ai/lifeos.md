// GAME CORE: the Battle Frontier (rules version 13, RULES-V13.md).
//
// Seven facilities, each a run of one kind of day. A run is a streak: it goes
// on while the days keep coming, with a rest day or two forgiven, and starts
// again after a longer gap. Every win pays a Battle Point, every seventh in a row many more; a long enough run
// brings out the Frontier Brain, and beating them (reaching the Silver and the
// Gold line) hands over a Symbol. The Pyramid counts perfect days instead.
//
// Pure data. The fold (fold.ts) keeps each run, pays the points and the symbols.

export type FacilityWin = 'tower' | 'code' | 'fitness' | 'guitar' | 'arbor' | 'sleep' | 'perfect'

export interface Facility {
  id: string
  name: string
  /** the Frontier Brain who waits at the end of the run */
  brain: string
  /** an item picture that stands for the facility */
  icon: string
  /** what a win is */
  win: FacilityWin
  /** the plain words for a win */
  what: string
  /** most days between two wins for the run to go on (2 = one rest day forgiven); 0 = not a run, every win counts for life */
  gap: number
  silver: number
  gold: number
  /** what the Gold Symbol hands over besides points: a Legend key */
  goldKey: string
  /** what the Silver Symbol hands over besides points */
  silverItem: string
}

export const FACILITIES: Facility[] = [
  { id: 'tower', name: 'Battle Tower', brain: 'Palmer', icon: 'rainbow-pass', win: 'tower', what: 'a day with two pillars', gap: 2, silver: 14, gold: 35, goldKey: 'old-sea-map', silverItem: 'rare-candy' },
  { id: 'factory', name: 'Battle Factory', brain: 'Noland', icon: 'scanner', win: 'code', what: 'a code day', gap: 3, silver: 10, gold: 30, goldKey: 'meteorite', silverItem: 'up-grade' },
  { id: 'arena', name: 'Battle Arena', brain: 'Greta', icon: 'black-belt', win: 'fitness', what: 'a gym day', gap: 3, silver: 10, gold: 30, goldKey: 'red-orb', silverItem: 'razor-claw' },
  { id: 'palace', name: 'Battle Palace', brain: 'Spenser', icon: 'gb-sounds', win: 'guitar', what: 'a guitar day', gap: 3, silver: 10, gold: 30, goldKey: 'soul-dew', silverItem: 'shiny-stone' },
  { id: 'dome', name: 'Battle Dome', brain: 'Tucker', icon: 'growth-mulch', win: 'arbor', what: 'an Arbor morning', gap: 3, silver: 10, gold: 30, goldKey: 'gracidea', silverItem: 'leaf-stone' },
  { id: 'pike', name: 'Battle Pike', brain: 'Lucy', icon: 'moon-stone', win: 'sleep', what: 'a good night (80 or more)', gap: 2, silver: 7, gold: 21, goldKey: 'member-card', silverItem: 'dusk-stone' },
  { id: 'pyramid', name: 'Battle Pyramid', brain: 'Brandon', icon: 'relic-statue', win: 'perfect', what: 'a perfect day', gap: 0, silver: 5, gold: 15, goldKey: 'jade-orb', silverItem: 'relic-gold' },
]

/**
 * Battle Points a win pays: one for every win, and at every seventh win in a row a bonus of 7 at seven, 14 at fourteen, and so on up to 35.
 * The Pyramid, which is not a run, pays 3 for every perfect day.
 */
export const bpFor = (run: number, counted = false): number => (counted ? 3 : run <= 0 ? 0 : 1 + (run % 7 === 0 ? Math.min(35, run) : 0))
/** Points with each Symbol. */
export const SILVER_BP = 25
export const GOLD_BP = 60
export const SILVER_GEMS = 20
export const GOLD_GEMS = 50
/** Battle Points a Rematch win pays (a Champion pays five times as many). */
export const REMATCH_BP = 6
