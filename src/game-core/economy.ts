// GAME CORE: items, the Mart, the five domain shops, feats. Rules version 9.
// Pure data and small functions, no DOM. See ECONOMY-V6.md and RULES-V9.md for why each thing is here.
//
// An item's id is the name of its sprite file (public/sprites/items/<id>.png),
// so a new item is one line here and one picture.
import { REPEL_DAYS, STEPS_GOAL, V13_START, V14_START, V16_START, type Tag } from './rules.ts'
import { TYPE_DOMAIN } from './types.ts'

/** seeded randomness: the same seed always gives the same run of numbers */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Whole days from `a` to `b` (b later). */
export const dayGap = (a: string, b: string): number => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000)

// ── the five domains that have a shop ──────────────────────────────────────
export type MarkTag = 'code' | 'fitness' | 'guitar' | 'arbor' | 'sleep'
export const MARK_TAGS: MarkTag[] = ['code', 'fitness', 'guitar', 'arbor', 'sleep']
export const isMarkTag = (t: string): t is MarkTag => (MARK_TAGS as string[]).includes(t)
export interface MarkDef { name: string; icon: string; shard?: string }
export const MARKS: Record<MarkTag, MarkDef> = {
  code: { name: 'Machine Parts', icon: 'machine-part', shard: 'blue-shard' },
  fitness: { name: 'Iron', icon: 'iron', shard: 'red-shard' },
  guitar: { name: 'Tones', icon: 'poke-flute', shard: 'yellow-shard' },
  arbor: { name: 'Sprouts', icon: 'grn-apricorn', shard: 'green-shard' },
  sleep: { name: 'Bells', icon: 'lunar-wing' },
}
export const SHARDS = ['red-shard', 'blue-shard', 'yellow-shard', 'green-shard'] as const
/** Paid once per month-end review. It stands in for any colour when a Mega Stone is forged, and only a review gives it. */
export const COMET_SHARD = 'comet-shard'
export const SHARD_DOMAIN: Record<string, MarkTag> = { 'red-shard': 'fitness', 'blue-shard': 'code', 'yellow-shard': 'guitar', 'green-shard': 'arbor' }
/** Marks a unit-day pays, and the extras for a record and for a song part owned. */
export const MARK_RECORD = 2
export const MARK_OWNED = 3

// ── items ───────────────────────────────────────────────────────────────────
export type ItemKind = 'gear' | 'guard' | 'ball' | 'berry' | 'held' | 'tm' | 'lure' | 'shard' | 'key' | 'unique' | 'egg' | 'chest' | 'theme' | 'incense'
  | 'treasure' | 'fossil' | 'evo' | 'vitamin' | 'battle' | 'field' | 'candy' | 'legend'
export interface ItemDef { name: string; kind: ItemKind; text: string }

const TYPES = ['Bug', 'Dark', 'Dragon', 'Electric', 'Fighting', 'Fire', 'Flying', 'Ghost', 'Grass', 'Ground', 'Ice', 'Normal', 'Poison', 'Psychic', 'Rock', 'Steel', 'Water'] as const
/** The TM types: one per type that has a picture. */
export const TM_TYPES: readonly string[] = TYPES
export const tmId = (type: string): string => `tm-${type.toLowerCase()}`
export const tmType = (id: string): string | null => (id.startsWith('tm-') ? (TYPES.find((t) => tmId(t) === id) ?? null) : null)
/** Most TMs the partner can have equipped. Only the types it can beat a leader with. */
export const TM_SLOTS = 3

export interface BallDef {
  /** HP it takes off the wild Pokemon */
  hp: number
  /** ×2 against a wild Pokemon of one of these types */
  vs?: string[]
  /** this much on the day the wild Pokemon appeared */
  first?: number
  /** plus this much for each day it has waited (up to WAIT_CAP days) */
  wait?: number
  /** this much when the species is already yours */
  owned?: number
  /** the Pokemon it catches starts with this many hearts */
  hearts?: number
}
export const WAIT_CAP = 10
export const BALLS: Record<string, BallDef> = {
  'poke-ball': { hp: 20 },
  'great-ball': { hp: 50 },
  'ultra-ball': { hp: 110 },
  'premier-ball': { hp: 50 },
  'master-ball': { hp: 1_000_000 },
  'repeat-ball': { hp: 30, owned: 75 },
  'quick-ball': { hp: 25, first: 100 },
  'timer-ball': { hp: 15, wait: 15 },
  'heavy-ball': { hp: 40, vs: ['Rock', 'Steel', 'Ground', 'Fighting'] },
  'fast-ball': { hp: 40, vs: ['Electric', 'Flying'] },
  'moon-ball': { hp: 40, vs: ['Fairy', 'Normal'] },
  'net-ball': { hp: 40, vs: ['Water', 'Bug'] },
  'dusk-ball': { hp: 40, vs: ['Dark', 'Ghost'] },
  'luxury-ball': { hp: 50, hearts: 3 },
}
/** What a ball takes off a wild Pokemon: its types, the day it appeared, today, and whether the species is already yours. */
export function throwHp(ball: string, wild: { types: (string | undefined)[]; from: string; owned: boolean }, day: string): number {
  const b = BALLS[ball]
  if (!b) return 0
  let hp = b.hp
  if (b.vs && wild.types.some((t) => t && b.vs!.includes(t))) hp *= 2
  if (b.first && wild.from === day) hp = b.first
  if (b.wait) hp += b.wait * Math.min(WAIT_CAP, Math.max(0, dayGap(wild.from, day)))
  if (b.owned && wild.owned) hp = b.owned
  return hp
}
/** Which of the day's three balls the thrown one counts as, for the Pokemon's record. */
export const ballClass = (ball: string): 'poke' | 'great' | 'ultra' => ((BALLS[ball]?.hp ?? 0) >= 100 ? 'ultra' : (BALLS[ball]?.hp ?? 0) >= 50 ? 'great' : 'poke')

/** Held: one at a time, on the partner. Its domain's work strikes the leader this much harder. `tag` absent = every domain. */
export const HELD: Record<string, { tag?: MarkTag; mult: number }> = {
  'wise-glasses': { tag: 'code', mult: 1.15 }, 'muscle-band': { tag: 'fitness', mult: 1.15 }, 'soothe-bell': { tag: 'guitar', mult: 1.15 },
  'miracle-seed': { tag: 'arbor', mult: 1.15 }, leftovers: { tag: 'sleep', mult: 1.15 },
  'choice-specs': { tag: 'code', mult: 1.3 }, 'choice-band': { tag: 'fitness', mult: 1.3 }, metronome: { tag: 'guitar', mult: 1.3 },
  'big-root': { tag: 'arbor', mult: 1.3 }, 'focus-band': { tag: 'sleep', mult: 1.3 }, 'life-orb': { mult: 1.1 },
}
/** What the held item adds to strikes of this kind of work (0.15, 0.3), and what an item with no domain adds to all of them. Bonuses are added, not multiplied. */
export const heldBonus = (item: string | undefined, tag: Tag): number => {
  const h = item ? HELD[item] : undefined
  return h?.tag && h.tag === tag ? Math.round((h.mult - 1) * 100) / 100 : 0
}
export const heldCommon = (item: string | undefined): number => {
  const h = item ? HELD[item] : undefined
  return h && !h.tag ? Math.round((h.mult - 1) * 100) / 100 : 0
}
/** An incense shows three Pokemon of this domain's types and you pick the next wild one. (Full Incense shows three of any.) */
export const LURES: Record<string, Tag> = { 'odd-incense': 'code', 'rock-incense': 'fitness', 'pure-incense': 'guitar', 'rose-incense': 'arbor', 'lax-incense': 'sleep', 'sea-incense': 'routine' }
export const lureTypes = (tag: Tag): string[] => Object.entries(TYPE_DOMAIN).filter(([, d]) => d === tag).map(([t]) => t)

