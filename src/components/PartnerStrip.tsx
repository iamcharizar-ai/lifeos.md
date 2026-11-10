// The game, in one card: the partner, its XP bar and the week's pace.
// Everything else lives on the Pokedex site.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { nameOf, type Game, type Moment } from '../game-core/fold.ts'
import { MOMENTUM_OLD_STEPS, MOMENTUM_WINDOW } from '../game-core/rules.ts'
import { POKEDEX_URL, freshMoments, momentKey, momentText, spriteUrl } from '../lib/game'

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

/**
 * The game, in one small card: the partner, its XP bar and the week's pace.
 * Everything else (wallet, foes, rewards) lives on the Pokedex site.
 */
export function PartnerStrip({ game }: { game: Game }) {
  const { partner, today, momentum } = game
  const pct = Math.max(0, Math.min(1, game.into / game.need))
  // the bar has two parts: what was banked before today, and what today added on top
  const before = Math.max(0, Math.min(pct, game.intoBeforeToday / game.need))
  // the seven days before today, oldest first, then today
  const prev = game.days.slice(-(MOMENTUM_WINDOW + 1), -1)
  const missing = MOMENTUM_WINDOW - prev.length
  // the steps come from the rule itself (game-core), so the dots and the multiplier beside them cannot disagree
  const steps = momentum.steps ?? MOMENTUM_OLD_STEPS
  const rule = `Days that counted in the last seven: ${steps.map(([d, m]) => `${d} make XP ×${m}`).join(', ')}. A day counts with two pillars; a good night can be one of them, never the only one. It slides back a day at a time, never resets.`

  return (
    <section className={`dex-card is-lean ${game.aura ? `aura-${game.aura}` : ''}`} aria-label="Your partner">
      <a href={POKEDEX_URL || undefined} target="_blank" rel="noreferrer" className="dex-hero" title={`${nameOf(game.display)}: open the Pokedex`}>
        <Sprite form={game.display} shiny={partner.shiny} size={72} dim={game.asleep} />
        {game.asleep && <span className="partner-zzz" aria-hidden>z z z</span>}
      </a>
      <div className="dex-lean-body">
        <div className="dex-lean-row">
          <span className="dex-lv">Lv {game.level}</span>
          <div
            className="dex-xp"
            data-reward-target="xp"
            role="progressbar"
            aria-label={`Level ${game.level} progress`}
            aria-valuemin={0}
            aria-valuemax={game.need}
            aria-valuenow={Math.round(game.into)}
            aria-valuetext={`${Math.round(game.into)} of ${game.need} XP, ${Math.round(game.into - game.intoBeforeToday)} of it earned today`}
            title={`${Math.round(game.into).toLocaleString('en-IN')} / ${game.need.toLocaleString('en-IN')} XP`}
          >
            <motion.i className="bar-base" animate={{ width: `${before * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
            <motion.i className="bar-today" animate={{ width: `${(pct - before) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
          </div>
        </div>
        <div className="dex-lean-row" title={rule}>
          <span className="dex-week" aria-label={`Momentum: ${momentum.days} of the last 7 days counted`}>
            {Array.from({ length: MOMENTUM_WINDOW }, (_, i) => {
              const d = prev[i - missing]
              return <i key={i} className={d?.counts ? 'on' : d ? 'off' : 'none'} title={d ? `${d.day}: ${d.pillars} of ${d.pillarTotal} pillars` : 'before the game began'} />
            })}
            <i className={`now ${today.counts ? 'on' : ''}`} title={`Today: ${today.pillars} of ${today.pillarTotal} pillars`} />
          </span>
          <b className={`dex-mult ${momentum.mult > 1 ? 'is-hot' : ''}`}>×{momentum.mult}</b>
        </div>
      </div>
    </section>
  )
}

/** Level-ups, evolutions and catches, said once each, a few seconds at a time. */
/** The moments worth stopping for: they are staged in the middle of the screen, not slipped in at the bottom. */
const BIG = new Set<string>(['evolve', 'catch', 'graduate', 'gym', 'league', 'key', 'mega', 'hatch'])

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
