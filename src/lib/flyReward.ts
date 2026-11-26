// A reward that leaves the row it was earned on and goes to the place it is kept.
//
// In three beats, so it can be followed: it is PUSHED OUT, away from where it is
// going (a short, springy move); it HANGS there for about a second, bobbing a
// little, so there is time to see what it is; then it is PULLED in, slowly at
// first and faster, like a magnet, and the target pulses when it lands.
// The timings come from the motion kit shared with the Pokedex (ui-kit).
// Plain DOM and Web Animations, so it works from a timer without React.
import { EASE, K, config, run } from '../ui-kit/motion.js'
import xpBadgeUrl from '../assets/xp-badge.webp'

/** Where the day's XP lands: the partner's XP bar. */
export const XP_TARGET = '[data-reward-target="xp"]'

/** The sprite a habit's XP flies as, one per point. Loaded up front so the first burst is never blank. */
export const XP_BADGE = xpBadgeUrl
const badgeImg: HTMLImageElement | null = typeof Image !== 'undefined' ? new Image() : null
if (badgeImg) badgeImg.src = XP_BADGE

/** The three beats, in milliseconds. */
export const BEATS = { push: 320, hang: 1050, pull: 1050, land: 180 } as const
export const TOTAL = BEATS.push + BEATS.hang + BEATS.pull + BEATS.land

/** The most badges one habit throws: a core habit's 30 exactly; a pillar's 100 shows as 30 too. */
export const MAX_BADGES = 30

/** A pulse on the target, at most every 90 ms so a swarm landing reads as a stream, not a flicker. */
let lastPulse = 0
function pulse(target: Element): void {
  const now = performance.now()
  if (now - lastPulse < 90) return
  lastPulse = now
  target.classList.remove('reward-pulse')
  void (target as HTMLElement).offsetWidth // restart it if one is still running
  target.classList.add('reward-pulse')
  window.setTimeout(() => target.classList.remove('reward-pulse'), 400)
}

/** Where a row's reward starts: by the XP number on its right. */
function origin(from: Element) {
  const a = from.getBoundingClientRect()
  return { sx: a.left + a.width - 56, sy: a.top + a.height / 2 }
}

/** Where it lands: on the XP bar, a little in from its left. */
function landing(target: Element) {
  const b = target.getBoundingClientRect()
  return { tx: b.left + Math.min(b.width * 0.5, 120), ty: b.top + b.height / 2, bw: b.width }
}

/** One label pill flown along a single path (the Comet Shard). */
export function flyReward(from: Element, label: string, targetSelector: string = XP_TARGET, delay = 0): void {
  const target = document.querySelector(targetSelector)
  if (!target || config.reduced) return
  const { sx, sy } = origin(from)
  const { tx, ty } = landing(target)
  // pushed out: directly away from the target, far enough to read as a decision (but never off the screen)
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const away = Math.min(70, Math.max(24, window.innerHeight - sy - 20))
  const px = sx - ((tx - sx) / len) * away
  const py = Math.min(window.innerHeight - 24, sy - ((ty - sy) / len) * away)

  const el = document.createElement('div')
  el.className = 'fly-reward'
  el.textContent = label
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)

  const hangAt = BEATS.push, pullAt = BEATS.push + BEATS.hang, landAt = pullAt + BEATS.pull
  // x, y are absolute screen pixels; `translate` on the element centres it, so these only move it
  void run(el, K(TOTAL, [
    [0, { t: { x: sx, y: sy, s: 0.6 }, o: 0 }, EASE.out],
    [hangAt, { t: { x: px, y: py, s: 1.2 }, o: 1 }, EASE.inOut],
    [hangAt + BEATS.hang * 0.3, { t: { x: px, y: py - 4, s: 1.16 }, o: 1 }, EASE.inOut],
    [hangAt + BEATS.hang * 0.65, { t: { x: px, y: py + 3, s: 1.2 }, o: 1 }, EASE.inOut],
    [pullAt, { t: { x: px, y: py, s: 1.18 }, o: 1 }, EASE.in], // slow to start, quick at the end: a magnet
    [landAt, { t: { x: tx, y: ty, s: 0.55 }, o: 1 }, EASE.out],
    [TOTAL, { t: { x: tx, y: ty, s: 0.3 }, o: 0 }],
  ]), { dur: TOTAL, delay, fill: 'forwards' }).then(() => {
    el.remove()
    pulse(target)
  })
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** One badge in flight. Times are performance.now() milliseconds; positions are screen pixels. */
interface Badge {
  start: number; pushAt: number; pullAt: number; landAt: number; end: number
  sx: number; sy: number; px: number; py: number; cx: number; cy: number; lx: number; ly: number
  s: number; rot: number; bob: number; phase: number; target: Element
}

// All badges are drawn on one canvas laid over the page, not as an element each: a few dozen
// elements animating at once is enough to freeze a phone, while one canvas costs the same as
// one moving picture however many badges are on it. It exists only while something is flying.
const BADGE_W = 26, BADGE_H = 22
const flying: Badge[] = []
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let frame = 0

