// Pokemon types, as far as the game uses them: which type beats which, which
// of your six domains each type stands for, and from those two, which domains
// a gym leader is weak to. Pure data and three small functions.
import type { Tag } from './rules.ts'

/** attacker → the types it is super effective against (the real chart) */
const BEATS: Record<string, string[]> = {
  Normal: [],
  Fire: ['Grass', 'Ice', 'Bug', 'Steel'],
  Water: ['Fire', 'Ground', 'Rock'],
  Electric: ['Water', 'Flying'],
  Grass: ['Water', 'Ground', 'Rock'],
  Ice: ['Grass', 'Ground', 'Flying', 'Dragon'],
  Fighting: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'],
  Poison: ['Grass', 'Fairy'],
  Ground: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'],
  Flying: ['Grass', 'Fighting', 'Bug'],
  Psychic: ['Fighting', 'Poison'],
  Bug: ['Grass', 'Psychic', 'Dark'],
  Rock: ['Fire', 'Ice', 'Flying', 'Bug'],
  Ghost: ['Psychic', 'Ghost'],
  Dragon: ['Dragon'],
  Dark: ['Psychic', 'Ghost'],
  Steel: ['Ice', 'Rock', 'Fairy'],
  Fairy: ['Fighting', 'Dragon', 'Dark'],
}

/** Which domain each type stands for. The same grouping that decides branching evolutions. */
export const TYPE_DOMAIN: Record<string, Tag> = {
  Fighting: 'fitness', Rock: 'fitness', Ground: 'fitness', Steel: 'fitness', Fire: 'fitness', Dragon: 'fitness',
  Psychic: 'code', Electric: 'code', Ghost: 'code',
  Fairy: 'guitar', Normal: 'guitar', Flying: 'guitar',
  Grass: 'arbor', Dark: 'sleep',
  Water: 'routine', Ice: 'routine', Bug: 'routine', Poison: 'routine',
}

/** Does a Pokemon with these types hit this type super effectively? */
export const beats = (attacker: (string | undefined)[], defender: string): boolean =>
  attacker.some((t) => t !== undefined && (BEATS[t] ?? []).includes(defender))

/**
 * The one or two domains a leader of this type is weak to. A domain's claim is
 * the share of its own types that are super effective, so a domain with many
 * types (fitness has six) does not win every time just by having more.
 */
export function weakDomains(type: string): Tag[] {
  const score = new Map<Tag, number>(), size = new Map<Tag, number>()
  for (const [t, d] of Object.entries(TYPE_DOMAIN)) {
    size.set(d, (size.get(d) ?? 0) + 1)
    if ((BEATS[t] ?? []).includes(type)) score.set(d, (score.get(d) ?? 0) + 1)
  }
  return [...score.entries()]
    .map(([d, n]) => [d, n / (size.get(d) as number)] as const)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 2)
    .map(([d]) => d)
}