const tmText = (t: string) => `Equip it on your partner: it counts as a ${t} Pokemon against a leader.`
export const ITEMS: Record<string, ItemDef> = {
  'poke-ball': { name: 'Poké Ball', kind: 'ball', text: 'Throw: 20 HP off the wild Pokemon.' },
  'great-ball': { name: 'Great Ball', kind: 'ball', text: 'Throw: 50 HP.' },
  'ultra-ball': { name: 'Ultra Ball', kind: 'ball', text: 'Throw: 110 HP.' },
  'premier-ball': { name: 'Premier Ball', kind: 'ball', text: 'Throw: 50 HP. A keepsake of a perfect day.' },
  'master-ball': { name: 'Master Ball', kind: 'ball', text: 'Throw: catches anything. One of a kind.' },
  'repeat-ball': { name: 'Repeat Ball', kind: 'ball', text: 'Throw: 75 HP if the species is already yours, 30 if not.' },
  'quick-ball': { name: 'Quick Ball', kind: 'ball', text: 'Throw: 100 HP on the day the wild Pokemon appears, 25 after.' },
  'timer-ball': { name: 'Timer Ball', kind: 'ball', text: 'Throw: 15 HP, and 15 more for every day it has waited (up to ten).' },
  'heavy-ball': { name: 'Heavy Ball', kind: 'ball', text: 'Throw: 40 HP, double against Rock, Steel, Ground, Fighting.' },
  'fast-ball': { name: 'Fast Ball', kind: 'ball', text: 'Throw: 40 HP, double against Electric and Flying.' },
  'moon-ball': { name: 'Moon Ball', kind: 'ball', text: 'Throw: 40 HP, double against Fairy and Normal.' },
  'net-ball': { name: 'Net Ball', kind: 'ball', text: 'Throw: 40 HP, double against Water and Bug.' },
  'dusk-ball': { name: 'Dusk Ball', kind: 'ball', text: 'Throw: 40 HP, double against Dark and Ghost.' },
  'luxury-ball': { name: 'Luxury Ball', kind: 'ball', text: 'Throw: 50 HP. The Pokemon you catch starts with three hearts.' },
  'oran-berry': { name: 'Oran Berry', kind: 'berry', text: 'Feed your partner: one heart.' },
  'sitrus-berry': { name: 'Sitrus Berry', kind: 'berry', text: 'Feed your partner: three hearts.' },
  'wise-glasses': { name: 'Wise Glasses', kind: 'held', text: 'Hold: code work strikes leaders ×1.15.' },
  'muscle-band': { name: 'Muscle Band', kind: 'held', text: 'Hold: gym work strikes leaders ×1.15.' },
  'soothe-bell': { name: 'Soothe Bell', kind: 'held', text: 'Hold: guitar work strikes leaders ×1.15.' },
  'miracle-seed': { name: 'Miracle Seed', kind: 'held', text: 'Hold: Arbor work strikes leaders ×1.15.' },
  leftovers: { name: 'Leftovers', kind: 'held', text: 'Hold: sleep strikes leaders ×1.15.' },
  'choice-specs': { name: 'Choice Specs', kind: 'unique', text: 'Hold: code work strikes leaders ×1.3. Earned, never sold.' },
  'choice-band': { name: 'Choice Band', kind: 'unique', text: 'Hold: gym work strikes leaders ×1.3. Earned, never sold.' },
  metronome: { name: 'Metronome', kind: 'unique', text: 'Hold: guitar work strikes leaders ×1.3. Earned, never sold.' },
  'big-root': { name: 'Big Root', kind: 'unique', text: 'Hold: Arbor work strikes leaders ×1.3. Earned, never sold.' },
  'focus-band': { name: 'Focus Band', kind: 'unique', text: 'Hold: sleep strikes leaders ×1.3. Earned, never sold.' },
  'life-orb': { name: 'Life Orb', kind: 'unique', text: 'Hold: every kind of work strikes leaders ×1.1.' },
  'amulet-coin': { name: 'Amulet Coin', kind: 'unique', text: 'Quest coins ×1.25.' },
  'coin-case': { name: 'Coin Case', kind: 'unique', text: 'The Mart shows four deals a day.' },
  'old-charm': { name: 'Old Charm', kind: 'unique', text: 'A Mystery Egg hatches after 40,000 steps, not 50,000.' },
  'key-stone': { name: 'Key Stone', kind: 'key', text: 'Without it, no Mega Evolution. Forge Mega Stones with shards.' },
  'red-shard': { name: 'Red Shard', kind: 'shard', text: 'Gym. Three forge a Mega X.' },
  'blue-shard': { name: 'Blue Shard', kind: 'shard', text: 'Code. Three forge a Mega Y.' },
  'yellow-shard': { name: 'Yellow Shard', kind: 'shard', text: 'Guitar. Three forge a Mega Y.' },
  'green-shard': { name: 'Green Shard', kind: 'shard', text: 'Arbor. Three forge a Mega with only one form.' },
  'comet-shard': { name: 'Comet Shard', kind: 'shard', text: 'A month reviewed. Fits any Mega: three forge one.' },
  'odd-incense': { name: 'Odd Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three code types (Psychic, Electric, Ghost).' },
  'rock-incense': { name: 'Rock Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three gym types (Fighting, Rock, Ground, Steel, Fire, Dragon).' },
  'pure-incense': { name: 'Pure Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three guitar types (Fairy, Normal, Flying).' },
  'rose-incense': { name: 'Rose Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three Grass types.' },
  'lax-incense': { name: 'Lax Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three Dark types.' },
  'full-incense': { name: 'Full Incense', kind: 'incense', text: 'Pick the next wild Pokemon from three of any type.' },
  'rare-egg': { name: 'Mystery Egg', kind: 'egg', text: 'Hatches into a rare Pokemon once the steps the band counts add up to 50,000 (five full days of walking). It is set to incubate the day you get it; its steps count from the next day.' },
  chest: { name: 'Chest', kind: 'chest', text: 'Open it for coins, balls, berries or, now and then, incense.' },
  'theme-beach': { name: 'Beach', kind: 'theme', text: 'A new place for the battle scene.' },
  'theme-cave': { name: 'Cave', kind: 'theme', text: 'A new place for the battle scene.' },
  'theme-night': { name: 'Starry night', kind: 'theme', text: 'A new place for the battle scene.' },
}
ITEMS['max-repel'] = { name: 'Max Repel', kind: 'guard', text: `Use it on the wild Pokemon: it stays ${REPEL_DAYS} days longer before it flees. Once for each Pokemon.` }
ITEMS['revive'] = { name: 'Revive', kind: 'guard', text: 'Use it on the gym leader: everything they won back while the work stopped is taken off again.' }
ITEMS['sea-incense'] = { name: 'Sea Incense', kind: 'lure', text: 'Pick the next wild Pokemon from three chore types (Water, Ice, Bug, Poison).' }
ITEMS['lucky-egg'] = { name: 'Lucky Egg', kind: 'unique', text: 'Catches made by wearing a wild Pokemon down are shiny one time in 25 instead of 50. Bought once.' }
for (const t of TYPES) ITEMS[tmId(t)] = { name: `TM ${t}`, kind: 'tm', text: tmText(t) }
export const itemName = (id: string): string => ITEMS[id]?.name ?? id

// ── Strong's training gear ──────────────────────────────────────────────────
/** Each routine in Strong's split drops its own piece of gear (the names and pictures are Strong's). A full set pays gems and Iron, and every third set a Red Shard. */
export const GEAR: Record<string, string> = {
  'd1-chest-delts': 'protector', 'd2-lats-biceps': 'silver-wing', 'd3-legs': 'power-anklet', 'd4-delts-triceps': 'power-lens',
  'd5-back-biceps': 'power-bracer', 'd6-chest-flys': 'power-band', 'd7-arms-delts': 'power-weight',
}
export const GEAR_ITEMS: string[] = Object.values(GEAR)
export const GEAR_FOR: Record<string, string> = Object.fromEntries(Object.entries(GEAR).map(([r, i]) => [i, r]))
const GEAR_INFO: Record<string, [string, string]> = {
  protector: ['Protector', 'Upper chest and side delts'], 'silver-wing': ['Silver Wing', 'Lats, rear delts and biceps'], 'power-anklet': ['Power Anklet', 'Legs'],
  'power-lens': ['Power Lens', 'Side delts and triceps'], 'power-bracer': ['Power Bracer', 'Back and biceps'], 'power-band': ['Power Band', 'Chest and flys'], 'power-weight': ['Power Weight', 'Arms and delts'],
}
for (const [id, [name, what]] of Object.entries(GEAR_INFO)) ITEMS[id] = { name, kind: 'gear', text: `Dropped by the ${what} workout in Strong. Every third full set of seven pays a Red Shard.` }

// ── shops ───────────────────────────────────────────────────────────────────
export interface Offer { item: string; coins?: number; gems?: number; marks?: number }
export type ShopId = 'mart' | 'rare' | 'bp' | MarkTag

/** The pool the Mart draws its daily deals from (coins). The chore types (Water, Ice, Bug, Poison) have no domain shop, so their ball and lure are here. */
export const MART_POOL: Offer[] = [
  { item: 'great-ball', coins: 150 }, { item: 'ultra-ball', coins: 380 },
  { item: 'repeat-ball', coins: 250 }, { item: 'net-ball', coins: 200 }, { item: 'oran-berry', coins: 50 }, { item: 'sitrus-berry', coins: 150 },
  { item: 'sea-incense', coins: 220 },
]
/**
 * Always on the Mart's shelf. The two guards (an emergency item that is only sometimes for sale is no use) are what coins are for, and the TMs of the four
 * chore types, which no domain shop sells.
 */
