// The leagues, in the order they are met: who stands in the way, and in what
// order. Names and types only; the trainer pictures are served by the Pokedex
// site from /sprites/trainers/<sprite>.png and are not part of this file.
//
// Every leader has an HP bar. Each day's work wears the current one down; when
// it falls, the next steps up the following morning. Gyms first, then the
// Elite Four, then the Champion.

export interface Leader {
  name: string
  type: string
  /** what beating them hands over */
  badge: string
  /** file name of the picture; empty when there is none and a silhouette is drawn */
  sprite: string
}
export interface League {
  name: string
  /** the region (1-9) whose species this league belongs to; null for an interlude that opens nothing */
  region: number | null
  gyms: Leader[]
  four: Leader[]
  champion: Leader
}

const L = (name: string, type: string, badge: string, sprite = name.toLowerCase().replace(/[^a-z]/g, '')): Leader => ({ name, type, badge, sprite })
const E = (name: string, type: string, sprite?: string): Leader => L(name, type, '', sprite)

/** Everyone to beat in a league, in order: gyms, Elite Four, Champion. */
export const lineup = (l: League): Leader[] => [...l.gyms, ...l.four, l.champion]

/** In the order they are met. The Orange League is an interlude between Kanto and Johto. */
export const LEAGUES: League[] = [
  {
    name: 'Kanto', region: 1,
    gyms: [L('Brock', 'Rock', 'Boulder'), L('Misty', 'Water', 'Cascade'), L('Lt. Surge', 'Electric', 'Thunder'), L('Erika', 'Grass', 'Rainbow'), L('Koga', 'Poison', 'Soul'), L('Sabrina', 'Psychic', 'Marsh'), L('Blaine', 'Fire', 'Volcano'), L('Giovanni', 'Ground', 'Earth')],
    four: [E('Lorelei', 'Ice', 'lorelei-gen3'), E('Bruno', 'Fighting'), E('Agatha', 'Ghost', 'agatha-gen3'), E('Lance', 'Dragon')],
    champion: E('Blue', 'Normal'),
  },
  {
    // the Orange Crew: four gyms and the head of the crew, no Elite Four. No pictures of them exist in the sprite set
    name: 'Orange Islands', region: null,
    gyms: [L('Cissy', 'Water', 'Coral-Eye', ''), L('Danny', 'Ice', 'Sea Ruby', ''), L('Rudy', 'Grass', 'Spike Shell', ''), L('Luana', 'Psychic', 'Jade Star', '')],
    four: [],
    champion: E('Drake', 'Dragon', ''),
  },
  {
    name: 'Johto', region: 2,
    gyms: [L('Falkner', 'Flying', 'Zephyr'), L('Bugsy', 'Bug', 'Hive'), L('Whitney', 'Normal', 'Plain'), L('Morty', 'Ghost', 'Fog'), L('Chuck', 'Fighting', 'Storm'), L('Jasmine', 'Steel', 'Mineral'), L('Pryce', 'Ice', 'Glacier'), L('Clair', 'Dragon', 'Rising')],
    four: [E('Will', 'Psychic'), E('Koga', 'Poison'), E('Bruno', 'Fighting'), E('Karen', 'Dark')],
    champion: E('Lance', 'Dragon'),
  },
  {
    name: 'Hoenn', region: 3,
    gyms: [L('Roxanne', 'Rock', 'Stone'), L('Brawly', 'Fighting', 'Knuckle'), L('Wattson', 'Electric', 'Dynamo'), L('Flannery', 'Fire', 'Heat'), L('Norman', 'Normal', 'Balance'), L('Winona', 'Flying', 'Feather'), L('Tate & Liza', 'Psychic', 'Mind', 'tateandliza-gen3'), L('Wallace', 'Water', 'Rain')],
    four: [E('Sidney', 'Dark'), E('Phoebe', 'Ghost', 'phoebe-gen3'), E('Glacia', 'Ice'), E('Drake', 'Dragon', 'drake-gen3')],
    champion: E('Steven', 'Steel'),
  },
  {
    name: 'Sinnoh', region: 4,
    gyms: [L('Roark', 'Rock', 'Coal'), L('Gardenia', 'Grass', 'Forest'), L('Maylene', 'Fighting', 'Cobble'), L('Crasher Wake', 'Water', 'Fen'), L('Fantina', 'Ghost', 'Relic'), L('Byron', 'Steel', 'Mine'), L('Candice', 'Ice', 'Icicle'), L('Volkner', 'Electric', 'Beacon')],
    four: [E('Aaron', 'Bug'), E('Bertha', 'Ground'), E('Flint', 'Fire'), E('Lucian', 'Psychic')],
    champion: E('Cynthia', 'Dragon'),
  },
  {
    name: 'Unova', region: 5,
    gyms: [L('Cilan', 'Grass', 'Trio'), L('Lenora', 'Normal', 'Basic'), L('Burgh', 'Bug', 'Insect'), L('Elesa', 'Electric', 'Bolt'), L('Clay', 'Ground', 'Quake'), L('Skyla', 'Flying', 'Jet'), L('Brycen', 'Ice', 'Freeze'), L('Drayden', 'Dragon', 'Legend')],
    four: [E('Shauntal', 'Ghost'), E('Grimsley', 'Dark'), E('Caitlin', 'Psychic'), E('Marshal', 'Fighting')],
    champion: E('Alder', 'Bug'),
  },
  {
    name: 'Kalos', region: 6,
    gyms: [L('Viola', 'Bug', 'Bug'), L('Grant', 'Rock', 'Cliff'), L('Korrina', 'Fighting', 'Rumble'), L('Ramos', 'Grass', 'Plant'), L('Clemont', 'Electric', 'Voltage'), L('Valerie', 'Fairy', 'Fairy'), L('Olympia', 'Psychic', 'Psychic'), L('Wulfric', 'Ice', 'Iceberg')],
    four: [E('Malva', 'Fire'), E('Siebold', 'Water'), E('Wikstrom', 'Steel'), E('Drasna', 'Dragon')],
    champion: E('Diantha', 'Fairy'),
  },
  {
    name: 'Alola', region: 7,
    // Alola has trials instead of gyms: the captains and kahunas stand in, and hand over a Z-Crystal
    gyms: [L('Ilima', 'Normal', 'Normalium Z'), L('Lana', 'Water', 'Waterium Z'), L('Kiawe', 'Fire', 'Firium Z'), L('Mallow', 'Grass', 'Grassium Z'), L('Sophocles', 'Electric', 'Electrium Z'), L('Mina', 'Fairy', 'Fairium Z'), L('Nanu', 'Dark', 'Darkinium Z'), L('Hapu', 'Ground', 'Groundium Z')],
    four: [E('Hala', 'Fighting'), E('Olivia', 'Rock'), E('Acerola', 'Ghost'), E('Kahili', 'Flying')],
    champion: E('Kukui', 'Rock'),
  },
  {
    name: 'Galar', region: 8,
    gyms: [L('Milo', 'Grass', 'Grass'), L('Nessa', 'Water', 'Water'), L('Kabu', 'Fire', 'Fire'), L('Bea', 'Fighting', 'Fighting'), L('Opal', 'Fairy', 'Fairy'), L('Gordie', 'Rock', 'Rock'), L('Piers', 'Dark', 'Dark'), L('Raihan', 'Dragon', 'Dragon')],
    // Galar has a Champion Cup instead of an Elite Four
    four: [E('Allister', 'Ghost'), E('Melony', 'Ice'), E('Marnie', 'Dark'), E('Hop', 'Normal')],
    champion: E('Leon', 'Fire'),
  },
  {
    name: 'Paldea', region: 9,
    gyms: [L('Katy', 'Bug', 'Bug'), L('Brassius', 'Grass', 'Grass'), L('Iono', 'Electric', 'Electric'), L('Kofu', 'Water', 'Water'), L('Larry', 'Normal', 'Normal'), L('Ryme', 'Ghost', 'Ghost'), L('Tulip', 'Psychic', 'Psychic'), L('Grusha', 'Ice', 'Ice')],
    four: [E('Rika', 'Ground'), E('Poppy', 'Steel'), E('Larry', 'Flying'), E('Hassel', 'Dragon')],
    champion: E('Geeta', 'Rock'),
  },
]

/** Every trainer picture the game refers to. */
export const TRAINER_SPRITES: string[] = [...new Set(LEAGUES.flatMap((l) => lineup(l).map((t) => t.sprite)).filter(Boolean))]
