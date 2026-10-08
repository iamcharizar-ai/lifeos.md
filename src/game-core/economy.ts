// GAME CORE, rules version 6: items, the Mart, the five domain shops, feats.
// Pure data and small functions, no DOM. See ECONOMY-V6.md for why each thing is here.
//
// An item's id is the name of its sprite file (public/sprites/items/<id>.png),
// so a new item is one line here and one picture.
import type { Tag } from './rules.ts'
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
  arbor: { name: 'Seeds', icon: 'grn-apricorn', shard: 'green-shard' },
  sleep: { name: 'Bells', icon: 'lunar-wing' },
}
export const SHARDS = ['red-shard', 'blue-shard', 'yellow-shard', 'green-shard'] as const
export const SHARD_DOMAIN: Record<string, MarkTag> = { 'red-shard': 'fitness', 'blue-shard': 'code', 'yellow-shard': 'guitar', 'green-shard': 'arbor' }
/** Marks a unit-day pays, and the extras for a record and for a song part owned. */
export const MARK_RECORD = 2
export const MARK_OWNED = 3

// ── items ───────────────────────────────────────────────────────────────────
export type ItemKind = 'ball' | 'berry' | 'held' | 'tm' | 'lure' | 'shard' | 'key' | 'unique' | 'egg' | 'chest' | 'theme' | 'incense'
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
export const heldMult = (item: string | undefined, tag: Tag): number => {
  const h = item ? HELD[item] : undefined
  return h && (!h.tag || h.tag === tag) ? h.mult : 1
}
/** A lure burns, and the next wild Pokemon is one of this domain's types. */
export const LURES: Record<string, MarkTag> = { 'odd-incense': 'code', 'rock-incense': 'fitness', 'pure-incense': 'guitar', 'rose-incense': 'arbor', 'lax-incense': 'sleep' }
export const lureTypes = (tag: MarkTag): string[] => Object.entries(TYPE_DOMAIN).filter(([, d]) => d === tag).map(([t]) => t)

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
  'exp-share': { name: 'Exp. Share', kind: 'unique', text: 'A fourth place on the team.' },
  'coin-case': { name: 'Coin Case', kind: 'unique', text: 'The Mart shows four deals a day.' },
  'old-charm': { name: 'Old Charm', kind: 'unique', text: 'A Mystery Egg hatches in four days, not five.' },
  'key-stone': { name: 'Key Stone', kind: 'key', text: 'Without it, no Mega Evolution. Forge Mega Stones with shards.' },
  'red-shard': { name: 'Red Shard', kind: 'shard', text: 'Gym. Three forge a Mega X.' },
  'blue-shard': { name: 'Blue Shard', kind: 'shard', text: 'Code. Three forge a Mega Y.' },
  'yellow-shard': { name: 'Yellow Shard', kind: 'shard', text: 'Guitar. Three forge a Mega Y.' },
  'green-shard': { name: 'Green Shard', kind: 'shard', text: 'Arbor. Three forge a Mega with only one form.' },
  'odd-incense': { name: 'Odd Incense', kind: 'lure', text: 'Burn it: the next wild Pokemon is a code type (Psychic, Electric, Ghost).' },
  'rock-incense': { name: 'Rock Incense', kind: 'lure', text: 'Burn it: the next wild Pokemon is a gym type (Fighting, Rock, Ground, Steel, Fire, Dragon).' },
  'pure-incense': { name: 'Pure Incense', kind: 'lure', text: 'Burn it: the next wild Pokemon is a guitar type (Fairy, Normal, Flying).' },
  'rose-incense': { name: 'Rose Incense', kind: 'lure', text: 'Burn it: the next wild Pokemon is a Grass type.' },
  'lax-incense': { name: 'Lax Incense', kind: 'lure', text: 'Burn it: the next wild Pokemon is a Dark type.' },
  'full-incense': { name: 'Full Incense', kind: 'incense', text: 'Choose the next wild Pokemon from three.' },
  'rare-egg': { name: 'Mystery Egg', kind: 'egg', text: 'Hatches into a rare Pokemon after five days with two pillars.' },
  chest: { name: 'Chest', kind: 'chest', text: 'Open it for coins, balls, berries or, now and then, incense.' },
  'theme-beach': { name: 'Beach', kind: 'theme', text: 'A new place for the battle scene.' },
  'theme-cave': { name: 'Cave', kind: 'theme', text: 'A new place for the battle scene.' },
  'theme-night': { name: 'Starry night', kind: 'theme', text: 'A new place for the battle scene.' },
}
for (const t of TYPES) ITEMS[tmId(t)] = { name: `TM ${t}`, kind: 'tm', text: tmText(t) }
export const itemName = (id: string): string => ITEMS[id]?.name ?? id

