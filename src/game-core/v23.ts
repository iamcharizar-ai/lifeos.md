// Version 23 (MEGA-OVERHAUL-PLAN.md): the Mega Stones on the Momentum row. Pure: the fold hands it the days and the stones, and keeps the state.
//
// The row is the seven days before today. A good day (two pillars) that has made the streak (the seven-day count, with it, has reached STONE_STREAK) carries one
// of your stones, and that stone's Pokemon is a Mega while the day is on the row. The stones go in the week's order: a seeded shuffle of the stones you own,
// the first one not already lit being next. A good day that finds none free is owed one, and the newest owed day takes the first stone that becomes free (one forged later, or one whose day left the row).
import { COMET_SHARD, SHARDS, rng } from './economy.ts'

/** A Mega Stone: whose it is and which Mega form. */
export interface RowStone { uid: string; form: string }

/** The good days among the seven that end with day index `i`. */
export const goodRun = (good: (k: number) => boolean, i: number): number => {
  let n = 0
  for (let k = Math.max(0, i - 6); k <= i; k++) if (good(k)) n++
  return n
}

/**
 * The next stone in line for the days lo to hi: the first of the week's order (a shuffle of `owned`, seeded by `seed`, so every replay agrees) that is not lit
 * on those days, and whose Pokemon is not already a Mega on them (a Pokemon with two stones never takes two days). Null when every stone is lit.
 */
export function nextStone(owned: readonly RowStone[], rowStone: ReadonlyMap<number, RowStone>, lo: number, hi: number, seed: string): RowStone | null {
  const lit = new Set<string>(), litMon = new Set<string>()
  for (let k = Math.max(0, lo); k <= hi; k++) {
    const st = rowStone.get(k)
    if (st) { lit.add(st.uid + st.form); litMon.add(st.uid) }
  }
  const r = rng(seed)
  const order = [...owned]
  for (let a = order.length - 1; a > 0; a--) { const b = Math.floor(r() * (a + 1)); [order[a], order[b]] = [order[b], order[a]] }
  return order.find((st) => !lit.has(st.uid + st.form) && !litMon.has(st.uid)) ?? null
}

/**
 * The owed days from lo to hi, **newest first**, take the next free stone, so a stone sits on the day that keeps it on the row longest (an older day would age out sooner);
 * an owed day that has left the row is forgotten. Stops at the first day with no stone to give.
 */
export function fillOwed(owed: Set<number>, rowStone: Map<number, RowStone>, owned: readonly RowStone[], lo: number, hi: number, seed: string): void {
  for (const d of [...owed]) if (d < lo) owed.delete(d)
  for (const d of [...owed].sort((a, b) => b - a)) {
    const st = nextStone(owned, rowStone, lo, hi, seed)
    if (!st) break
    rowStone.set(d, st)
    owed.delete(d)
  }
}

// ── the recipes ─────────────────────────────────────────────────────────────
// Each Mega Stone has its own recipe of three shards: drawn once, at random, from a seed made of the Mega form's name, so it is fixed for good and the same on
// every device and every replay. A Comet Shard fits any place in it. (MEGA-OVERHAUL-PLAN.md, FORGE-EXPERIENCE.md section 8.)

/** The starting odds*: three of one colour, two of one colour and one of another, three different colours. */
export const RECIPE_ODDS = { triple: 0.2, double: 0.5 } as const   // the rest, 0.3, is three different colours

/** The three shards a Mega Stone is forged from, colours only (red, blue, green, yellow), the repeated colour first. */
export function recipeOf(form: string): string[] {
  const r = rng(`recipe:${form}`)
  const colours: string[] = [...SHARDS]
  const pick = (): string => colours.splice(Math.floor(r() * colours.length), 1)[0]
  const kind = r()
  if (kind < RECIPE_ODDS.triple) { const c = pick(); return [c, c, c] }
  if (kind < RECIPE_ODDS.triple + RECIPE_ODDS.double) { const a = pick(), b = pick(); return [a, a, b] }
  return [pick(), pick(), pick()].sort((x, y) => (SHARDS as readonly string[]).indexOf(x) - (SHARDS as readonly string[]).indexOf(y))
}

/** Could these shards still become the recipe? No colour more often than the recipe has it, and no more than it has places; a Comet fits any place. */
export function fitsRecipe(placed: readonly string[], recipe: readonly string[]): boolean {
  if (placed.length > recipe.length) return false
  const need = new Map<string, number>()
  for (const k of recipe) need.set(k, (need.get(k) ?? 0) + 1)
  const got = new Map<string, number>()
  for (const k of placed) {
    if (k === COMET_SHARD) continue
    if (!need.has(k)) return false
    got.set(k, (got.get(k) ?? 0) + 1)
  }
  return [...got].every(([k, n]) => n <= (need.get(k) ?? 0))
}

/** Every place of the recipe is filled (a Comet standing in for any colour). */
export const recipeMet = (placed: readonly string[], recipe: readonly string[]): boolean => placed.length === recipe.length && fitsRecipe(placed, recipe)

/** The shards a forge spends: the ones named (a comma-separated list of kinds) if they make the recipe and are all held, else null. */
export function forgeRecipe(inv: Readonly<Record<string, number>>, want: string | undefined, recipe: readonly string[]): string[] | null {
  const ids = (want ?? '').split(',').filter(Boolean)
  if (!recipeMet(ids, recipe)) return null
  const need = new Map<string, number>()
  for (const id of ids) need.set(id, (need.get(id) ?? 0) + 1)
  return [...need].every(([id, n]) => (inv[id] ?? 0) >= n) ? ids : null
}