function fit(): void {
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function draw(now: number): void {
  if (!canvas || !ctx) return
  fit()
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  for (let i = flying.length - 1; i >= 0; i--) {
    const b = flying[i]
    if (now >= b.end) { flying.splice(i, 1); pulse(b.target); continue }
    if (now < b.start) continue
    let x: number, y: number, sc: number, r: number, o = 1
    if (now < b.pushAt) { // pushed out of the row into the cloud
      const t = easeOut((now - b.start) / (b.pushAt - b.start))
      x = b.sx + (b.px - b.sx) * t; y = b.sy + (b.py - b.sy) * t
      sc = b.s * (0.3 + 0.7 * t); r = b.rot * t; o = Math.min(1, t * 3)
    } else if (now < b.pullAt) { // hanging there, bobbing a little
      const t = (now - b.pushAt) / (b.pullAt - b.pushAt)
      x = b.px; y = b.py + Math.sin(b.phase + t * Math.PI * 2) * b.bob * easeInOut(Math.min(1, t * 4))
      sc = b.s; r = b.rot
    } else if (now < b.landAt) { // pulled in along its own curve, creeping off then snapping in: a magnet
      const u = (now - b.pullAt) / (b.landAt - b.pullAt), q = Math.pow(u, 2.2), m = 1 - q
      x = m * m * b.px + 2 * m * q * b.cx + q * q * b.lx
      y = m * m * b.py + 2 * m * q * b.cy + q * q * b.ly
      sc = b.s - (b.s - 0.5) * u; r = b.rot * (1 - u)
    } else { // landed: shrinks into the bar
      const t = (now - b.landAt) / (b.end - b.landAt)
      x = b.lx; y = b.ly; sc = 0.5 - 0.25 * t; r = 0; o = 1 - t
    }
    ctx.globalAlpha = o
    ctx.save()
    ctx.translate(x, y)
    if (r) ctx.rotate((r * Math.PI) / 180)
    ctx.drawImage(badgeImg as HTMLImageElement, (-BADGE_W * sc) / 2, (-BADGE_H * sc) / 2, BADGE_W * sc, BADGE_H * sc)
    ctx.restore()
  }
  ctx.globalAlpha = 1
  if (flying.length) frame = requestAnimationFrame(draw)
  else { canvas.remove(); canvas = null; ctx = null; frame = 0 }
}

function ensureCanvas(): void {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'xp-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)
  ctx = canvas.getContext('2d')
  fit()
}

/**
 * A habit's XP as a burst of badges, one per point up to MAX_BADGES: they spray
 * out into a cloud on the side away from the bar, hang there bobbing, then are
 * pulled in one after another, each on its own curve, so the whole swarm can be
 * seen and not just the one on top. The bar pulses as they land.
 */
export function flyXpBurst(from: Element, xp: number, delay = 0): void {
  const target = document.querySelector(XP_TARGET)
  if (!target || config.reduced || !badgeImg || !(xp > 0)) return
  const n = Math.min(Math.round(xp), MAX_BADGES)
  const { sx, sy } = origin(from)
  const { tx, ty, bw } = landing(target)
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const away = Math.atan2(-(ty - sy) / len, -(tx - sx) / len) // the side away from the bar
  const cloud = 22 + 9.5 * Math.sqrt(n) // the cloud grows with the XP: 1 → 32px, 30 → 74px
  const W = window.innerWidth, H = window.innerHeight
  const spread = Math.min(320, 10 * n) // they leave the row as a quick fountain, not all at once
  const landSpread = Math.min(bw * 0.4, 90)
  const t0 = performance.now() + delay

  for (let i = 0; i < n; i++) {
    const ang = away + rand(-0.75, 0.75) * Math.PI * 0.8 // a wide fan, denser near the middle
    const r = cloud * (0.3 + 0.7 * Math.sqrt(Math.random()))
    const px = clamp(sx + Math.cos(ang) * r, 14, W - 14)
    const py = clamp(sy + Math.sin(ang) * r, 14, H - 14)
    const start = t0 + (i / n) * spread
    const pushAt = start + BEATS.push
    const pullAt = pushAt + BEATS.hang * rand(0.75, 1.05) + (i / n) * 500 // the first out is the first pulled in
    const landAt = pullAt + BEATS.pull * rand(0.65, 0.95)
    // the pull is a curve: a control point off to one side of the straight line, so the paths fan apart
    const lx = tx + rand(-0.5, 0.5) * landSpread, ly = ty
    const dl = Math.hypot(lx - px, ly - py) || 1
    const bend = rand(-1, 1) * Math.min(dl * 0.35, 150)
    flying.push({
      start, pushAt, pullAt, landAt, end: landAt + BEATS.land,
      sx, sy, px, py, lx, ly,
      cx: (px + lx) / 2 + (-(ly - py) / dl) * bend,
      cy: (py + ly) / 2 + ((lx - px) / dl) * bend,
      s: rand(0.8, 1.15), rot: rand(-18, 18), bob: rand(2, 4), phase: rand(0, Math.PI * 2), target,
    })
  }
  ensureCanvas()
  if (!frame) frame = requestAnimationFrame(draw)
}
