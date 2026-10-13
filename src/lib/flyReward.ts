// A reward that leaves the row it was earned on and goes to the place it is kept.
//
// In three beats, so it can be followed: it is PUSHED OUT, away from where it is
// going (a short, springy move); it HANGS there for about a second, bobbing a
// little, so there is time to see what it is; then it is PULLED in, slowly at
// first and faster, like a magnet, and the target pulses when it lands.
// The timings come from the motion kit shared with the Pokedex (ui-kit).
// Plain DOM and Web Animations, so it works from a timer without React.
import { EASE, K, config, run } from '../ui-kit/motion.js'

/** Where the day's XP lands: the partner's XP bar. */
export const XP_TARGET = '[data-reward-target="xp"]'

/** The three beats, in milliseconds. */
export const BEATS = { push: 320, hang: 1050, pull: 1050, land: 180 } as const
export const TOTAL = BEATS.push + BEATS.hang + BEATS.pull + BEATS.land

export function flyReward(from: Element, label: string, targetSelector: string = XP_TARGET, delay = 0): void {
  const target = document.querySelector(targetSelector)
  if (!target || config.reduced) return
  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const sx = a.left + a.width - 56
  const sy = a.top + a.height / 2
  const tx = b.left + Math.min(b.width * 0.5, 120)
  const ty = b.top + b.height / 2
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
    target.classList.remove('reward-pulse')
    void (target as HTMLElement).offsetWidth // restart the pulse if two land together
    target.classList.add('reward-pulse')
    window.setTimeout(() => target.classList.remove('reward-pulse'), 400)
  })
}