// ── shops ───────────────────────────────────────────────────────────────────
export interface Offer { item: string; coins?: number; gems?: number; marks?: number }
export type ShopId = 'mart' | 'rare' | MarkTag

/** The pool the Mart draws its daily deals from (coins). */
export const MART_POOL: Offer[] = [
  { item: 'poke-ball', coins: 60 }, { item: 'great-ball', coins: 150 }, { item: 'ultra-ball', coins: 380 },
  { item: 'repeat-ball', coins: 250 }, { item: 'oran-berry', coins: 50 }, { item: 'sitrus-berry', coins: 130 },
  { item: 'odd-incense', coins: 220 }, { item: 'rock-incense', coins: 220 }, { item: 'pure-incense', coins: 220 }, { item: 'rose-incense', coins: 220 }, { item: 'lax-incense', coins: 220 },
]
export const MART_DEALS = 3
/** The day's deals: the same three on every device, and one of each can be bought. */
export function martDeals(day: string, n: number = MART_DEALS): Offer[] {
  const r = rng(`mart:${day}`)
  const pool = [...MART_POOL]
  const out: Offer[] = []
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return out
}

/** The rare shelf (gems). Themes are bought once. */
export const RARE_SHELF: Offer[] = [
  { item: 'full-incense', gems: 40 }, { item: 'chest', gems: 30 }, { item: 'rare-egg', gems: 150 },
  { item: 'theme-beach', gems: 60 }, { item: 'theme-cave', gems: 60 }, { item: 'theme-night', gems: 60 },
]
/** Bought once, kept for good. */
export const ONCE = new Set<string>([...TYPES.map(tmId), 'theme-beach', 'theme-cave', 'theme-night', ...Object.keys(HELD).filter((h) => HELD[h].mult < 1.2)])

export interface DomainShop { name: string; place: string; stock: Offer[] }
const tms = (...types: string[]): Offer[] => types.map((t) => ({ item: tmId(t), marks: ['Psychic', 'Ghost', 'Dark', 'Steel', 'Dragon'].includes(t) ? 9 : 6 }))
export const DOMAIN_SHOPS: Record<MarkTag, DomainShop> = {
  code: {
    name: 'Silph Co.', place: 'the tower on the hill',
    stock: [{ item: 'quick-ball', marks: 6 }, { item: 'timer-ball', marks: 6 }, { item: 'odd-incense', marks: 3 }, { item: 'wise-glasses', marks: 12 }, ...tms(...TYPES)],
  },
  fitness: {
    name: 'The Dojo', place: 'the mine on the west shore',
    stock: [{ item: 'heavy-ball', marks: 6 }, { item: 'fast-ball', marks: 6 }, { item: 'rock-incense', marks: 3 }, { item: 'muscle-band', marks: 12 }],
  },
  guitar: {
    name: 'Music Hall', place: 'the purple house',
    stock: [{ item: 'luxury-ball', marks: 8 }, { item: 'moon-ball', marks: 6 }, { item: 'pure-incense', marks: 3 }, { item: 'soothe-bell', marks: 12 }],
  },
  arbor: {
    name: 'The Farm', place: 'the terraces in the north-west',
    stock: [{ item: 'net-ball', marks: 6 }, { item: 'sitrus-berry', marks: 3 }, { item: 'rose-incense', marks: 3 }, { item: 'miracle-seed', marks: 12 }],
  },
  sleep: {
    name: 'Dream House', place: 'the big house on the east shore',
    stock: [{ item: 'dusk-ball', marks: 6 }, { item: 'lax-incense', marks: 3 }, { item: 'leftovers', marks: 12 }],
  },
}
/** Where an item can be bought, searched in this order when the shop is not named. */
export function offerFor(shop: ShopId | undefined, item: string, day: string, deals: number): { shop: ShopId; offer: Offer } | null {
  const find = (s: ShopId): Offer | undefined =>
    s === 'mart' ? martDeals(day, deals).find((o) => o.item === item) : s === 'rare' ? RARE_SHELF.find((o) => o.item === item) : DOMAIN_SHOPS[s].stock.find((o) => o.item === item)
  const order: ShopId[] = shop ? [shop] : ['mart', 'rare', ...MARK_TAGS]
  for (const s of order) { const offer = find(s); if (offer) return { shop: s, offer } }
  return null
}

