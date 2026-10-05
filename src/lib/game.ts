// The game side of LifeOS.
//
// Nothing is stored: the partner, its level and the collection are worked out
// from the habits, the ticks and the two linked blocks every time they change,
// by the same core the Pokedex site runs (game-core/, copied from that repo).
// The sprites are not in this repo either: they are loaded from the Pokedex
// site by URL.
import { useMemo } from 'react'
import { buildFacts } from '../game-core/facts.ts'
import { foldGame, nameOf, spritePath, type Game, type Moment } from '../game-core/fold.ts'
import type { Habit } from '../config/habits'
import type { Ticks } from './store'
import type { ArborState } from '../arbor-core/model.ts'
import type { ShedState } from '../woodshed-core/model.ts'
import { leaderOf } from '../game-core/fold.ts'
import { BADGES_PER_REGION, ITEM_NAME, MEGA_DAYS, REGIONS } from '../game-core/rules.ts'
import type { GameLink } from './gameLink'

export const POKEDEX_URL: string = (import.meta.env.VITE_POKEDEX_URL ?? 'http://localhost:5190').replace(/\/$/, '')
export const spriteUrl = (form: string, shiny = false): string => POKEDEX_URL + spritePath(form, shiny)

export function useGame(habits: Habit[], ticks: Ticks, arbor: ArborState, shed: ShedState, link: GameLink, today: string): Game {
  return useMemo(
    () => foldGame(buildFacts({ habits, ticks, arbor, shed, body: link.body, uses: link.uses, today })),
    [habits, ticks, arbor, shed, link, today],
  )
}

const itemName = (item: string): string => ITEM_NAME[item] ?? item

// ── moments: say it once when something happens ─────────────────────────────
const SEEN_KEY = 'lifeos.game.seen.v1'
export const momentKey = (m: Moment): string =>
  `${m.day}|${m.kind}|${'form' in m ? m.form : ''}|${'level' in m ? m.level : ''}|${'n' in m ? m.n : ''}|${'item' in m ? m.item : ''}|${'slot' in m ? m.slot : ''}|${'what' in m ? m.what : ''}`

function loadSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

/**
 * Today's moments this device has not shown yet, and marks them shown. The
 * first run on a device shows nothing: history is not news.
 */
export function freshMoments(game: Game, today: string): Moment[] {
  const seen = loadSeen()
  const mine = game.moments.filter((m) => m.day === today)
  const fresh = seen ? mine.filter((m) => !seen.has(momentKey(m))) : []
  if (!seen || fresh.length) {
    // only today's keys are worth keeping
    const keep = [...(seen ?? [])].filter((k) => k.startsWith(today)).concat(mine.map(momentKey))
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(keep)]))
    } catch {
      /* quota: the worst case is a repeated toast */
    }
  }
  return fresh
}

export function momentText(m: Moment): { title: string; line: string; form?: string; shiny?: boolean } {
  switch (m.kind) {
    case 'level':
      return { title: `Level ${m.level}`, line: `${nameOf(m.form)} grew to level ${m.level}.`, form: m.form }
    case 'evolve':
      return { title: 'Evolved', line: `${nameOf(m.from)} evolved into ${nameOf(m.form)}${m.picked ? ', the way you chose' : ''}.`, form: m.form }
    case 'graduate':
      return { title: 'Fully trained', line: `${nameOf(m.form)} moved into the Pokedex for good${m.bond ? ', with a Bond ribbon' : ''}.`, form: m.form }
    case 'partner':
      return { title: m.origin === 'egg' ? 'An egg hatched' : 'New partner', line: `${nameOf(m.form)} is your partner now.`, form: m.form }
    case 'catch':
      return { title: `Perfect day #${m.n}`, line: `${m.shiny ? 'A shiny ' : ''}${nameOf(m.form)} joined the queue.`, form: m.form, shiny: m.shiny }
    case 'form':
      return { title: m.what === 'mega' ? 'Mega form' : 'Gigantamax', line: `${nameOf(m.form)} is registered in the Pokedex.`, form: m.form }
    case 'badge':
      return { title: `Badge #${m.n}`, line: 'Five solid days this week.' }
    case 'region':
      return { title: 'New region', line: `${REGIONS[m.n - 1]} is open: new species can turn up from now on.` }
    case 'gym': {
      const l = leaderOf(m.region, m.slot)
      if (m.slot < BADGES_PER_REGION) return { title: `${l?.badge}${/ Z$/.test(l?.badge ?? '') ? '' : ' Badge'}`, line: `You beat ${l?.name}, gym ${m.slot + 1} of ${REGIONS[m.region - 1]}.` }
      return m.slot < BADGES_PER_REGION + 4 ? { title: 'Elite Four', line: `You beat ${l?.name}.` } : { title: 'Champion', line: `You beat ${l?.name}.` }
    }
    case 'league':
      return { title: 'League beaten', line: `The ${REGIONS[m.region - 1]} league is yours.` }
    case 'item':
      return { title: 'A stone', line: `${itemName(m.item)} is in your Bag. Spend it in the Pokedex if you like; nothing needs it.` }
    case 'use':
      return m.what === 'mega' ? { title: 'Mega Evolution', line: `${nameOf(m.form)} Mega Evolves for ${MEGA_DAYS} days.`, form: m.to ?? m.form }
        : m.what === 'branch' ? { title: 'Branch chosen', line: `${nameOf(m.form)} will evolve into ${nameOf(m.to ?? '')}.`, form: m.form }
        : { title: 'New partner', line: `${nameOf(m.form)} came forward.`, form: m.form }
  }
}