export const STANDING: Offer[] = [
  { item: 'max-repel', coins: 220 }, { item: 'revive', coins: 300 },
  ...['Water', 'Ice', 'Bug', 'Poison'].map((t) => ({ item: tmId(t), coins: 350 })),
]
export const MART_DEALS = 3
/** The Coin Case adds a deal; the Amulet Coin raises quest coins; berries feed this many hearts. Read by the fold and by the item text, so they cannot drift apart. */
export const COIN_CASE_DEALS = 4
export const AMULET_MULT = 1.25
export const BERRY_HEARTS: Record<string, number> = { 'oran-berry': 1, 'sitrus-berry': 3 }
export const dealsFor = (inv: Record<string, number>): number => (inv['coin-case'] ? COIN_CASE_DEALS : MART_DEALS)
/** The day's deals: the same three on every device, and one of each can be bought. */
export function martDeals(day: string, n: number = MART_DEALS): Offer[] {
  const r = rng(`mart:${day}`)
  const pool = [...MART_POOL]
  const out: Offer[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}

/** The rare shelf (gems). Themes and the Lucky Egg are bought once. */
export const RARE_SHELF: Offer[] = [
  { item: 'full-incense', gems: 40 }, { item: 'chest', gems: 30 }, { item: 'rare-egg', gems: 150 },
  { item: 'theme-beach', gems: 60 }, { item: 'theme-cave', gems: 60 }, { item: 'theme-night', gems: 60 },
  { item: 'lucky-egg', gems: 500 },
]
/** Bought once, kept for good. */
export const ONCE = new Set<string>([...TYPES.map(tmId), 'theme-beach', 'theme-cave', 'theme-night', 'lucky-egg', ...Object.keys(HELD).filter((h) => HELD[h].mult < 1.2)])

export interface DomainShop { name: string; place: string; stock: Offer[] }
/** A domain's TMs: the types that domain owns (see TYPE_DOMAIN). Nine marks for the rarer types, six for the rest. */
const tms = (...types: string[]): Offer[] => types.map((t) => ({ item: tmId(t), marks: ['Psychic', 'Ghost', 'Dark', 'Steel', 'Dragon'].includes(t) ? 9 : 6 }))
export const DOMAIN_SHOPS: Record<MarkTag, DomainShop> = {
  code: {
    name: 'Silph Co.', place: 'the tower on the hill',
    stock: [{ item: 'quick-ball', marks: 6 }, { item: 'timer-ball', marks: 6 }, { item: 'odd-incense', marks: 3 }, { item: 'wise-glasses', marks: 12 }, ...tms('Psychic', 'Electric', 'Ghost')],
  },
  fitness: {
    name: 'The Dojo', place: 'the mine on the west shore',
    stock: [{ item: 'heavy-ball', marks: 6 }, { item: 'fast-ball', marks: 6 }, { item: 'rock-incense', marks: 3 }, { item: 'muscle-band', marks: 12 }, ...tms('Fighting', 'Rock', 'Ground', 'Steel', 'Fire', 'Dragon')],
  },
  guitar: {
    name: 'Music Hall', place: 'the purple house',
    stock: [{ item: 'luxury-ball', marks: 8 }, { item: 'moon-ball', marks: 6 }, { item: 'pure-incense', marks: 3 }, { item: 'soothe-bell', marks: 12 }, ...tms('Normal', 'Flying')],
  },
  arbor: {
    name: 'The Garden', place: 'the terraces in the north-west',
    stock: [{ item: 'rose-incense', marks: 3 }, { item: 'miracle-seed', marks: 12 }, { item: 'sitrus-berry', marks: 3 }, ...tms('Grass')],
  },
  sleep: {
    name: 'Dream House', place: 'the big house on the east shore',
    stock: [{ item: 'dusk-ball', marks: 6 }, { item: 'lax-incense', marks: 3 }, { item: 'leftovers', marks: 12 }, ...tms('Dark')],
  },
}
/** Where an item can be bought, searched in this order when the shop is not named. */
/**
 * Prices before berries were priced by hearts (22 Oct 2026, mid-day). That change was not dated, so purchases
 * made earlier that day stopped adding up when the game was refolded, and were lost. A purchase replays at the
 * price it was made at: before PRICED_BY_HEARTS the old prices hold.
 */
export const PRICED_BY_HEARTS = '2026-10-23'
const PRICE_BEFORE: Record<string, Partial<Offer>> = {
  'sitrus-berry': { coins: 130 }, 'tamato-berry': { coins: 160 },
  'pomeg-berry': { marks: 2 }, 'kelpsy-berry': { marks: 2 }, 'qualot-berry': { marks: 2 }, 'hondew-berry': { marks: 2 }, 'grepa-berry': { marks: 2 },
}
const priceOn = (o: Offer, day: string): Offer => {
  const old = day < PRICED_BY_HEARTS ? PRICE_BEFORE[o.item] : undefined
  // the same currency only: a Sitrus Berry at the Garden was always paid in marks
  if (old?.coins !== undefined && o.coins !== undefined) return { ...o, coins: old.coins }
  if (old?.marks !== undefined && o.marks !== undefined) return { ...o, marks: old.marks }
  return o
}
export function offerFor(shop: ShopId | undefined, item: string, day: string, deals: number): { shop: ShopId; offer: Offer } | null {
  const find = (s: ShopId): Offer | undefined =>
    s === 'mart' ? [...martDeals(day, deals), ...STANDING, ...battleShelf(day)].find((o) => o.item === item)
      : s === 'rare' ? [...RARE_SHELF, ...(day >= V13_START ? RARE_SHELF_V13 : [])].find((o) => o.item === item)
        : s === 'bp' ? (day >= V13_START ? BP_SHELF.find((o) => o.item === item) : undefined)
          : [...DOMAIN_SHOPS[s].stock, ...(day >= V13_START ? DOMAIN_V13[s] : [])].find((o) => o.item === item)
  const order: ShopId[] = shop ? [shop] : ['mart', 'rare', ...MARK_TAGS, 'bp']
  for (const s of order) { const offer = find(s); if (offer) return { shop: s, offer: priceOn(offer, day) } }
  return null
}

// ── what a domain's marks keep paying for ───────────────────────────────────
/** Spend marks to raise a domain's level: that domain's work strikes a leader this much harder per level. The next level costs MASTERY_COST × (level + 1). */
export const MASTERY_MAX = 10
export const MASTERY_STEP = 0.03
export const masteryCost = (level: number): number => 4 * (level + 1)
/** A bond level (10, 30 and 60 hearts) makes every strike this much harder. */
export const BOND_STEP = 0.05
/** A fully trained Pokemon in the party keeps its hearts: each of its bond levels adds this to the party bonus, on top of TEAM_BONUS. */
export const BOND_PARTY = 0.01

// ── the Professor, the Smithy ──────────────────────────────────────────────
/** What a Box Pokemon is worth to the Professor, by rarity. */
export const SELL: Record<string, number> = { C: 30, U: 80, R: 200, L: 500 }
/** Shards a Mega Stone costs. */
export const FORGE_COST = 3
/** Which shard forges form `index` of `count`: X takes red, Y takes blue then yellow, a lone form takes the partner's own colour, then any. */
export function forgeShard(count: number, index: number, own: Tag | undefined, inv: Record<string, number>): string | null {
  const has = (s: string) => (inv[s] ?? 0) >= FORGE_COST
  const order: string[] = count > 1 ? (index === 0 ? ['red-shard'] : ['blue-shard', 'yellow-shard']) : [...(own && isMarkTag(own) && MARKS[own].shard ? [MARKS[own].shard!] : []), ...SHARDS]
  return order.find(has) ?? (has(COMET_SHARD) ? COMET_SHARD : null)
}

// ── quests, the season and chests ───────────────────────────────────────────
export interface QuestDef { id: string; name: string; coins?: number; gems?: number }
/** Only the week has quests. The day's own reward is its pay (DAILY_PAY in rules.ts), and a perfect day pays gems by itself. */
export const WEEKLY_QUESTS: QuestDef[] = [
  { id: 'five-days', name: '5 days with two pillars', coins: 100, gems: 10 },
  { id: 'catch', name: 'Catch a Pokemon', gems: 10 },
]
export interface SeasonReward { coins?: number; gems?: number; item?: string }
export const SEASON_REWARDS: SeasonReward[] = [{ coins: 100 }, { item: 'great-ball' }, { gems: 10 }, { item: 'oran-berry' }, { coins: 200 }, { item: 'ultra-ball' }, { gems: 25 }]
export const seasonReward = (step: number): SeasonReward => SEASON_REWARDS[(step - 1) % SEASON_REWARDS.length]
/** What a chest holds, with the odds out of 100. */
export const CHEST: { odds: number; coins?: number; item?: string; n?: number }[] = [
  { odds: 40, coins: 250 }, { odds: 25, item: 'great-ball', n: 2 }, { odds: 15, item: 'ultra-ball', n: 1 }, { odds: 12, item: 'sitrus-berry', n: 2 }, { odds: 8, item: 'full-incense', n: 1 },
]
export const EGG_DAYS_OLD_CHARM = 4
export const EGG_STEPS_OLD_CHARM = EGG_DAYS_OLD_CHARM * STEPS_GOAL

// ── feats ──────────────────────────────────────────────────────────────────
export interface Reward { coins?: number; gems?: number; items?: Record<string, number> }
export interface Feat { id: string; name: string; text: string; group: 'run' | 'total' | 'perfect' | 'collect' | 'raise' | 'league'; key: string; n: number; reward: Reward; tag?: MarkTag }

const DOMAIN_WORD: Record<MarkTag, { run: string; unit: string }> = {
  code: { run: 'Code', unit: 'coding days' }, fitness: { run: 'Gym', unit: 'gym days' }, guitar: { run: 'Guitar', unit: 'guitar days' },
  arbor: { run: 'Arbor', unit: 'Arbor mornings' }, sleep: { run: 'Sleep', unit: 'good nights' },
}
export const UNIQUE_HELD: Record<MarkTag, string> = { code: 'choice-specs', fitness: 'choice-band', guitar: 'metronome', arbor: 'big-root', sleep: 'focus-band' }
const shardOf = (t: MarkTag, n = 1): Record<string, number> => (MARKS[t].shard ? { [MARKS[t].shard!]: n } : {})

function domainFeats(): Feat[] {
  const out: Feat[] = []
  for (const tag of MARK_TAGS) {
    const w = DOMAIN_WORD[tag]
    // the gym's red shards come from Strong's training kit as well, so its 100 days pay gems only.
    // A run of seven pays gems, not a shard (version 11): it comes in the first fortnight, months before anything can Mega.
    const hundred = tag === 'fitness' ? {} : shardOf(tag)
    out.push(
      { id: `run7-${tag}`, name: `${w.run}, seven running`, text: `${w.unit} on seven days running (one rest day is forgiven)`, group: 'run', key: `run:${tag}`, n: 7, reward: { gems: 15 }, tag },
      { id: `run30-${tag}`, name: `${w.run}, a month running`, text: `${w.unit} for thirty days running`, group: 'run', key: `run:${tag}`, n: 30, reward: { gems: 25, items: { ...shardOf(tag), [UNIQUE_HELD[tag]]: 1 } }, tag },
      { id: `days100-${tag}`, name: `${w.run}, 100 days`, text: `${w.unit}, 100 in all`, group: 'total', key: `days:${tag}`, n: 100, reward: { gems: 30, items: hundred }, tag },
    )
    if (tag !== 'sleep') out.push(
      { id: `run100-${tag}`, name: `${w.run}, a hundred running`, text: `${w.unit} for a hundred days running`, group: 'run', key: `run:${tag}`, n: 100, reward: { gems: 60, items: shardOf(tag, 2) }, tag },
    )
  }
  return out
}
export const FEATS: Feat[] = [
  { id: 'work7', name: 'A week running', text: 'Any one kind of work on seven days running (one rest day is forgiven)', group: 'run', key: 'run:any', n: 7, reward: { gems: 10, items: { 'key-stone': 1 } } },
  { id: 'work14', name: 'A fortnight', text: 'Three pillars a day for fourteen days running (one rest day is forgiven)', group: 'run', key: 'run:work3', n: 14, reward: { gems: 15, items: { 'amulet-coin': 1 } } },
  { id: 'work30', name: 'A month of it', text: 'Three pillars a day for thirty days running', group: 'run', key: 'run:work3', n: 30, reward: { gems: 40, items: { 'master-ball': 1 } } },
  ...domainFeats(),
  { id: 'walk30', name: 'Thirty long walks', text: 'Thirty days of 10,000 steps', group: 'total', key: 'walk', n: 30, reward: { gems: 25 } },
  { id: 'walk100', name: 'A hundred long walks', text: 'A hundred days of 10,000 steps', group: 'total', key: 'walk', n: 100, reward: { gems: 70 } },
  { id: 'deep10', name: 'Ten deep nights', text: 'Ten nights with 90 minutes of deep sleep', group: 'total', key: 'deep', n: 10, reward: { gems: 15 } },
  { id: 'deep50', name: 'Fifty deep nights', text: 'Fifty nights with 90 minutes of deep sleep', group: 'total', key: 'deep', n: 50, reward: { gems: 50 } },
  { id: 'workouts10', name: 'Ten workouts', text: 'Ten workouts logged in Strong', group: 'total', key: 'workouts', n: 10, reward: { gems: 15 } },
  { id: 'workouts50', name: 'Fifty workouts', text: 'Fifty workouts logged in Strong', group: 'total', key: 'workouts', n: 50, reward: { gems: 40 } },
  { id: 'records1', name: 'A record', text: 'Your first personal record', group: 'total', key: 'records', n: 1, reward: { gems: 10 } },
  { id: 'records5', name: 'Five records', text: 'Five personal records', group: 'total', key: 'records', n: 5, reward: { gems: 25 } },
  { id: 'records25', name: 'Record breaker', text: 'Twenty-five personal records', group: 'total', key: 'records', n: 25, reward: { gems: 80 } },
  { id: 'owned1', name: 'A part owned', text: 'Your first song part owned in Woodshed', group: 'total', key: 'owned', n: 1, reward: { gems: 10 } },
  { id: 'owned5', name: 'Five parts owned', text: 'Five song parts owned', group: 'total', key: 'owned', n: 5, reward: { gems: 25 } },
  { id: 'owned17', name: 'The whole course', text: 'Every song part owned', group: 'total', key: 'owned', n: 17, reward: { gems: 80 } },
  { id: 'perfect1', name: 'Nothing left', text: 'Your first perfect day', group: 'perfect', key: 'perfect', n: 1, reward: { gems: 5, items: { 'premier-ball': 1 } } },
  { id: 'perfect10', name: 'Ten perfect days', text: 'Ten perfect days', group: 'perfect', key: 'perfect', n: 10, reward: { gems: 20 } },
  { id: 'perfect25', name: 'Twenty-five perfect days', text: 'Twenty-five perfect days', group: 'perfect', key: 'perfect', n: 25, reward: { gems: 40, items: { 'great-ball': 3 } } },
  { id: 'perfect50', name: 'Fifty perfect days', text: 'Fifty perfect days', group: 'perfect', key: 'perfect', n: 50, reward: { gems: 60, items: { 'life-orb': 1 } } },
  { id: 'dex10', name: 'Ten of them', text: 'Ten Pokemon in the Pokedex as yours', group: 'collect', key: 'dex', n: 10, reward: { gems: 10 } },
  { id: 'dex25', name: 'Twenty-five', text: 'Twenty-five Pokemon yours', group: 'collect', key: 'dex', n: 25, reward: { gems: 20, items: { 'coin-case': 1 } } },
  { id: 'dex50', name: 'Fifty', text: 'Fifty Pokemon yours', group: 'collect', key: 'dex', n: 50, reward: { gems: 30 } },
  { id: 'dex100', name: 'A hundred', text: 'A hundred Pokemon yours', group: 'collect', key: 'dex', n: 100, reward: { gems: 60 } },
  { id: 'shiny1', name: 'Something shiny', text: 'Catch a shiny Pokemon', group: 'collect', key: 'shiny', n: 1, reward: { gems: 30 } },
  { id: 'legend1', name: 'A legend', text: 'Catch a legendary Pokemon', group: 'collect', key: 'legend', n: 1, reward: { gems: 40 } },
  { id: 'mega1', name: 'Mega', text: 'Forge your first Mega Stone', group: 'collect', key: 'megas', n: 1, reward: { gems: 25 } },
  { id: 'grads1', name: 'First one trained', text: 'Fully train a Pokemon', group: 'raise', key: 'grads', n: 1, reward: { gems: 10 } },
  { id: 'grads3', name: 'Three trained', text: 'Fully train three Pokemon', group: 'raise', key: 'grads', n: 3, reward: { gems: 20 } },
  { id: 'grads5', name: 'Five trained', text: 'Fully train five Pokemon', group: 'raise', key: 'grads', n: 5, reward: { gems: 30 } },
  { id: 'grads10', name: 'Ten trained', text: 'Fully train ten Pokemon', group: 'raise', key: 'grads', n: 10, reward: { gems: 50 } },
  { id: 'hearts30', name: 'Close', text: 'A partner reaches thirty hearts', group: 'raise', key: 'hearts', n: 30, reward: { gems: 15, items: { 'luxury-ball': 2 } } },
  { id: 'hatch1', name: 'It hatched', text: 'Hatch a Mystery Egg', group: 'raise', key: 'hatched', n: 1, reward: { gems: 10, items: { 'old-charm': 1 } } },
  { id: 'chests5', name: 'Five chests', text: 'Open five chests', group: 'raise', key: 'chests', n: 5, reward: { gems: 20 } },
  { id: 'badge1', name: 'First badge', text: 'Win a gym badge', group: 'league', key: 'badges', n: 1, reward: { items: { 'oran-berry': 3 } } },
  { id: 'badge8', name: 'Eight badges', text: 'Win eight gym badges', group: 'league', key: 'badges', n: 8, reward: { gems: 40 } },
]
export const featById = (id: string): Feat | undefined => FEATS.find((f) => f.id === id)

// ══ version 13: Champion's Road (RULES-V13.md) ══════════════════════════════
// Everything here is sold, found or used only from V13_START.

// ── hearts: berries and treats that feed the bond ──
/** The six friendship berries: five hearts each, one per domain (Tamato is the chores' own, sold in the Mart). */
export const FRIEND_BERRY: Record<string, Tag> = { 'hondew-berry': 'code', 'kelpsy-berry': 'fitness', 'grepa-berry': 'guitar', 'qualot-berry': 'arbor', 'pomeg-berry': 'sleep', 'tamato-berry': 'routine' }
for (const id of Object.keys(FRIEND_BERRY)) BERRY_HEARTS[id] = 5
BERRY_HEARTS['sweet-heart'] = 3
BERRY_HEARTS['heart-scale'] = 2
const DOMAIN_NAME: Record<Tag, string> = { code: 'code', fitness: 'gym', guitar: 'guitar', arbor: 'Arbor', sleep: 'sleep', routine: 'chores' }
for (const [id, tag] of Object.entries(FRIEND_BERRY)) {
  const name = id.split('-')[0]
  ITEMS[id] = { name: `${name[0].toUpperCase()}${name.slice(1)} Berry`, kind: 'berry', text: `Feed your partner: five hearts. The ${DOMAIN_NAME[tag]} berry.` }
}
ITEMS['sweet-heart'] = { name: 'Sweet Heart', kind: 'berry', text: 'A chocolate heart. Feed your partner: three hearts.' }
ITEMS['heart-scale'] = { name: 'Heart Scale', kind: 'berry', text: 'A pretty scale found by Pickup. Give it to your partner: two hearts.' }

// ── vitamins: a Pokemon's own strength on one kind of work, for good ──
/** Each vitamin makes the work of its domain strike 3% harder for the Pokemon it is given to; ten at most of one kind. */
export const VITAMINS: Record<string, MarkTag> = { calcium: 'code', protein: 'fitness', zinc: 'guitar', carbos: 'arbor', 'hp-up': 'sleep' }
export const VITAMIN_STEP = 0.03
export const VITAMIN_MAX = 10
const VIT_NAME: Record<string, string> = { calcium: 'Calcium', protein: 'Protein', zinc: 'Zinc', carbos: 'Carbos', 'hp-up': 'HP Up' }
for (const [id, tag] of Object.entries(VITAMINS)) ITEMS[id] = { name: VIT_NAME[id], kind: 'vitamin', text: `Give it to a Pokemon: its ${DOMAIN_NAME[tag]} work strikes 3% harder, for good (ten at most).` }

// ── battle items: one day's boost against the leader ──
/** X items: one domain's strike today. The x6 strength is only sold at the Battle Frontier. */
export const BOOST: Record<string, { tag: Tag; add: number }> = {}
const X_BASE: [string, Tag, string][] = [['x-special', 'code', 'X Sp. Atk'], ['x-attack', 'fitness', 'X Attack'], ['x-sp-def', 'guitar', 'X Sp. Def'], ['x-defend', 'arbor', 'X Defend'], ['x-speed', 'routine', 'X Speed'], ['x-accuracy', 'sleep', 'X Accuracy']]
const X_TIERS: [string, number, string][] = [['', 0.2, ''], ['-2', 0.4, ' 2'], ['-3', 0.6, ' 3'], ['-6', 1.2, ' 6']]
for (const [base, tag, name] of X_BASE) for (const [suffix, add, tname] of X_TIERS) {
  BOOST[base + suffix] = { tag, add }
  ITEMS[base + suffix] = { name: name + tname, kind: 'battle', text: `Use it before the day's work: today, ${DOMAIN_NAME[tag]} strikes the leader +${Math.round(add * 100)}%. The strongest one used today counts.` }
}
/** Dire Hit raises today's chance of a critical hit (it needs bond level 3 to mean anything, or a Scope Lens). */
export const DIRE_HIT: Record<string, number> = { 'dire-hit': 0.1, 'dire-hit-2': 0.2, 'dire-hit-3': 0.3 }
for (const [id, add] of Object.entries(DIRE_HIT)) ITEMS[id] = { name: `Dire Hit${id.endsWith('2') ? ' 2' : id.endsWith('3') ? ' 3' : ''}`, kind: 'battle', text: `Use it before the day's work: today's chance of a critical hit +${Math.round(add * 100)}%.` }
ITEMS['guard-spec'] = { name: 'Guard Spec.', kind: 'battle', text: 'Use it to stand guard: the next empty day costs nothing.' }
ITEMS['honey'] = { name: 'Honey', kind: 'field', text: 'Spread it: the next wild Pokemon to come is a rare one.' }
ITEMS['rare-candy'] = { name: 'Rare Candy', kind: 'candy', text: 'Give it to a Pokemon in My Pokemon: one level up.' }

// ── evolution items: one stage for a Pokemon that is not the partner ──
/** An item evolves a Pokemon in My Pokemon by one stage when the form it would become has one of these types. */
export const EVO_ITEMS: Record<string, { name: string; types: string[] }> = {
  'fire-stone': { name: 'Fire Stone', types: ['Fire'] },
  'water-stone': { name: 'Water Stone', types: ['Water'] },
  thunderstone: { name: 'Thunder Stone', types: ['Electric'] },
  'leaf-stone': { name: 'Leaf Stone', types: ['Grass'] },
  'ice-stone': { name: 'Ice Stone', types: ['Ice'] },
  'moon-stone': { name: 'Moon Stone', types: ['Fairy', 'Normal', 'Poison'] },
  'sun-stone': { name: 'Sun Stone', types: ['Grass', 'Fire', 'Bug'] },
  'shiny-stone': { name: 'Shiny Stone', types: ['Fairy', 'Steel'] },
  'dusk-stone': { name: 'Dusk Stone', types: ['Dark', 'Ghost'] },
  'dawn-stone': { name: 'Dawn Stone', types: ['Psychic', 'Ice', 'Fighting'] },
  'oval-stone': { name: 'Oval Stone', types: ['Normal'] },
  'dragon-scale': { name: 'Dragon Scale', types: ['Dragon'] },
  'metal-coat': { name: 'Metal Coat', types: ['Steel', 'Bug'] },
  'kings-rock': { name: 'King’s Rock', types: ['Water', 'Psychic'] },
  'up-grade': { name: 'Up-Grade', types: ['Normal', 'Electric'] },
  'dubious-disc': { name: 'Dubious Disc', types: ['Normal', 'Psychic'] },
  'reaper-cloth': { name: 'Reaper Cloth', types: ['Ghost'] },
  'razor-claw': { name: 'Razor Claw', types: ['Dark', 'Fighting'] },
  'razor-fang': { name: 'Razor Fang', types: ['Ground', 'Flying'] },
  electirizer: { name: 'Electirizer', types: ['Electric'] },
  magmarizer: { name: 'Magmarizer', types: ['Fire'] },
  'prism-scale': { name: 'Prism Scale', types: ['Water', 'Dragon'] },
  deepseatooth: { name: 'DeepSeaTooth', types: ['Water', 'Dark'] },
  deepseascale: { name: 'DeepSeaScale', types: ['Water', 'Psychic'] },
  'sharp-beak': { name: 'Sharp Beak', types: ['Flying'] },
  'hard-stone': { name: 'Hard Stone', types: ['Rock', 'Ground'] },
}
const orList = (xs: string[]): string => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs[0])
for (const [id, e] of Object.entries(EVO_ITEMS)) ITEMS[id] = { name: e.name, kind: 'evo', text: `Evolves a Pokemon in My Pokemon by one stage, if the form it becomes is ${orList(e.types)}.` }