// ── the Professor, the Smithy ──────────────────────────────────────────────
/** What a Box Pokemon is worth to the Professor, by rarity. */
export const SELL: Record<string, number> = { C: 30, U: 80, R: 200, L: 500 }
/** Shards a Mega Stone costs. */
export const FORGE_COST = 3
/** Which shard forges form `index` of `count`: X takes red, Y takes blue then yellow, a lone form takes the partner's own colour, then any. */
export function forgeShard(count: number, index: number, own: Tag | undefined, inv: Record<string, number>): string | null {
  const has = (s: string) => (inv[s] ?? 0) >= FORGE_COST
  const order: string[] = count > 1 ? (index === 0 ? ['red-shard'] : ['blue-shard', 'yellow-shard']) : [...(own && isMarkTag(own) && MARKS[own].shard ? [MARKS[own].shard!] : []), ...SHARDS]
  return order.find(has) ?? null
}

// ── quests and the season, as priced in version 6 ──────────────────────────
export interface QuestDef6 { id: string; name: string; coins?: number; gems?: number }
export const DAILY_QUESTS6: QuestDef6[] = [
  { id: 'two-pillars', name: 'Finish two pillars', coins: 30 },
  { id: 'all-pillars', name: 'Finish every pillar', coins: 50 },
  { id: 'chores', name: 'Four-fifths of the chores', coins: 20 },
  { id: 'perfect', name: 'A perfect day', gems: 5 },
]
export const WEEKLY_QUESTS6: QuestDef6[] = [
  { id: 'five-days', name: '5 days with two pillars', coins: 100, gems: 10 },
  { id: 'week-xp', name: '2,000 XP of work', coins: 100 },
  { id: 'catch', name: 'Catch a Pokemon', gems: 10 },
]
export interface SeasonReward6 { coins?: number; gems?: number; item?: string }
export const SEASON_REWARDS6: SeasonReward6[] = [{ coins: 100 }, { item: 'great-ball' }, { gems: 10 }, { item: 'oran-berry' }, { coins: 200 }, { item: 'ultra-ball' }, { gems: 25 }]
export const seasonReward6 = (step: number): SeasonReward6 => SEASON_REWARDS6[(step - 1) % SEASON_REWARDS6.length]
/** What a chest holds, with the odds out of 100. */
export const CHEST6: { odds: number; coins?: number; item?: string; n?: number }[] = [
  { odds: 40, coins: 250 }, { odds: 25, item: 'great-ball', n: 2 }, { odds: 15, item: 'ultra-ball', n: 1 }, { odds: 12, item: 'sitrus-berry', n: 2 }, { odds: 8, item: 'full-incense', n: 1 },
]
export const EGG_DAYS_OLD_CHARM = 4

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
    out.push(
      { id: `run7-${tag}`, name: `${w.run}, seven running`, text: `${w.unit} on seven days running (one rest day is forgiven)`, group: 'run', key: `run:${tag}`, n: 7, reward: { gems: 10, items: shardOf(tag) }, tag },
      { id: `run30-${tag}`, name: `${w.run}, a month running`, text: `${w.unit} for thirty days running`, group: 'run', key: `run:${tag}`, n: 30, reward: { gems: 25, items: { ...shardOf(tag), [UNIQUE_HELD[tag]]: 1 } }, tag },
      { id: `days25-${tag}`, name: `${w.run}, 25 days`, text: `${w.unit}, 25 in all`, group: 'total', key: `days:${tag}`, n: 25, reward: { gems: 5, items: shardOf(tag) }, tag },
      { id: `days100-${tag}`, name: `${w.run}, 100 days`, text: `${w.unit}, 100 in all`, group: 'total', key: `days:${tag}`, n: 100, reward: { gems: 30, items: shardOf(tag) }, tag },
    )
    if (tag !== 'sleep') out.push(
      { id: `run100-${tag}`, name: `${w.run}, a hundred running`, text: `${w.unit} for a hundred days running`, group: 'run', key: `run:${tag}`, n: 100, reward: { gems: 60, items: shardOf(tag, 2) }, tag },
      { id: `days250-${tag}`, name: `${w.run}, 250 days`, text: `${w.unit}, 250 in all`, group: 'total', key: `days:${tag}`, n: 250, reward: { gems: 80 }, tag },
    )
  }
  return out
}
export const FEATS: Feat[] = [
  { id: 'work7', name: 'A week running', text: 'Any one kind of work on seven days running (one rest day is forgiven)', group: 'run', key: 'run:any', n: 7, reward: { gems: 10, items: { 'key-stone': 1 } } },
  { id: 'work14', name: 'A fortnight', text: 'Two pillars a day for fourteen days running', group: 'run', key: 'run:work', n: 14, reward: { gems: 15, items: { 'amulet-coin': 1 } } },
  { id: 'work30', name: 'A month of it', text: 'Two pillars a day for thirty days running', group: 'run', key: 'run:work', n: 30, reward: { gems: 40, items: { 'master-ball': 1 } } },
  { id: 'work60', name: 'Two months', text: 'Two pillars a day for sixty days running', group: 'run', key: 'run:work', n: 60, reward: { gems: 100 } },
  ...domainFeats(),
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
  { id: 'grads5', name: 'Five trained', text: 'Fully train five Pokemon', group: 'raise', key: 'grads', n: 5, reward: { gems: 30, items: { 'exp-share': 1 } } },
  { id: 'grads10', name: 'Ten trained', text: 'Fully train ten Pokemon', group: 'raise', key: 'grads', n: 10, reward: { gems: 50 } },
  { id: 'hearts30', name: 'Close', text: 'A partner reaches thirty hearts', group: 'raise', key: 'hearts', n: 30, reward: { gems: 15, items: { 'luxury-ball': 2 } } },
  { id: 'hatch1', name: 'It hatched', text: 'Hatch a Mystery Egg', group: 'raise', key: 'hatched', n: 1, reward: { gems: 10, items: { 'old-charm': 1 } } },
  { id: 'chests5', name: 'Five chests', text: 'Open five chests', group: 'raise', key: 'chests', n: 5, reward: { gems: 20 } },
  { id: 'badge1', name: 'First badge', text: 'Win a gym badge', group: 'league', key: 'badges', n: 1, reward: { items: { 'oran-berry': 3 } } },
  { id: 'badge8', name: 'Eight badges', text: 'Win eight gym badges', group: 'league', key: 'badges', n: 8, reward: { gems: 40 } },
]
export const featById = (id: string): Feat | undefined => FEATS.find((f) => f.id === id)
