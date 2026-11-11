// The rules as they were up to version 21.1 live in legacy/ and are frozen. This file is where the version 22 rules go (GAME-SPEC-V22.md).
// Until they are built it hands the old ones on unchanged, so every importer keeps working.
export * from './legacy/economy.ts'

// ══ version 22 (GAME-SPEC-V22.md) ══════════════════════════════════════════════
import { BALLS, FRIEND_BERRY, MARKS, workEgg, rng, throwHp as throwHpLegacy, type MarkTag, type Option } from './legacy/economy.ts'
import { TICKS_PER_HP, v22On, type Tag } from './rules.ts'

/** What a thrown ball takes off the wild Pokemon. From V22_START the wild Pokemon's HP is counted in ticks, so a ball's HP is too (TICKS_PER_HP); a Master Ball still catches anything. */
export function throwHp(ball: string, wild: { types: (string | undefined)[]; from: string; owned: boolean }, day: string): number {
  const hp = throwHpLegacy(ball, wild, day)
  return v22On(day) && BALLS[ball] && hp < 1_000_000 ? Math.max(1, Math.round(hp * TICKS_PER_HP)) : hp
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
