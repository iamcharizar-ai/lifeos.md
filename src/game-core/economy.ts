// The rules as they were up to version 21.1 live in legacy/ and are frozen. This file is where the version 22 rules go (GAME-SPEC-V22.md).
// Until they are built it hands the old ones on unchanged, so every importer keeps working.
export * from './legacy/economy.ts'

// ══ version 22 (GAME-SPEC-V22.md) ══════════════════════════════════════════════
import { BALLS, WAIT_CAP, dayGap, FRIEND_BERRY, MARKS, workEgg, rng, throwHp as throwHpLegacy, type MarkTag, type Option } from './legacy/economy.ts'
import { TICKS_PER_HP, v22On, type Tag } from './rules.ts'

/** What a thrown ball takes off the wild Pokemon. From V22_START the wild Pokemon's HP is counted in ticks, so a ball's HP is too (TICKS_PER_HP); a Master Ball still catches anything. */
export function throwHp(ball: string, wild: { types: (string | undefined)[]; from: string; owned: boolean }, day: string): number {
  const hp = throwHpLegacy(ball, wild, day)
  if (!v22On(day) || !BALLS[ball] || hp >= 1_000_000) return hp
  // version 22 (9.5): the balls that stay have their own HP in ticks; any other (kept only until it is converted) is scaled
  if (ball === 'great-ball') return BALL_TICKS['great-ball']
  if (ball === 'quick-ball') return wild.from === day ? BALL_TICKS['quick-ball'].first : BALL_TICKS['quick-ball'].after
  if (ball === 'timer-ball') return BALL_TICKS['timer-ball'].base + BALL_TICKS['timer-ball'].perDay * Math.min(WAIT_CAP, Math.max(0, dayGap(wild.from, day)))
  return Math.max(1, Math.round(hp * TICKS_PER_HP))
}

/** The berry each kind of work drops: one per pillar done (4.2). */
export const BERRY_OF: Record<Tag, string> = Object.fromEntries(Object.entries(FRIEND_BERRY).map(([id, tag]) => [tag, id])) as Record<Tag, string>
/** The berry a Pokemon likes best: that of the kind of work its first type belongs to (core/bond.ts signatureOf names the kind). */
export const favouriteBerry = (tag: Tag): string => BERRY_OF[tag]

const TRACK_NAME: Record<MarkTag, string> = { code: 'Code', fitness: 'Gym', guitar: 'Guitar', arbor: 'Arbor', sleep: 'Sleep' }
/** The prize of a full track: its shard or its egg (a choice), and for Sleep, which has no shard, its egg alone. */
export function trackPrize(tag: MarkTag): [Option, Option] | Option {
  const egg: Option = { name: `A ${TRACK_NAME[tag]} Egg`, coins: 0, gems: 0, items: [[workEgg(tag), 1]] }
  const shard = MARKS[tag].shard
  return shard ? [{ name: `A ${shard.split('-')[0][0].toUpperCase()}${shard.split('-')[0].slice(1)} Shard`, coins: 0, gems: 0, items: [[shard, 1]] }, egg] : egg
}
/** Version 22 level milestones (10.5): a choice of two from coins, gems, balls and a Rare Candy. No shard: shards come from tracks. */
export function milestoneOptionsV22(key: string, level: number): [Option, Option] {
  const pool: Option[] = [
    { name: '3 Great Balls', coins: 0, gems: 0, items: [['great-ball', 3]] },
    { name: 'A Rare Candy', coins: 0, gems: 0, items: [['rare-candy', 1]] },
    { name: `${100 + level * 4} coins`, coins: 100 + level * 4, gems: 0, items: [] },
    { name: '15 gems', coins: 0, gems: 15, items: [] },
  ]
  const r = rng(`milestone:${key}`)
  const a = Math.floor(r() * pool.length)
  const b = (a + 1 + Math.floor(r() * (pool.length - 1))) % pool.length
  return [pool[a], pool[b]]
}

// ── version 22, steps 4 and 5: the shelves, what becomes of everything cut, the Lab's rewards, the Trainer's levels ──
import {
  BATTLE_SHELF, BP_SHELF, COMET_SHARD, DOMAIN_SHOPS, DOMAIN_V13, EGG_IDS, FOSSILS, ITEMS as LEGACY_ITEMS, LEGEND_KEYS, MART_POOL, ONCE as ONCE_LEGACY, RARE_SHELF, RARE_SHELF_V13,
  SHARDS, STANDING, TREASURE, eggNeed as eggNeedLegacy, isEgg, itemName as itemNameLegacy, offerFor as offerForLegacy, type Offer, type ShopId,
} from './legacy/economy.ts'

