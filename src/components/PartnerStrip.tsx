// The game, in one card: who the partner is, how far today moved it, and what
// is left before a catch. Everything else lives on the Pokedex site.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { leaderOf, nameOf, type Game, type Moment } from '../game-core/fold.ts'
import { BALL_NAME } from '../game-core/rules.ts'
import { POKEDEX_URL, freshMoments, momentKey, momentText, spriteUrl } from '../lib/game'
import { AnimatedNumber } from './AnimatedNumber'

/** A sprite from the Pokedex site; a plain block with the initial if it cannot load. */
function Sprite({ form, shiny, size, dim }: { form: string; shiny?: boolean; size: number; dim?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null)
  const src = spriteUrl(form, shiny)
  if (broken === src)
    return (
      <span className="partner-blank" style={{ width: size, height: size, fontSize: size / 2.4 }} aria-hidden>
        {nameOf(form).slice(0, 1)}
      </span>
    )
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(src)}
      className={`partner-sprite ${dim ? 'is-asleep' : ''}`}
      style={{ width: size, height: size }}
    />
  )
}

export function PartnerStrip({ game, left }: { game: Game; left: number }) {
  const { partner, today, momentum } = game
  const pct = Math.max(0, Math.min(1, game.into / game.need))
  // the bar has two parts: what was banked before today, and what today added on top
  const before = Math.max(0, Math.min(pct, game.intoBeforeToday / game.need))
  const name = nameOf(game.display)
  // what the day is wearing down: the wild Pokemon (by how whole the day is) and the gym leader (by the kind of work)
  const { league, wild } = game
  const foe = leaderOf(league.index, league.slot)
  return (
    <div className={`partner-card ${game.aura ? `aura-${game.aura}` : ''}`}>
      <a href={POKEDEX_URL || undefined} target="_blank" rel="noreferrer" className="partner-frame" title="Open the Pokedex">
        <Sprite form={game.display} shiny={partner.shiny} size={84} dim={game.asleep} />
        {game.asleep && <span className="partner-zzz" aria-hidden>z z z</span>}
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="partner-name">{name}</span>
          <span className="partner-lv">Lv {game.level}</span>
          {partner.shiny && <span className="partner-tag">shiny</span>}
          {game.version >= 5 && (
            <span className="partner-wallet" title="Coins and gems: spend them in the Pokedex">
              <i className="coin" aria-hidden /><AnimatedNumber value={game.wallet.coins} />
              <i className="gem" aria-hidden /><AnimatedNumber value={game.wallet.gems} />
            </span>
          )}
        </div>
        <div
          className="partner-bar"
          role="progressbar"
          aria-label={`Level ${game.level} progress`}
          aria-valuemin={0}
          aria-valuemax={game.need}
          aria-valuenow={game.into}
          aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`}
        >
          <motion.i className="bar-base" animate={{ width: `${before * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
          <motion.i className="bar-today" animate={{ width: `${(pct - before) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
        </div>
        <div className="partner-line">
          <b className="partner-today">
            +<AnimatedNumber value={today.xp} /> XP
          </b>{' '}
          today
          {game.version >= 5 && game.wallet.coinsToday > 0 && <> · <b className="partner-today">+<AnimatedNumber value={game.wallet.coinsToday} /></b> coins</>}
          {game.version >= 6 && marksToday(game) > 0 && <> · <b className="partner-today">+{marksToday(game)}</b> marks</>}
          {momentum.mult > 1 && <> · ×{momentum.mult} momentum</>}
          {game.version >= 6 && game.sleep.state === 'measured' && <> · slept <b className="partner-today">{game.sleep.score}</b></>}
          {game.version >= 6 && game.sleep.state === 'self' && <> · sleep: waiting for the band</>}
          {' · '}
          {game.next.what === 'evolve' ? 'evolves' : 'fully trained'} at Lv {game.next.level}
        </div>
        <div className="partner-line">
          {game.asleep
            ? 'Dozing. One pillar wakes it.'
            : today.perfect
              ? 'Perfect day.'
              : `${left} left for a perfect day · ${today.pillars}/${today.pillarTotal} pillars`}
          {wild && (
            <>
              {' · '}
              {wild.caught ? `${nameOf(wild.form)} caught` : `wild ${nameOf(wild.form)} ${wild.hp}/${wild.max} HP · ${BALL_NAME[today.ball]}${wild.leavesIn !== undefined && wild.leavesIn <= 3 ? (wild.leavesIn === 0 ? ' · leaves tomorrow' : ` · leaves in ${wild.leavesIn + 1} days`) : ''}`}
            </>
          )}
          {foe && !league.waiting && <>{' · '}{foe.name} {league.hp.toLocaleString('en-IN')} HP</>}
        </div>
      </div>
    </div>
  )
}

/** Level-ups, evolutions and catches, said once each, a few seconds at a time. */
/** The moments worth stopping for: they are staged in the middle of the screen, not slipped in at the bottom. */
const BIG = new Set<string>(['evolve', 'catch', 'graduate', 'gym', 'league', 'key', 'mega', 'hatch'])
const marksToday = (g: Game): number => Object.values(g.wallet.marksToday ?? {}).reduce((a, b) => a + b, 0)

export function Moments({ game, today, ready }: { game: Game; today: string; ready: boolean }) {
  const [line, setLine] = useState<Moment[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!ready) return // never announce a half-loaded ledger
    const fresh = freshMoments(game, today)
    if (!fresh.length) return
    // several level-ups in one tick: only the last one is worth saying
    const last = fresh.filter((m, i) => m.kind !== 'level' || !fresh.slice(i + 1).some((x) => x.kind === 'level'))
    // and a level-up still waiting its turn is stale once a newer one arrives
    const newerLevel = last.some((m) => m.kind === 'level')
    setLine((q) => [...q.filter((m) => !(newerLevel && m.kind === 'level')), ...last])
  }, [game, today, ready])

  const current = line[0]
  useEffect(() => {
    if (!current) return
    timer.current = window.setTimeout(() => setLine((q) => q.slice(1)), current.kind === 'level' ? 2600 : 5200)
    return () => window.clearTimeout(timer.current)
  }, [current])

  const text = current ? momentText(current) : null
  return (
    <div className={`moment-wrap ${current && BIG.has(current.kind) ? 'is-big' : ''}`} aria-live="polite">
      <AnimatePresence>
        {current && text && (
          <motion.button
            key={momentKey(current)}
            type="button"
            onClick={() => setLine((q) => q.slice(1))}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`moment moment-${current.kind} ${BIG.has(current.kind) ? 'moment-big' : ''}`}
          >
            {text.form && <span className="moment-art"><Sprite form={text.form} shiny={text.shiny} size={BIG.has(current.kind) ? 96 : 56} /></span>}
            <span className="min-w-0 text-left">
              <span className="moment-title">{text.title}</span>
              <span className="moment-text">{text.line}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
