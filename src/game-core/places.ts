// The places of the Today scene, as the rules need them (not only as the screen draws them).
//
// From SCENES_START (core/rules.ts) a wild Pokemon can turn up only in a place you own. The Meadow is always yours; every other place is a scene
// bought in the Rare shop for gems. A place is where a wild Pokemon is met: its first type's place, and the Cave is the home of the cave-dwellers.
// The screen (src/screens/stage.ts) draws each place; this file only says which Pokemon belong to which, what each costs and what it is called.
import { SPECIES } from './species.ts'

export type Biome = 'meadow' | 'shore' | 'marsh' | 'canyon' | 'volcano' | 'snow' | 'cliff' | 'pass' | 'plain' | 'ruins' | 'flowers' | 'steel' | 'cave'

const TYPE_BIOME: Record<string, Biome> = {
  Normal: 'meadow', Grass: 'meadow', Bug: 'meadow', Water: 'shore', Poison: 'marsh', Rock: 'canyon', Ground: 'canyon', Fighting: 'canyon',
  Fire: 'volcano', Ice: 'snow', Flying: 'cliff', Dragon: 'pass', Electric: 'plain', Ghost: 'ruins', Dark: 'ruins', Psychic: 'ruins', Fairy: 'flowers', Steel: 'steel',
}
/** Where a wild Pokemon of these types is met: its first type's place, unless that type is Normal and it has a second (a Pidgey is met on a cliff). */
export function biomeOf(t: string, t2?: string | null): Biome {
  const a = TYPE_BIOME[t] ?? 'meadow'
  return a === 'meadow' && t === 'Normal' && t2 && TYPE_BIOME[t2] ? TYPE_BIOME[t2] : a
}

/** The cave-dwellers: met in the Cave whatever their type. Only ever first stages are rolled, so a line is named by its first stage. */
export const CAVE_FOLK: readonly string[] = ['zubat', 'geodude', 'onix', 'diglett', 'nosepass', 'aron', 'roggenrola', 'woobat', 'drilbur', 'sableye', 'larvitar', 'carbink', 'mawile', 'rolycoly', 'nacli']
const CAVE_SET = new Set(CAVE_FOLK)
/** The place a Pokemon is met in (the cave-dwellers in the Cave, the rest by type). An unknown form is met in the Meadow. */
export function biomeOfForm(form: string): Biome {
  const r = SPECIES[form]
  if (!r) return 'meadow'
  return CAVE_SET.has(r.b ?? form) ? 'cave' : biomeOf(r.t, r.t2)
}

/** The Meadow is the place everyone starts in: it is never bought and never taken away. */
export const FREE_PLACE: Biome = 'meadow'

export interface PlaceInfo { name: string; /** gems, in the Rare shop (none for the free Meadow) */ gems: number; /** who is met there, in a few words */ kin: string }
/** Every place, in the order the Shop shows the ones for sale: the larger the crowd it lets in, the dearer. */
export const PLACE_INFO: Record<Biome, PlaceInfo> = {
  meadow: { name: 'Meadow', gems: 0, kin: 'Normal, Grass and Bug' },
  shore: { name: 'Beach', gems: 80, kin: 'Water' },
  canyon: { name: 'Canyon', gems: 80, kin: 'Rock, Ground and Fighting' },
  ruins: { name: 'Ruins', gems: 80, kin: 'Ghost, Dark and Psychic' },
  plain: { name: 'Power Plains', gems: 60, kin: 'Electric' },
  volcano: { name: 'Volcano', gems: 60, kin: 'Fire' },
  cave: { name: 'Cave', gems: 60, kin: 'the cave-dwellers' },
  steel: { name: 'Ironworks', gems: 40, kin: 'Steel' },
  pass: { name: 'Mountain Pass', gems: 40, kin: 'Dragon' },
  cliff: { name: 'Sky Cliffs', gems: 40, kin: 'Flying' },
  snow: { name: 'Snowfield', gems: 40, kin: 'Ice' },
  marsh: { name: 'Marsh', gems: 40, kin: 'Poison' },
  flowers: { name: 'Flower Garden', gems: 40, kin: 'Fairy' },
}
/** The places that are bought, cheapest crowd last, as the Shop lists them. */
export const BUYABLE_PLACES = (Object.keys(PLACE_INFO) as Biome[]).filter((b) => b !== FREE_PLACE)

/** A scene is an item in the Bag: `scene-<place>`. The Meadow's is never in `inv` (it is always yours) but it can be chosen all the same. */
export const SCENE_PREFIX = 'scene-'
export const sceneItem = (b: Biome): string => SCENE_PREFIX + b
/** The place a scene item is, or null for anything else (the older `theme-*` scenes are not places). */
export const placeOfScene = (item: string): Biome | null => {
  if (!item.startsWith(SCENE_PREFIX)) return null
  const b = item.slice(SCENE_PREFIX.length) as Biome
  return b in PLACE_INFO ? b : null
}

/** The first-stage Pokemon that can turn up in a place (Legendaries are met wherever they come, so none belongs to a place), by Pokedex number. */
export function placeFolk(b: Biome): string[] {
  return Object.entries(SPECIES)
    .filter(([id, r]) => r.s === 1 && !r.f && r.r && r.r !== 'L' && biomeOfForm(id) === b)
    .sort((a, c) => a[1].d - c[1].d)
    .map(([id]) => id)
}