// ── fossils: the Lab brings them back ──
export const FOSSILS: Record<string, { name: string; species: string }> = {
  'helix-fossil': { name: 'Helix Fossil', species: 'omanyte' }, 'dome-fossil': { name: 'Dome Fossil', species: 'kabuto' }, 'old-amber': { name: 'Old Amber', species: 'aerodactyl' },
  'root-fossil': { name: 'Root Fossil', species: 'lileep' }, 'claw-fossil': { name: 'Claw Fossil', species: 'anorith' }, 'skull-fossil': { name: 'Skull Fossil', species: 'cranidos' },
  'armor-fossil': { name: 'Armor Fossil', species: 'shieldon' }, 'cover-fossil': { name: 'Cover Fossil', species: 'tirtouga' }, 'plume-fossil': { name: 'Plume Fossil', species: 'archen' },
}
/** Coins the Lab asks to bring a fossil back. */
export const REVIVE_COST = 150
for (const [id, f] of Object.entries(FOSSILS)) ITEMS[id] = { name: f.name, kind: 'fossil', text: `The Lab in the Shop brings it back to life for ${REVIVE_COST} coins.` }

// ── treasures: the Collector buys them ──
/** What the Collector pays, in coins. */
export const TREASURE: Record<string, [string, number]> = {
  tinymushroom: ['Tiny Mushroom', 25], pearl: ['Pearl', 60], stardust: ['Stardust', 60], 'shoal-salt': ['Shoal Salt', 40], 'shoal-shell': ['Shoal Shell', 40],
  'big-mushroom': ['Big Mushroom', 150], 'big-pearl': ['Big Pearl', 250], 'star-piece': ['Star Piece', 400], nugget: ['Nugget', 500], 'rare-bone': ['Rare Bone', 600],
  'pearl-string': ['Pearl String', 900], balmmushroom: ['Balm Mushroom', 1000], 'big-nugget': ['Big Nugget', 1500], 'relic-copper': ['Relic Copper', 300], 'relic-silver': ['Relic Silver', 800],
  'relic-gold': ['Relic Gold', 2000], 'relic-vase': ['Relic Vase', 2500], 'relic-band': ['Relic Band', 3000], 'relic-statue': ['Relic Statue', 4000], 'relic-crown': ['Relic Crown', 6000],
  ruby: ['Ruby', 1200], sapphire: ['Sapphire', 1200],
}
for (const [id, [name, coins]] of Object.entries(TREASURE)) ITEMS[id] = { name, kind: 'treasure', text: `A treasure. The Collector in the Shop pays ${coins.toLocaleString('en-IN')} coins for it.` }

