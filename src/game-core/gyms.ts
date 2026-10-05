// The gyms and league of each region: who stands in the way, in order.
// Names and types only; the trainer pictures are served by the Pokedex site
// from /sprites/trainers/<sprite>.png and are not part of this file.
//
// Each badge week beats the next one in line: eight gyms, then the four, then
// the champion. A missed week costs nothing; the next badge week carries on.

export interface Leader {
  name: string
  type: string
  /** what beating them hands over */
  badge: string
  sprite: string
}
export interface League {
  gyms: Leader[]
  four: Leader[]
  champion: Leader
}

const L = (name: string, type: string, badge: string, sprite = name.toLowerCase().replace(/[^a-z]/g, '')): Leader => ({ name, type, badge, sprite })
const E = (name: string, type: string, sprite?: string): Leader => L(name, type, '', sprite)

/** One per region, in the order of REGIONS. */
export const LEAGUES: League[] = [
  {
    gyms: [L('Brock', 'Rock', 'Boulder'), L('Misty', 'Water', 'Cascade'), L('Lt. Surge', 'Electric', 'Thunder'), L('Erika', 'Grass', 'Rainbow'), L('Koga', 'Poison', 'Soul'), L('Sabrina', 'Psychic', 'Marsh'), L('Blaine', 'Fire', 'Volcano'), L('Giovanni', 'Ground', 'Earth')],
    four: [E('Lorelei', 'Ice', 'lorelei-gen3'), E('Bruno', 'Fighting'), E('Agatha', 'Ghost', 'agatha-gen3'), E('Lance', 'Dragon')],
    champion: E('Blue', 'Normal'),
  },
  {
    gyms: [L('Falkner', 'Flying', 'Zephyr'), L('Bugsy', 'Bug', 'Hive'), L('Whitney', 'Normal', 'Plain'), L('Morty', 'Ghost', 'Fog'), L('Chuck', 'Fighting', 'Storm'), L('Jasmine', 'Steel', 'Mineral'), L('Pryce', 'Ice', 'Glacier'), L('Clair', 'Dragon', 'Rising')],
    four: [E('Will', 'Psychic'), E('Koga', 'Poison'), E('Bruno', 'Fighting'), E('Karen', 'Dark')],
    champion: E('Lance', 'Dragon'),
  },
  {
    gyms: [L('Roxanne', 'Rock', 'Stone'), L('Brawly', 'Fighting', 'Knuckle'), L('Wattson', 'Electric', 'Dynamo'), L('Flannery', 'Fire', 'Heat'), L('Norman', 'Normal', 'Balance'), L('Winona', 'Flying', 'Feather'), L('Tate & Liza', 'Psychic', 'Mind', 'tateandliza-gen3'), L('Wallace', 'Water', 'Rain')],
    four: [E('Sidney', 'Dark'), E('Phoebe', 'Ghost', 'phoebe-gen3'), E('Glacia', 'Ice'), E('Drake', 'Dragon', 'drake-gen3')],
    champion: E('Steven', 'Steel'),
  },
  {
    gyms: [L('Roark', 'Rock', 'Coal'), L('Gardenia', 'Grass', 'Forest'), L('Maylene', 'Fighting', 'Cobble'), L('Crasher Wake', 'Water', 'Fen'), L('Fantina', 'Ghost', 'Relic'), L('Byron', 'Steel', 'Mine'), L('Candice', 'Ice', 'Icicle'), L('Volkner', 'Electric', 'Beacon')],
    four: [E('Aaron', 'Bug'), E('Bertha', 'Ground'), E('Flint', 'Fire'), E('Lucian', 'Psychic')],
    champion: E('Cynthia', 'Dragon'),
  },
  {
    gyms: [L('Cilan', 'Grass', 'Trio'), L('Lenora', 'Normal', 'Basic'), L('Burgh', 'Bug', 'Insect'), L('Elesa', 'Electric', 'Bolt'), L('Clay', 'Ground', 'Quake'), L('Skyla', 'Flying', 'Jet'), L('Brycen', 'Ice', 'Freeze'), L('Drayden', 'Dragon', 'Legend')],
    four: [E('Shauntal', 'Ghost'), E('Grimsley', 'Dark'), E('Caitlin', 'Psychic'), E('Marshal', 'Fighting')],
    champion: E('Alder', 'Bug'),
  },
  {
    gyms: [L('Viola', 'Bug', 'Bug'), L('Grant', 'Rock', 'Cliff'), L('Korrina', 'Fighting', 'Rumble'), L('Ramos', 'Grass', 'Plant'), L('Clemont', 'Electric', 'Voltage'), L('Valerie', 'Fairy', 'Fairy'), L('Olympia', 'Psychic', 'Psychic'), L('Wulfric', 'Ice', 'Iceberg')],
    four: [E('Malva', 'Fire'), E('Siebold', 'Water'), E('Wikstrom', 'Steel'), E('Drasna', 'Dragon')],
    champion: E('Diantha', 'Fairy'),
  },
  {
    // Alola has trials instead of gyms: the captains and kahunas stand in, and hand over a Z-Crystal
    gyms: [L('Ilima', 'Normal', 'Normalium Z'), L('Lana', 'Water', 'Waterium Z'), L('Kiawe', 'Fire', 'Firium Z'), L('Mallow', 'Grass', 'Grassium Z'), L('Sophocles', 'Electric', 'Electrium Z'), L('Mina', 'Fairy', 'Fairium Z'), L('Nanu', 'Dark', 'Darkinium Z'), L('Hapu', 'Ground', 'Groundium Z')],
    four: [E('Hala', 'Fighting'), E('Olivia', 'Rock'), E('Acerola', 'Ghost'), E('Kahili', 'Flying')],
    champion: E('Kukui', 'Rock'),
  },
  {
    gyms: [L('Milo', 'Grass', 'Grass'), L('Nessa', 'Water', 'Water'), L('Kabu', 'Fire', 'Fire'), L('Bea', 'Fighting', 'Fighting'), L('Opal', 'Fairy', 'Fairy'), L('Gordie', 'Rock', 'Rock'), L('Piers', 'Dark', 'Dark'), L('Raihan', 'Dragon', 'Dragon')],
    // Galar has a Champion Cup instead of an Elite Four
    four: [E('Allister', 'Ghost'), E('Melony', 'Ice'), E('Marnie', 'Dark'), E('Hop', 'Normal')],
    champion: E('Leon', 'Fire'),
  },
  {
    gyms: [L('Katy', 'Bug', 'Bug'), L('Brassius', 'Grass', 'Grass'), L('Iono', 'Electric', 'Electric'), L('Kofu', 'Water', 'Water'), L('Larry', 'Normal', 'Normal'), L('Ryme', 'Ghost', 'Ghost'), L('Tulip', 'Psychic', 'Psychic'), L('Grusha', 'Ice', 'Ice')],
    four: [E('Rika', 'Ground'), E('Poppy', 'Steel'), E('Larry', 'Flying'), E('Hassel', 'Dragon')],
    champion: E('Geeta', 'Rock'),
  },
]

/** Every trainer picture the game refers to. */
export const TRAINER_SPRITES: string[] = [...new Set(LEAGUES.flatMap((l) => [...l.gyms, ...l.four, l.champion].map((t) => t.sprite)))]
