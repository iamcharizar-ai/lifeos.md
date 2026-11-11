// The whole game, as one pure function of the days so far.
//
// Version 22 (GAME-SPEC-V22.md, section 12.1): the rules up to version 21.1 are frozen in legacy/ and fold every day before
// V22_START. A day already lived is therefore always replayed under the rules it was lived under, and the live code carries no
// version checks. From V22_START the new rules fold the days after it, starting from the legacy game converted by migrate.ts.
//
// Until V22_START is set (on the owner's approval, the day it deploys) no day is on or after it, so this returns exactly what the
// legacy fold does. Everything the screens import from here (types, helpers) is the legacy module's, passed on.
import type { DayFacts } from './facts.ts'
import { foldGame as foldLegacy } from './legacy/fold.ts'

export * from './legacy/fold.ts'

/** The first day of version 22: the day it deploys. A placeholder far in the future until then. A `let` only so a test can set it (setV22Start). */
export let V22_START = '2099-01-01'
export const setV22Start = (day: string): void => { V22_START = day }

/**
 * The game. Days before V22_START are the legacy game; days from it are the new rules (not built yet: GAME-SPEC-V22.md section 12.5,
 * steps 2 to 7). Until they are, a start date reached early still folds by the legacy rules, so setting one by mistake cannot break the apps.
 */
export function foldGame(facts: DayFacts[], opts: { instant?: boolean } = {}): ReturnType<typeof foldLegacy> {
  return foldLegacy(facts, opts)
}