// ── held items from the Battle Frontier (each has an effect of its own, read by the fold) ──
export const SPECIAL_HELD: Record<string, string> = {
  'expert-belt': 'Hold: every strike +20% against a leader your partner’s type beats.',
  'focus-sash': 'Hold: an empty day never costs anything while it is held.',
  'rocky-helmet': 'Hold: the weekly boss is struck 20% harder.',
  'scope-lens': 'Hold: +10% chance of a critical hit, even before bond level 3.',
  'quick-claw': 'Hold: the day wears the wild Pokemon down 25% faster.',
  'shell-bell': 'Hold: a pillar day as partner gives two hearts, not one.',
  'wide-lens': 'Hold: thrown balls take 25% more HP off the wild Pokemon.',
  'zoom-lens': 'Hold: +5% to every ball thrown at a boss.',
  'exp-share': 'Hold: the one next up in My Pokemon gets 20% of the partner’s daily XP.',
  everstone: 'Hold: the partner keeps its form. It goes on levelling, and evolves the day you take it off.',
  'lucky-punch': 'Hold: Pickup finds twice as often.',
}
const SPECIAL_NAME: Record<string, string> = { 'expert-belt': 'Expert Belt', 'focus-sash': 'Focus Sash', 'rocky-helmet': 'Rocky Helmet', 'scope-lens': 'Scope Lens', 'quick-claw': 'Quick Claw', 'shell-bell': 'Shell Bell', 'wide-lens': 'Wide Lens', 'zoom-lens': 'Zoom Lens', 'exp-share': 'Exp. Share', everstone: 'Everstone', 'lucky-punch': 'Lucky Punch' }
for (const [id, text] of Object.entries(SPECIAL_HELD)) { HELD[id] = { mult: 1 }; ITEMS[id] = { name: SPECIAL_NAME[id], kind: 'held', text }; ONCE.add(id) }

