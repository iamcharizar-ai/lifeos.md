import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// F4 signature: spending XP is a physical act — drag the coin, feed the slot.
// The ritual is the point: paying should cost a gesture, not a tap.

const COIN_SIZE = 68

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  ttl: number
  size: number
  color: string
}

/** Gold/ember spark burst out of the slot mouth. Self-cleaning rAF loop. */
function igniteBurst(canvas: HTMLCanvasElement, cx: number, cy: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const parts: Particle[] = []
  for (let i = 0; i < 26; i++) {
    // sparks vent upward out of the slot, fanned ±65°
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.3
    const speed = 2.2 + Math.random() * 3.6
    parts.push({
      x: cx + (Math.random() - 0.5) * 34,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      ttl: 420 + Math.random() * 260,
      size: 1.5 + Math.random() * 2,
      color: Math.random() < 0.72 ? '#f0b429' : '#ff5c38',
    })
  }

  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(now - last, 32)
    last = now
    ctx.clearRect(0, 0, rect.width, rect.height)
    let alive = false
    for (const p of parts) {
      p.life += dt
      if (p.life >= p.ttl) continue
      alive = true
      p.x += p.vx * (dt / 16)
      p.y += p.vy * (dt / 16)
      p.vy += 0.09 * (dt / 16) // gravity pulls sparks back down
      const fade = 1 - p.life / p.ttl
      ctx.globalAlpha = fade
      ctx.fillStyle = p.color
      ctx.fillRect(p.x, p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1
    if (alive) requestAnimationFrame(tick)
    else ctx.clearRect(0, 0, rect.width, rect.height)
  }
  requestAnimationFrame(tick)
}

function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
}

export function CoinSlot({
  cost,
  affordable,
  onCommit,
}: {
  cost: number
  affordable: boolean
  /** Fires exactly once per successful insert — caller emits the spend event. */
  onCommit: () => void
}) {
  const reduced = useReducedMotion()
  const frameRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hot, setHot] = useState(false) // coin hovering over the slot
  const [feeding, setFeeding] = useState(false) // commit animation running
  const coinKey = useRef(0) // remount coin after each insert → fresh drag state

  const overSlot = useCallback((px: number, py: number) => {
    const slot = slotRef.current?.getBoundingClientRect()
    if (!slot) return false
    // generous target: the slot line plus a thumb-sized halo
    return (
      px >= slot.left - 12 && px <= slot.right + 12 && py >= slot.top - 26 && py <= slot.bottom + 30
    )
  }, [])

  const commit = useCallback(() => {
    setFeeding(true)
    buzz([12, 40, 18])
    const frame = frameRef.current?.getBoundingClientRect()
    const slot = slotRef.current?.getBoundingClientRect()
    if (canvasRef.current && frame && slot && !reduced) {
      igniteBurst(
        canvasRef.current,
        slot.left + slot.width / 2 - frame.left,
        slot.top + 2 - frame.top,
      )
    }
    onCommit()
    window.setTimeout(() => {
      coinKey.current += 1
      setFeeding(false)
      setHot(false)
    }, 650)
  }, [onCommit, reduced])

  // never leave a stale hot state if affordability flips mid-gesture
  useEffect(() => {
    if (!affordable) setHot(false)
  }, [affordable])

  return (
    <div ref={frameRef} className="relative select-none">
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />

      {/* coin tray */}
      <div className="flex h-24 items-center justify-center">
        <AnimatePresence mode="wait">
          {!feeding && (
            <motion.div
              key={coinKey.current}
              drag={affordable && !reduced}
              dragSnapToOrigin
              dragElastic={0.14}
              dragMomentum={false}
              whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
              whileTap={affordable ? { scale: 1.04 } : undefined}
              onDragStart={() => buzz(8)}
              onDrag={(_, info) => setHot(overSlot(info.point.x, info.point.y))}
              onDragEnd={(_, info) => {
                if (affordable && overSlot(info.point.x, info.point.y)) commit()
                else setHot(false)
              }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, y: 26, opacity: 0, transition: { duration: 0.16 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className={`relative z-10 touch-none ${affordable ? 'cursor-grab' : ''}`}
              style={{ width: COIN_SIZE, height: COIN_SIZE }}
              aria-label={`XP coin worth ${cost}`}
            >
              {/* the coin: struck gold, milled edge, cost engraved */}
              <div
                className={`flex h-full w-full flex-col items-center justify-center rounded-full border-2 ${
                  affordable
                    ? 'border-gold bg-[radial-gradient(circle_at_32%_28%,#f6cd62,#f0b429_46%,#9a7418_100%)] shadow-[0_4px_16px_-4px_rgba(240,180,41,0.45),inset_0_-3px_6px_rgba(0,0,0,0.35)]'
                    : 'border-line bg-plate2 opacity-45'
                }`}
              >
                <span
                  className={`num text-base font-bold leading-none ${
                    affordable ? 'text-ink' : 'text-dim'
                  }`}
                >
                  −{cost}
                </span>
                <span
                  className={`font-display text-[8px] font-bold tracking-[0.2em] ${
                    affordable ? 'text-ink/70' : 'text-dim'
                  }`}
                >
                  XP
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the slot — an aperture cut into the machine */}
      <div className="flex flex-col items-center gap-2 pb-1">
        <div
          ref={slotRef}
          className={`coin-slot h-3.5 w-40 transition-colors duration-150 ${
            hot ? 'coin-slot-hot' : ''
          }`}
        />
        <div className="num text-[10px] text-dim">
          {!affordable
            ? 'balance too low — earn first'
            : feeding
              ? 'coin accepted'
              : reduced
                ? 'tap below to spend'
                : hot
                  ? 'release to spend'
                  : 'drag the coin into the slot'}
        </div>
        {(reduced || !('ontouchstart' in window)) && affordable && !feeding && (
          <button
            onClick={commit}
            className="chip border border-gold-dim bg-gold/10 px-4 py-1.5 font-display text-[10px] font-semibold uppercase tracking-wider text-gold"
          >
            Insert coin · −{cost} XP
          </button>
        )}
      </div>
    </div>
  )
}
