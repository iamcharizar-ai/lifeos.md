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
import { isGym, leaderOf } from '../game-core/fold.ts'
import { LEAGUES, lineup } from '../game-core/gyms.ts'
import { itemName as shopName } from '../game-core/economy.ts'
import { REGIONS } from '../game-core/rules.ts'
import type { GameLink } from './gameLink'

// localhost is only a dev default: a production build without VITE_POKEDEX_URL must not point sprites
// and links at the visitor's own machine (blocked as mixed content over https). Empty = not linked.
export const POKEDEX_URL: string = (import.meta.env.VITE_POKEDEX_URL || (import.meta.env.DEV ? 'http://localhost:5190' : '')).replace(/\/$/, '')
export const spriteUrl = (form: string, shiny = false): string => POKEDEX_URL + spritePath(form, shiny)

export function useGame(habits: Habit[], ticks: Ticks, arbor: ArborState, shed: ShedState, link: GameLink, today: string): Game {
  return useMemo(
    () => foldGame(buildFacts({ habits, ticks, arbor, shed, lists: link.lists, body: link.body, uses: link.uses, today })),
    [habits, ticks, arbor, shed, link, today],
  )
}

const itemName = (item: string): string => shopName(item)

// ── moments: say it once when something happens ─────────────────────────────
const SEEN_KEY = 'lifeos.game.seen.v1'
export const momentKey = (m: Moment): string =>
  `${m.day}|${m.kind}|${'form' in m ? m.form : ''}|${'level' in m ? m.level : ''}|${'n' in m ? m.n : ''}|${'item' in m ? m.item : ''}|${'slot' in m ? m.slot : ''}|${'what' in m ? m.what : ''}|${'id' in m ? m.id : ''}`

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
      return { title: 'Fully trained', line: `${nameOf(m.form)} moved into the Pokedex for good.`, form: m.form }
    case 'partner':
      return { title: m.origin === 'egg' ? 'An egg hatched' : 'New partner', line: `${nameOf(m.form)} is your partner now.`, form: m.form }
    case 'catch':
      return { title: m.how === 'perfect' ? 'Perfect day: caught!' : m.how === 'ball' ? 'Caught with a ball!' : 'Gotcha!', line: `${m.shiny ? 'A shiny ' : ''}${nameOf(m.form)} is in your Box.`, form: m.form, shiny: m.shiny }
    case 'appear':
      return { title: m.rarity === 'L' ? 'A legendary appeared' : 'A wild Pokemon appeared', line: `${nameOf(m.form)} is in front of you. Catch it before it gets away.`, form: m.form }
    case 'form':
      return { title: m.what === 'mega' ? 'Mega form' : 'Gigantamax', line: `${nameOf(m.form)} is registered in the Pokedex.`, form: m.form }
    case 'region':
      return { title: 'New region', line: `${REGIONS[m.n - 1]} is open: new species can turn up from now on.` }
    case 'gym': {
      const t = leaderOf(m.league, m.slot), l = LEAGUES[m.league]
      if (!t || !l) return { title: 'Leader beaten', line: 'The next one steps up tomorrow.' }
      if (isGym(m.league, m.slot)) return { title: `${t.badge}${/ Z$/.test(t.badge) ? '' : ' Badge'}`, line: `You beat ${t.name}, gym ${m.slot + 1} of ${l.name}.` }
      return m.slot === lineup(l).length - 1 ? { title: 'Champion', line: `You beat ${t.name}.` } : { title: 'Elite Four', line: `You beat ${t.name}.` }
    }
    case 'league':
      return { title: 'Hall of Fame', line: `The ${LEAGUES[m.league]?.name} league is yours.` }
    case 'key':
      return { title: 'Key Stone', line: 'Three shards now forge a Mega Stone, on a fully evolved Pokemon\'s page in the Pokedex.' }
    case 'mega':
      return { title: 'Mega Stone forged', line: `${nameOf(m.form)} is registered and never runs out.`, form: m.form }
    case 'feat':
      return { title: m.name, line: `A feat reached${m.items.length ? `: ${m.items.map(itemName).join(', ')}` : ''}${m.gems ? `, +${m.gems} gems` : ''}.` }
    case 'transfer':
      return { title: 'To the Professor', line: `${nameOf(m.form)} was sent on: +${m.coins} coins.`, form: m.form }
    case 'season':
      return { title: `Season step ${m.step}`, line: m.coins ? `+${m.coins} coins.` : m.gems ? `+${m.gems} gems.` : `${itemName(m.item)} added to your items.` }
    case 'hatch':
      return { title: 'The egg hatched!', line: `${nameOf(m.form)} is in your Box.`, form: m.form }
    case 'chest':
      return { title: `Chest ${m.n}`, line: m.coins ? `${m.coins} coins.` : `${itemName(m.item)}${m.count > 1 ? ` x${m.count}` : ''}.` }
    case 'quest':
      return { title: 'Quest done', line: `${m.name}: ${m.coins ? `+${m.coins} coins` : `+${m.gems} gems`}.` }
    case 'review':
      return { title: 'Month reviewed', line: 'A Comet Shard is yours. It fits any Mega: three forge a stone.' }
    case 'flee':
      return { title: 'It got away', line: `The wild ${nameOf(m.form)} left. Another one has taken its place.`, form: m.form }
    case 'slip':
      return { title: 'An empty day', line: `Nothing was ticked on ${m.empty}: ${[m.leader ? `the leader won back ${m.leader} HP` : '', m.wild ? `the wild Pokemon ${m.wild}` : '', m.xp ? `${m.xp} XP faded` : ''].filter(Boolean).join(', ')}.` }
    case 'use':
      return m.what === 'branch' ? { title: 'Branch chosen', line: `${nameOf(m.form)} will evolve into ${nameOf(m.to ?? '')}.`, form: m.form }
        : { title: 'New partner', line: `${nameOf(m.form)} came forward.`, form: m.form }
  }
}