// ── Type Plates: what the Elite Four and the Champions hand over ──
/** Sixteen plates, one per type but Normal. A win over an Elite Four member or a Champion (never a gym) drops one at random that you do not have yet, once for each. Held, one at a time like any held item: a leader of its type takes PLATE_BONUS more from every strike, so the plate you carry is a choice made leader by leader. */
export const PLATES: Record<string, { name: string; type: string }> = {
  'draco-plate': { name: 'Draco Plate', type: 'Dragon' }, 'dread-plate': { name: 'Dread Plate', type: 'Dark' }, 'earth-plate': { name: 'Earth Plate', type: 'Ground' },
  'fist-plate': { name: 'Fist Plate', type: 'Fighting' }, 'flame-plate': { name: 'Flame Plate', type: 'Fire' }, 'icicle-plate': { name: 'Icicle Plate', type: 'Ice' },
  'insect-plate': { name: 'Insect Plate', type: 'Bug' }, 'iron-plate': { name: 'Iron Plate', type: 'Steel' }, 'meadow-plate': { name: 'Meadow Plate', type: 'Grass' },
  'mind-plate': { name: 'Mind Plate', type: 'Psychic' }, 'sky-plate': { name: 'Sky Plate', type: 'Flying' }, 'splash-plate': { name: 'Splash Plate', type: 'Water' },
  'spooky-plate': { name: 'Spooky Plate', type: 'Ghost' }, 'stone-plate': { name: 'Stone Plate', type: 'Rock' }, 'toxic-plate': { name: 'Toxic Plate', type: 'Poison' },
  'zap-plate': { name: 'Zap Plate', type: 'Electric' },
}
export const PLATE_BONUS = 0.35
for (const [id, p] of Object.entries(PLATES)) { HELD[id] = { mult: 1 }; ITEMS[id] = { name: p.name, kind: 'held', text: `Hold: every strike +${Math.round(PLATE_BONUS * 100)}% against a ${p.type} leader. Dropped by the Elite Four and the Champions, never sold.` }; ONCE.add(id) }
/** The plate a win drops: random, the same on every device, and never one already got. Null once all sixteen are yours. */
export const plateFor = (seed: string, got: ReadonlySet<string>): string | null => {
  const left = Object.keys(PLATES).filter((id) => !got.has(id))
  return left.length ? left[Math.floor(rng(`plate:${seed}`)() * left.length)] : null
}

// ── Legend keys: each one summons a legendary as the next wild Pokemon ──
export const LEGEND_KEYS: Record<string, { name: string; forms: string[] }> = {
  'red-orb': { name: 'Red Orb', forms: ['groudon'] }, 'blue-orb': { name: 'Blue Orb', forms: ['kyogre'] }, 'jade-orb': { name: 'Jade Orb', forms: ['rayquaza'] },
  'adamant-orb': { name: 'Adamant Orb', forms: ['dialga'] }, 'lustrous-orb': { name: 'Lustrous Orb', forms: ['palkia'] }, 'griseous-orb': { name: 'Griseous Orb', forms: ['giratina'] },
  'soul-dew': { name: 'Soul Dew', forms: ['latios'] }, 'eon-ticket': { name: 'Eon Ticket', forms: ['latias'] }, 'rainbow-wing': { name: 'Rainbow Wing', forms: ['hooh'] },
  'tidal-bell': { name: 'Tidal Bell', forms: ['lugia'] }, 'clear-bell': { name: 'Clear Bell', forms: ['suicune'] }, auroraticket: { name: 'AuroraTicket', forms: ['raikou', 'entei'] },
  gracidea: { name: 'Gracidea', forms: ['shaymin'] }, meteorite: { name: 'Meteorite', forms: ['deoxys'] }, 'azure-flute': { name: 'Azure Flute', forms: ['arceus'] },
  'old-sea-map': { name: 'Old Sea Map', forms: ['mew'] }, 'member-card': { name: 'Member Card', forms: ['darkrai'] }, 'magma-stone': { name: 'Magma Stone', forms: ['heatran'] },
  'liberty-pass': { name: 'Liberty Pass', forms: ['victini'] }, mysticticket: { name: 'MysticTicket', forms: ['mewtwo'] }, 'lock-capsule': { name: 'Lock Capsule', forms: ['jirachi'] },
  'red-chain': { name: 'Red Chain', forms: ['regigigas'] }, 'god-stone': { name: 'God Stone', forms: ['regirock', 'regice', 'registeel'] }, 'secret-key': { name: 'Secret Key', forms: ['articuno', 'zapdos', 'moltres'] },
  // Unova's own: the Dark Stone and the Light Stone hold Zekrom and Reshiram (the DNA and Therian pictures in the sheet are Pokemon, not items)
  'dark-stone': { name: 'Dark Stone', forms: ['zekrom'] }, 'light-stone': { name: 'Light Stone', forms: ['reshiram'] },
}
for (const [id, k] of Object.entries(LEGEND_KEYS)) ITEMS[id] = { name: k.name, kind: 'legend', text: `A Legend key. Use it and ${k.forms.length > 1 ? `one of ${k.forms.length} legends` : 'a legend'} comes as the next wild Pokemon, to be caught by your work.` }
/** Which legend a key brings this time: the same answer on every device. */
export const legendFor = (key: string, n: number): string | null => {
  const k = LEGEND_KEYS[key]
  return k ? k.forms[Math.floor(rng(`legend:${key}:${n}`)() * k.forms.length)] : null
}
/** The Legend key a Rematch Champion hands over: they come round in this order. */
export const REMATCH_KEYS = ['red-orb', 'blue-orb', 'jade-orb', 'adamant-orb', 'lustrous-orb', 'griseous-orb', 'azure-flute', 'secret-key', 'god-stone', 'dark-stone', 'light-stone', 'mysticticket']