/** Balls that stay: a choice of timing (spec 9.5). Every other ball becomes a Great Ball. */
export const BALLS_V22 = ['great-ball', 'quick-ball', 'timer-ball', 'master-ball']
/** What a ball takes off the wild Pokemon, in ticks (3.3): Great any day, Quick a lot on the day it appears, Timer more for every day it has waited. A Master Ball catches anything. */
export const BALL_TICKS = { 'great-ball': 12, 'quick-ball': { first: 24, after: 6 }, 'timer-ball': { base: 4, perDay: 4 } } as const
/** The eight held items, each a different job (9.4), and what each costs in gems. Everything else in HELD is cut. */
export const HELD_V22: Record<string, number> = { everstone: 60, 'lucky-punch': 150, 'amulet-coin': 200, 'lucky-egg': 500, 'old-charm': 200, 'soothe-bell': 120, 'rocky-helmet': 150, 'expert-belt': 200 }
/** The ten evolution stones: the only evolution items left, 600 coins each. */
export const STONES_V22 = ['fire-stone', 'water-stone', 'thunderstone', 'leaf-stone', 'moon-stone', 'sun-stone', 'dusk-stone', 'shiny-stone', 'dawn-stone', 'ice-stone']
export const STONE_COINS = 600
/** A second place in the Nursery: bought once, for coins, so two things are warmed by the same steps. */
export const NURSERY_PLACE = 'nursery-place'
export const NURSERY_PLACE_COINS = 5000
/** The Mart: always in stock, no daily deals. A stronger ball is never the worse buy: 12 HP for 150, 24 (6 after the first day) for 250, up to 40 for 220. */
export const MART_V22: Offer[] = [
  { item: 'great-ball', coins: 150 }, { item: 'quick-ball', coins: 250 }, { item: 'timer-ball', coins: 220 }, { item: 'full-incense', coins: 400 },
  ...STONES_V22.map((item) => ({ item, coins: STONE_COINS })),
  { item: NURSERY_PLACE, coins: NURSERY_PLACE_COINS },
]
/** Rare things, for gems: a Mystery Egg, a Rare Candy, the scenes, and the held items (bought once). */
export const RARE_V22: Offer[] = [
  { item: 'rare-egg', gems: 150 }, { item: 'rare-candy', gems: 25 },
  { item: 'theme-beach', gems: 60 }, { item: 'theme-cave', gems: 60 }, { item: 'theme-night', gems: 60 },
  ...Object.entries(HELD_V22).map(([item, gems]) => ({ item, gems })),
]
/** The Forge's fee for a Mega Stone, on top of three shards of three colours. */
export const FORGE_COINS = 1500
/** A fossil is revived by walking, in the Nursery like an egg. */
export const FOSSIL_STEPS = 20000
/** Everything bought once: the old list, and the keepsakes that are held items now. */
export const ONCE: Set<string> = new Set([...ONCE_LEGACY, 'amulet-coin', 'old-charm', NURSERY_PLACE])

export function offerFor(shop: ShopId | undefined, item: string, day: string, deals: number): { shop: ShopId; offer: Offer } | null {
  if (!v22On(day)) return offerForLegacy(shop, item, day, deals)
  for (const s of (shop ? [shop] : ['mart', 'rare']) as ShopId[]) {
    const offer = (s === 'mart' ? MART_V22 : s === 'rare' ? RARE_V22 : []).find((o) => o.item === item)
    if (offer) return { shop: s, offer }
  }
  return null
}
export const eggNeed = (kind: string, since: string, charm: boolean): number => (FOSSILS[kind] && v22On(since) ? Math.round(FOSSIL_STEPS * (charm ? 0.8 : 1)) : eggNeedLegacy(kind, since, charm))
/** Anything that can go in the Nursery: an egg, and from version 22 a fossil. */
export const inNursery = (id: string): boolean => isEgg(id) || Boolean(FOSSILS[id])
export const NURSERY_IDS: string[] = [...EGG_IDS, ...Object.keys(FOSSILS)]
export const itemName = (id: string): string => (id === 'coin' ? 'Coins' : id === NURSERY_PLACE ? 'Second Nursery place' : itemNameLegacy(id))

