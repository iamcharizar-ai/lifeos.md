// A pillar's reward on its habit tile: the egg or shard its counter reaches for, as a ghost that fills from the bottom with the
// counter, glows when it is ready, and wears a small sparkle while a neglect bounty is waiting. No numbers and no words: those live
// in the Pokedex, which a tap (or a long press) opens on that pillar's shop. Everything it shows is the shared core's
// `game.tiles` (game-core/fold.ts); nothing here decides anything.
import type { Game } from '../game-core/fold.ts'
import { itemName } from '../game-core/economy.ts'
import { POKEDEX_URL, itemUrl } from '../lib/game'

type Tile = NonNullable<Game['tiles'][keyof Game['tiles']]>

export function RewardGhost({ tile, tag }: { tile: Tile; tag: string }) {
  // every kind of egg is the one egg sprite, tinted in its pillar's colour (the Pokedex draws it the same way)
  const egg = tile.iconId.startsWith('egg-') || tile.iconId === 'rare-egg' || tile.iconId === 'trail-egg'
  const src = itemUrl(egg ? 'mystery-egg' : tile.iconId)
  if (!src) return null
  const fill = Math.max(0, Math.min(1, tile.fill))
  const label = `${itemName(tile.iconId)}: ${tile.ready ? 'ready in the Pokedex' : `${Math.round(fill * 100)}% of the way`}${tile.bountyActive ? ', a bounty waiting' : ''}`
  const body = (
    <>
      <img className="rg-ghost" src={src} alt="" draggable={false} />
      <img className={`rg-fill ${egg ? `rg-tint-${tile.iconId}` : ''}`} src={src} alt="" draggable={false} style={{ clipPath: `inset(${((1 - fill) * 100).toFixed(1)}% 0 0 0)` }} />
      {/* the badge's place is always there, so the tile never moves when a bounty comes or goes */}
      <span className={`rg-badge ${tile.bountyActive ? 'on' : ''}`} aria-hidden>✦</span>
    </>
  )
  const cls = `reward-ghost ${tile.ready ? 'is-ready' : ''}`
  return POKEDEX_URL ? (
    <a className={cls} href={`${POKEDEX_URL}/?open=counter:${tag}`} target="_blank" rel="noreferrer" aria-label={label} title={label} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {body}
    </a>
  ) : (
    <span className={cls} role="img" aria-label={label} title={label}>{body}</span>
  )
}