// ── Pickup: what the partner finds ──
/** [item, weight, from tier]. The tier is how far you are: one for each two leagues, one for each Rematch rank, three at most. */
export const PICKUP: [string, number, number][] = [
  ['oran-berry', 14, 0], ['great-ball', 10, 0], ['tinymushroom', 12, 0], ['pearl', 10, 0], ['stardust', 9, 0], ['honey', 5, 0], ['heart-scale', 6, 0],
  ['tamato-berry', 3, 0], ['hondew-berry', 3, 0], ['kelpsy-berry', 3, 0], ['grepa-berry', 3, 0], ['qualot-berry', 3, 0], ['pomeg-berry', 3, 0],
  ['shoal-salt', 4, 0], ['shoal-shell', 4, 0], ['rare-candy', 3, 0], ['oval-stone', 2, 0], ['moon-stone', 2, 0],
  ['helix-fossil', 1, 0], ['dome-fossil', 1, 0], ['old-amber', 1, 0],
  ['sitrus-berry', 8, 1], ['ultra-ball', 6, 1], ['big-mushroom', 6, 1], ['big-pearl', 5, 1], ['star-piece', 4, 1], ['fire-stone', 2, 1], ['water-stone', 2, 1], ['thunderstone', 2, 1], ['leaf-stone', 2, 1],
  ['root-fossil', 1, 1], ['claw-fossil', 1, 1], ['x-attack', 2, 1], ['x-special', 2, 1], ['dire-hit', 2, 1],
  ['nugget', 5, 2], ['rare-bone', 3, 2], ['relic-copper', 3, 2], ['sun-stone', 2, 2], ['dusk-stone', 2, 2], ['dawn-stone', 2, 2], ['shiny-stone', 2, 2], ['ice-stone', 2, 2],
  ['skull-fossil', 1, 2], ['armor-fossil', 1, 2], ['dragon-scale', 1, 2], ['metal-coat', 1, 2], ['kings-rock', 1, 2], ['up-grade', 1, 2], ['sweet-heart', 3, 2], ['pearl-string', 2, 2],
  ['big-nugget', 2, 3], ['relic-silver', 2, 3], ['relic-gold', 1, 3], ['relic-vase', 1, 3], ['relic-band', 1, 3], ['relic-statue', 1, 3], ['relic-crown', 1, 3], ['balmmushroom', 2, 3],
  ['cover-fossil', 1, 3], ['plume-fossil', 1, 3], ['reaper-cloth', 1, 3], ['razor-claw', 1, 3], ['razor-fang', 1, 3], ['electirizer', 1, 3], ['magmarizer', 1, 3], ['prism-scale', 1, 3],
  ['dubious-disc', 1, 3], ['ruby', 1, 3], ['sapphire', 1, 3], ['deepseatooth', 1, 3], ['deepseascale', 1, 3], ['sharp-beak', 1, 3], ['hard-stone', 1, 3], ['x-attack-2', 1, 3], ['x-special-2', 1, 3],
]
export const PICKUP_TIERS = 3
/** One find from the table, for the tier reached: the same find on every device. */
export function pickupFind(seed: string, tier: number): string {
  const pool = PICKUP.filter(([, , t]) => t <= tier)
  const total = pool.reduce((n, [, w]) => n + w, 0)
  let x = rng(seed)() * total
  for (const [id, w] of pool) if ((x -= w) < 0) return id
  return pool[0][0]
}

// ── the version 13 shelves ──
/** The Mart's battle shelf: X items in three strengths, Dire Hits and the Guard Spec. Honey and the chores' berry too. */
export const BATTLE_SHELF: Offer[] = [
  ...X_BASE.flatMap(([base]) => [{ item: base, coins: 120 }, { item: `${base}-2`, coins: 240 }, { item: `${base}-3`, coins: 380 }]),
  { item: 'dire-hit', coins: 150 }, { item: 'dire-hit-2', coins: 280 }, { item: 'dire-hit-3', coins: 420 }, { item: 'guard-spec', coins: 250 },
  { item: 'honey', coins: 300 }, { item: 'tamato-berry', coins: 250 },
]
/** Version 16: one of each. The three strengths cost the same per point, so there was nothing to choose between them; the strongest stays. */
export const BATTLE_SHELF_V16: Offer[] = BATTLE_SHELF.filter((o) => !/(^x-|^dire-hit)/.test(o.item) || o.item.endsWith('-3'))
/** The battle shelf on a day. */
export const battleShelf = (day: string): Offer[] => (day >= V16_START ? BATTLE_SHELF_V16 : day >= V13_START ? BATTLE_SHELF : [])
/** More on the rare shelf (gems). */
export const RARE_SHELF_V13: Offer[] = [{ item: 'rare-candy', gems: 25 }, { item: 'sweet-heart', gems: 10 }, { item: 'moon-stone', gems: 40 }, { item: 'sun-stone', gems: 40 }]
/** Each domain shop adds its vitamin, its friendship berry and one evolution stone. */
const vit = (tag: MarkTag): string => Object.keys(VITAMINS).find((v) => VITAMINS[v] === tag)!
const berryOf = (tag: MarkTag): string => Object.keys(FRIEND_BERRY).find((b) => FRIEND_BERRY[b] === tag)!
const STONE: Record<MarkTag, string> = { code: 'thunderstone', fitness: 'fire-stone', guitar: 'shiny-stone', arbor: 'leaf-stone', sleep: 'dusk-stone' }
export const DOMAIN_V13: Record<MarkTag, Offer[]> = Object.fromEntries(MARK_TAGS.map((t) => [t, [{ item: vit(t), marks: 10 }, { item: berryOf(t), marks: 5 }, { item: STONE[t], marks: 15 }]])) as Record<MarkTag, Offer[]>
/** What a Legend key costs at the BP Exchange. */
export const LEGEND_KEY_BP = 250
/** The BP Exchange at the Battle Frontier. Prices are in Battle Points (written as `marks`, the shop's own currency). */
export const BP_SHELF: Offer[] = [
  { item: 'expert-belt', marks: 72 }, { item: 'focus-sash', marks: 96 }, { item: 'rocky-helmet', marks: 72 }, { item: 'scope-lens', marks: 72 }, { item: 'quick-claw', marks: 72 },
  { item: 'shell-bell', marks: 84 }, { item: 'wide-lens', marks: 60 }, { item: 'zoom-lens', marks: 60 }, { item: 'exp-share', marks: 140 }, { item: 'everstone', marks: 24 }, { item: 'lucky-punch', marks: 108 },
  ...X_BASE.map(([base]) => ({ item: `${base}-6`, marks: 24 })), { item: 'rare-candy', marks: 15 },
  ...['dragon-scale', 'metal-coat', 'kings-rock', 'up-grade', 'reaper-cloth', 'razor-claw', 'razor-fang', 'electirizer', 'magmarizer', 'prism-scale', 'dubious-disc', 'ice-stone', 'dawn-stone'].map((item) => ({ item, marks: 30 })),
  ...Object.keys(FOSSILS).map((f) => ({ item: f, marks: 30 })),
  ...Object.keys(LEGEND_KEYS).map((k) => ({ item: k, marks: LEGEND_KEY_BP })),
  { item: 'master-ball', marks: 600 },
]
// ── the fair forge: three shards of three different colours ──
/** The colours of shard, the Comet standing in for any of them. */
export const SHARD_KINDS: string[] = [...SHARDS, COMET_SHARD]
/**
 * Version 13: a Mega Stone takes three shards of three different colours, and the X or Y is yours to choose. `want` names the shards to use
 * (comma separated); without it the three colours you hold most of are used, a Comet only where a colour is missing. Null when it cannot be done.
 */