/** Does this item stay in the game from version 22? (Everything else is paid back: convertV22.) */
export function keptV22(id: string): boolean {
  return BALLS_V22.includes(id) || id in FRIEND_BERRY || id in HELD_V22 || (SHARDS as readonly string[]).includes(id) || id === COMET_SHARD || id === 'key-stone' || isEgg(id) || id in FOSSILS
    || STONES_V22.includes(id) || id === 'rare-candy' || id === 'full-incense' || id in LEGEND_KEYS || id.startsWith('theme-') || id === NURSERY_PLACE
}
const SHELF_PRICES: Offer[] = [...MART_POOL, ...STANDING, ...BATTLE_SHELF, ...RARE_SHELF, ...RARE_SHELF_V13]
/** What a cut item is worth to give back, one of it: its shelf price (marks at 15 coins, Battle Points at 4), the Collector's price for a treasure, else 100 coins. */
export function refundOf(id: string): { coins: number; gems: number } {
  if (TREASURE[id]) return { coins: TREASURE[id][1], gems: 0 }
  const shelf = SHELF_PRICES.find((o) => o.item === id)
  if (shelf) return { coins: shelf.coins ?? 0, gems: shelf.gems ?? 0 }
  const domain = [...Object.values(DOMAIN_SHOPS).flatMap((s) => s.stock), ...Object.values(DOMAIN_V13).flat()].find((o) => o.item === id)
  if (domain?.marks) return { coins: domain.marks * 15, gems: 0 }
  const bp = BP_SHELF.find((o) => o.item === id)
  if (bp?.marks) return { coins: bp.marks * 4, gems: 0 }
  return { coins: LEGACY_ITEMS[id]?.kind === 'unique' ? 300 : 100, gems: 0 }
}
/** What n of this item become: themselves if they stay, Great Balls for any other ball, Tamato Berries for a berry that is cut, else their price back in coins or gems. */
export function convertV22(id: string, n: number): { items: [string, number][]; coins: number; gems: number } {
  if (keptV22(id)) return { items: [[id, n]], coins: 0, gems: 0 }
  if (LEGACY_ITEMS[id]?.kind === 'ball') return { items: [['great-ball', n]], coins: 0, gems: 0 }
  if (LEGACY_ITEMS[id]?.kind === 'berry') return { items: [[BERRY_OF.routine, n]], coins: 0, gems: 0 }
  const r = refundOf(id)
  return { items: [], coins: r.coins * n, gems: r.gems * n }
}

/** What a day with a pillar can turn up (9.3): coins, a berry, a ball, a Rare Candy, a stone, a fossil. [item, weight, from tier]; 'coins' pays PICKUP_COINS[tier]. */
export const PICKUP_COINS = [80, 120, 180, 260]
export const PICKUP_V22: [string, number, number][] = [
  ['coins', 30, 0], ...Object.keys(FRIEND_BERRY).map((b): [string, number, number] => [b, 5, 0]), ['great-ball', 12, 0], ['rare-candy', 5, 0],
  ['moon-stone', 2, 0], ['helix-fossil', 1, 0], ['dome-fossil', 1, 0], ['old-amber', 1, 0],
  ['fire-stone', 2, 1], ['water-stone', 2, 1], ['thunderstone', 2, 1], ['leaf-stone', 2, 1], ['root-fossil', 1, 1], ['claw-fossil', 1, 1], ['quick-ball', 6, 1],
  ['sun-stone', 2, 2], ['dusk-stone', 2, 2], ['dawn-stone', 2, 2], ['shiny-stone', 2, 2], ['ice-stone', 2, 2], ['skull-fossil', 1, 2], ['armor-fossil', 1, 2], ['timer-ball', 6, 2],
  ['cover-fossil', 1, 3], ['plume-fossil', 1, 3],
]
export function pickupFindV22(seed: string, tier: number): string {
  const pool = PICKUP_V22.filter(([, , t]) => t <= tier)
  let x = rng(seed)() * pool.reduce((n, [, w]) => n + w, 0)
  for (const [id, w] of pool) if ((x -= w) < 0) return id
  return pool[0][0]
}