export function forgeFair(inv: Record<string, number>, want?: string): string[] | null {
  if (want) {
    const ids = want.split(',').filter(Boolean)
    if (ids.length !== 3 || !ids.every((id) => SHARD_KINDS.includes(id))) return null
    const coloured = ids.filter((id) => id !== COMET_SHARD)
    if (new Set(coloured).size !== coloured.length) return null
    const need: Record<string, number> = {}
    for (const id of ids) need[id] = (need[id] ?? 0) + 1
    return Object.entries(need).every(([id, n]) => (inv[id] ?? 0) >= n) ? ids : null
  }
  const pick: string[] = [...SHARDS].filter((s) => (inv[s] ?? 0) > 0).sort((a, b) => (inv[b] ?? 0) - (inv[a] ?? 0)).slice(0, 3)
  let comets = inv[COMET_SHARD] ?? 0
  while (pick.length < 3 && comets > 0) { pick.push(COMET_SHARD); comets-- }
  return pick.length === 3 ? pick : null
}

// ── version 13 feats ──
export const FEATS_V13: Feat[] = [
  { id: 'bond5', name: 'Best of friends', text: 'A partner reaches 150 hearts', group: 'raise', key: 'hearts', n: 150, reward: { gems: 40, items: { 'sweet-heart': 3 } } },
  { id: 'pickup25', name: 'Good nose', text: 'Twenty-five Pickup finds', group: 'collect', key: 'pickups', n: 25, reward: { gems: 25, items: { 'big-nugget': 1 } } },
  { id: 'fossil1', name: 'Back from the rock', text: 'Revive a fossil at the Lab', group: 'collect', key: 'fossils', n: 1, reward: { gems: 15, items: { 'old-amber': 1 } } },
  { id: 'stone1', name: 'A little push', text: 'Evolve a Pokemon with an item', group: 'raise', key: 'itemevos', n: 1, reward: { gems: 10, items: { 'rare-candy': 2 } } },
  { id: 'vitamins10', name: 'Well fed', text: 'Give ten vitamins', group: 'raise', key: 'vitamins', n: 10, reward: { gems: 20, items: { 'hp-up': 1 } } },
  { id: 'symbol1', name: 'A Frontier symbol', text: 'Win your first Silver Symbol', group: 'league', key: 'symbols', n: 1, reward: { gems: 30 } },
  { id: 'gold1', name: 'Gold', text: 'Win your first Gold Symbol', group: 'league', key: 'golds', n: 1, reward: { gems: 60, items: { 'master-ball': 1 } } },
  { id: 'legends3', name: 'Legends', text: 'Catch three legendary Pokemon', group: 'collect', key: 'legend', n: 3, reward: { gems: 60 } },
  { id: 'dynamax5', name: 'Max power', text: 'Five Dynamax days', group: 'perfect', key: 'dynamax', n: 5, reward: { gems: 30, items: { 'x-attack-3': 1, 'x-special-3': 1 } } },
  { id: 'crits10', name: 'Critical', text: 'Ten critical hits on leaders', group: 'league', key: 'crits', n: 10, reward: { gems: 25, items: { 'dire-hit-3': 2 } } },
  { id: 'rank2', name: 'Rematch', text: 'Beat a Champion at Rematch rank ★2', group: 'league', key: 'rematch', n: 1, reward: { gems: 100, items: { 'azure-flute': 1 } } },
]
FEATS.push(...FEATS_V13)

// ══ version 14: every item asks a question (RULES-V14.md) ═══════════════════
// An item is worth keeping only if keeping it can be worth more than using it now: another use, a better day, a better target.

// ── berries: food ──
/** A berry is fed, for hearts, to any Pokemon you own. Nothing else: a berry is food, not bait. */
ITEMS['oran-berry'] = { name: 'Oran Berry', kind: 'berry', text: 'Feed a Pokemon: one heart.' }
ITEMS['sitrus-berry'] = { name: 'Sitrus Berry', kind: 'berry', text: 'Feed a Pokemon: three hearts.' }
for (const [id, tag] of Object.entries(FRIEND_BERRY)) {
  const name = id.split('-')[0]
  ITEMS[id] = { name: `${name[0].toUpperCase()}${name.slice(1)} Berry`, kind: 'berry', text: `Feed a Pokemon: five hearts. The ${DOMAIN_NAME[tag]} berry.` }
}
ITEMS['sweet-heart'] = { name: 'Sweet Heart', kind: 'berry', text: 'A chocolate heart. Feed a Pokemon: three hearts.' }
ITEMS['heart-scale'] = { name: 'Heart Scale', kind: 'berry', text: 'A pretty scale found by Pickup. Give it to a Pokemon: two hearts.' }

// ── treasures: the Collector's wanted list ──
/** Each day the Collector wants this many kinds of treasure and pays COLLECTOR_MULT for them. The same list on every device. */
export const COLLECTOR_WANTS = 3
export const COLLECTOR_MULT = 2
export function collectorWants(day: string): string[] {
  const r = rng(`collector:${day}`)
  const pool = Object.keys(TREASURE)
  const out: string[] = []
  while (out.length < COLLECTOR_WANTS && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}
/** What the Collector pays for one of a treasure today. */
export const treasurePrice = (id: string, day: string): number =>
  (TREASURE[id]?.[1] ?? 0) * (day >= V14_START && collectorWants(day).includes(id) ? COLLECTOR_MULT : 1)
for (const [id, [name, coins]] of Object.entries(TREASURE)) ITEMS[id] = { name, kind: 'treasure', text: `A treasure. The Collector pays ${coins.toLocaleString('en-IN')} coins for it, and twice that on a day it is on the wanted list.` }

// ── vitamins: a party member's count too ──
/** A party member's vitamins add this share of their worth to every strike (the partner's count in full). */
export const PARTY_VITAMIN = 1 / 3
for (const [id, tag] of Object.entries(VITAMINS)) ITEMS[id] = { name: VIT_NAME[id], kind: 'vitamin', text: `Give it to a Pokemon: its ${DOMAIN_NAME[tag]} work strikes 3% harder while it is your partner, and 1% while it stands in the party. For good (ten at most).` }

// ── the Professor's research: what each rank hands over ──
/** Every fifth rank a Mystery Egg; between them these come round in turn. The stone is seeded, so every device agrees. */
export const RESEARCH_REWARDS: { coins?: number; gems?: number; items?: [string, number][] }[] = [
  { items: [['rare-candy', 2]] },
  { items: [['honey', 1]], gems: 10 },
  { items: [['ultra-ball', 3]] },
  { coins: 300, items: [['full-incense', 1]] },
]
const RESEARCH_STONES = ['fire-stone', 'water-stone', 'thunderstone', 'leaf-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone', 'ice-stone']
export function researchReward(rank: number): { coins?: number; gems?: number; items: [string, number][] } {
  if (rank % 5 === 0) return { gems: 25, items: [['rare-egg', 1]] }
  const r = RESEARCH_REWARDS[(rank - 1) % RESEARCH_REWARDS.length]
  const stone = RESEARCH_STONES[Math.floor(rng(`research:${rank}`)() * RESEARCH_STONES.length)]
  return { ...r, items: [...(r.items ?? []), ...(rank % 2 === 0 ? [[stone, 1] as [string, number]] : [])] }
}

// ── version 15: a level milestone is a choice of two ──
/** One side of a choice: what it pays, and a name for it on the button. */
export interface Option { name: string; coins: number; gems: number; items: [string, number][]; /** version 16: a Trainer star ranks up this perk */ perk?: string }
/**
 * The two rewards a partner's level milestone offers, drawn from five that pull
 * different ways: balls (catching), a shard in the colour you hold least of (the
 * Forge), a Rare Candy (raising the Box), coins, or gems. Seeded by the
 * milestone's key, so every device offers the same two.
 */
export function milestoneOptions(key: string, level: number, inv: Record<string, number>): [Option, Option] {
  const lacking = [...SHARDS].sort((a, b) => (inv[a] ?? 0) - (inv[b] ?? 0))[0]
  const pool: Option[] = [
    level >= 40 ? { name: '2 Ultra Balls', coins: 0, gems: 0, items: [['ultra-ball', 2]] } : { name: '3 Great Balls', coins: 0, gems: 0, items: [['great-ball', 3]] },
    { name: `A ${ITEMS[lacking]?.name ?? 'shard'}`, coins: 0, gems: 0, items: [[lacking, 1]] },
    { name: 'A Rare Candy', coins: 0, gems: 0, items: [['rare-candy', 1]] },
    { name: `${100 + level * 4} coins`, coins: 100 + level * 4, gems: 0, items: [] },
    { name: '15 gems', coins: 0, gems: 15, items: [] },
  ]
  const r = rng(`milestone:${key}`)
  const a = Math.floor(r() * pool.length)
  const b = (a + 1 + Math.floor(r() * (pool.length - 1))) % pool.length
  return [pool[a], pool[b]]
}