/** The Lab's rewards (5.4), one for every rank and no last rank: coins, a berry (a choice of two), a Rare Candy, an Incense, a Mystery Egg; every tenth rank a Comet Shard and a stone or fossil on top. */
export const LAB_COINS = 200
export type LabReward = { coins: number; items: [string, number][]; choice?: [Option, Option]; title: string }
export function labReward(rank: number): LabReward {
  const p = (rank - 1) % 5
  const r = rng(`lab:${rank}`)
  const berries = Object.keys(FRIEND_BERRY)
  const a = Math.floor(r() * berries.length), b = (a + 1 + Math.floor(r() * (berries.length - 1))) % berries.length
  const finds = [...STONES_V22, ...Object.keys(FOSSILS)]
  const tenth: [string, number][] = rank % 10 === 0 ? [[COMET_SHARD, 1], [finds[Math.floor(r() * finds.length)], 1]] : []
  const one = (id: string): Option => ({ name: itemName(id), coins: 0, gems: 0, items: [[id, 1]] })
  if (p === 0) return { coins: LAB_COINS, items: tenth, title: `${LAB_COINS} coins` }
  if (p === 1) return { coins: 0, items: tenth, choice: [one(berries[a]), one(berries[b])], title: 'A berry of your choice' }
  if (p === 2) return { coins: 0, items: [['rare-candy', 1], ...tenth], title: 'A Rare Candy' }
  if (p === 3) return { coins: 0, items: [['full-incense', 1], ...tenth], title: 'An Incense' }
  return { coins: 0, items: [['rare-egg', 1], ...tenth], title: 'A Mystery Egg' }
}
/** Points the next Lab rank takes when `rank` ranks are done (it has no last rank): 175, 200, 225 ... Set in the simulator so a first rank comes inside the first week and the owner's real pace earns about one a fortnight. */
export const labCost = (rank: number): number => 150 + 25 * (rank + 1)

/** Every Trainer level (8) pays a choice of two: two Rare Candies, a Mystery Egg, coins, an Incense. */
export function trainerOptions(n: number): [Option, Option] {
  const pool: Option[] = [
    { name: '2 Rare Candies', coins: 0, gems: 0, items: [['rare-candy', 2]] }, { name: 'A Mystery Egg', coins: 0, gems: 0, items: [['rare-egg', 1]] },
    { name: '400 coins', coins: 400, gems: 0, items: [] }, { name: 'An Incense', coins: 0, gems: 0, items: [['full-incense', 1]] },
  ]
  const r = rng(`trainer:${n}`)
  const a = Math.floor(r() * pool.length), b = (a + 1 + Math.floor(r() * (pool.length - 1))) % pool.length
  return [pool[a], pool[b]]
}

// ── version 22, step 6: feats, and every legend one deed (spec section 10) ──
import { FACILITIES } from './frontier.ts'
import { LEAGUES } from './gyms.ts'
import { FEATS as LEGACY_FEATS, REMATCH_KEYS, type Feat, type Reward } from './legacy/economy.ts'

/** From version 22 the feats are milestones: every run (7, 30, 100 in a row) goes, because the Battle Frontier is the one streak system. The week running that pays the Key Stone stays. */
export const featLive = (f: Feat, day: string): boolean => !v22On(day) || f.group !== 'run' || f.id === 'work7'
/** What a feat pays from version 22: shards come from tracks and nowhere else, so a feat pays gems and its other things. */
export function featReward(f: Feat, day: string): Reward {
  if (!v22On(day) || !f.reward.items) return f.reward
  const items = Object.fromEntries(Object.entries(f.reward.items).filter(([id]) => !(SHARDS as readonly string[]).includes(id)))
  return { ...f.reward, items }
}
export const FEATS_LIVE = (day: string): Feat[] => LEGACY_FEATS.filter((f) => featLive(f, day))

/**
 * Where each Legend key comes from (10.3): a Gold Symbol at a Frontier facility (seven keys), or the Champion of a league (ten on the first lap, then
 * each Rematch lap's, in REMATCH_KEYS order). A key with neither has no deed and is not listed; nothing buys one any more.
 */
export type LegendDeed = { kind: 'symbol'; facility: string } | { kind: 'champion'; league: number; lap: number }
export const LEGEND_DEEDS: Record<string, LegendDeed> = (() => {
  const out: Record<string, LegendDeed> = {}
  for (const f of FACILITIES) out[f.goldKey] = { kind: 'symbol', facility: f.id }
  REMATCH_KEYS.forEach((key, i) => { if (!out[key]) out[key] = { kind: 'champion', league: i % LEAGUES.length, lap: Math.floor(i / LEAGUES.length) } })
  return out
})()
/** The Champion's key on a lap (the same on every device): the Champions come round in REMATCH_KEYS order, ten to a lap. */
export const championKey = (lap: number, league: number): string => REMATCH_KEYS[(lap * LEAGUES.length + league) % REMATCH_KEYS.length]
