/**
 * motion.js — framework-agnostic motion kit (Web Animations API, no dependencies).
 *
 * Every number below was MEASURED from the shipped Clash Royale animation data
 * (decoded SC2 timelines, 60/30 fps) — see ../ANIMATION_SPEC.md for sources.
 * Distances are in "u" (design units). In the source UI one card is ~250u wide,
 * so setUnit(cardWidthInPx / 250) makes motion scale with your own layout.
 *
 * Only the CHOREOGRAPHY (timing, easing, scale, tint curves) is reproduced.
 * No art, sprites or audio from the source game are included or required.
 */

/* ----------------------------- configuration ----------------------------- */
export const config = {
  unit: 1,        // px per design unit (see header)
  speed: 1,       // global time multiplier (2 = twice as fast)
  reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
};
export const setUnit = (px) => { config.unit = px; };
const u = (n) => n * config.unit;
const ms = (n) => n / config.speed;

/* ------------------------------- constants ------------------------------- */
// Easing buckets measured from the data. The game mostly uses LINEAR fades and
// ease-out / ease-in on moves; "slam" is the late-peaking S-curve of shard hits.
export const EASE = {
  linear: 'linear',
  out:   'cubic-bezier(0.16, 0.84, 0.30, 1)',
  in:    'cubic-bezier(0.70, 0.00, 0.84, 0.30)',
  inOut: 'cubic-bezier(0.65, 0.00, 0.35, 1)',
  slam:  'cubic-bezier(0.85, 0.00, 0.25, 1)',
  snap:  'steps(1, end)',
};

// House-style durations (ms): medians / modes across ~1,300 UI clips.
export const T = {
  fadeIn: 133, fadeOut: 133,          // median; modes 67/100/167/233
  pop: 250,                           // large pop-in (modes 250/267)
  slide: 183, slideLong: 400,         // median / common long slide
  stampIn: 167,                       // title stamp 1.6 -> 0.9
  exit: 167,
  claimBounceUp: 617, claimBounceDown: 517,
};

/* ------------------------------- primitives ------------------------------- */
const tf = ({ x = 0, y = 0, s = 1, sx, sy, r = 0 } = {}) =>
  `translate(${u(x)}px, ${u(y)}px) rotate(${r}deg) scale(${sx ?? s}, ${sy ?? s})`;
export { tf };

/** Build keyframes from absolute-time stops: [[tMs, props, easingToNext], ...]. */
export function K(total, stops) {
  return stops.map(([t, p, e]) => {
    const f = { offset: Math.min(1, t / total) };
    if (p.t) f.transform = tf(p.t);
    if (p.o !== undefined) f.opacity = p.o;
    if (p.f !== undefined) f.filter = p.f;
    if (e) f.easing = e;
    return f;
  });
}

/** Run keyframes on an element; resolves when finished. */
export function run(el, keyframes, { dur, delay = 0, ease = 'linear', fill = 'both', iterations = 1 } = {}) {
  if (!el) return Promise.resolve();
  const a = el.animate(keyframes, {
    duration: ms(dur), delay: ms(delay), easing: ease, fill, iterations,
  });
  return a.finished.catch(() => {});
}

export const wait = (t) => new Promise((r) => setTimeout(r, ms(t)));
export const stopAll = (root) => root.getAnimations({ subtree: true }).forEach((a) => a.cancel());

/** Additive colour flash (the game tints sprites with additive RGB that fades to 0). */
export function flash(host, color = '#ff00ff', { dur = 283, peak = 1, ease = EASE.in, delay = 0 } = {}) {
  if (config.reduced) return Promise.resolve();
  const o = document.createElement('i');
  o.style.cssText = `position:absolute;inset:0;pointer-events:none;border-radius:inherit;
    background:${color};mix-blend-mode:plus-lighter;opacity:0`;
  host.appendChild(o);
  return run(o, [{ opacity: peak }, { opacity: 0 }], { dur, ease, delay })
    .then(() => o.remove());
}

/* -------------------------------- motions --------------------------------- */
export const motion = {
  /** Linear fade (the game's default). */
  fadeIn: (el, d = T.fadeIn, delay = 0) => run(el, [{ opacity: 0 }, { opacity: 1 }], { dur: d, delay }),
  fadeOut: (el, d = T.fadeOut, delay = 0) => run(el, [{ opacity: 1 }, { opacity: 0 }], { dur: d, delay }),

  /** Pop-in with settle. Data: text_evolution_unlocked scale 0.2->1.08 (167) ->0.97 (83) ->1.02 (100). a 0->1 in 167. */
  popIn(el, { delay = 0, from = 0.2, peak = 1.08 } = {}) {
    const D = 450;
    return run(el, K(D, [
      [0,   { t: { s: from }, o: 0 }, EASE.out],
      [167, { t: { s: peak }, o: 1 }, EASE.inOut],
      [250, { t: { s: 0.97 }, o: 1 }, EASE.inOut],
      [350, { t: { s: 1.02 }, o: 1 }, EASE.inOut],
      [D,   { t: { s: 1 }, o: 1 }],
    ]), { dur: D, delay });
  },

  /** Slide up with overshoot + settle. Data: text_evolution y +74 -> -7 (250ms out), +10 (100), -5 (83), 0 (83); alpha 0->1 in 167. */
  slideUp(el, { dist = 74, delay = 0 } = {}) {
    const D = 520;
    return run(el, K(D, [
      [0,   { t: { y: dist }, o: 0 }, EASE.out],
      [250, { t: { y: -dist * 0.1 }, o: 1 }, EASE.out],
      [350, { t: { y: dist * 0.14 }, o: 1 }, EASE.inOut],
      [433, { t: { y: -dist * 0.03 }, o: 1 }, EASE.in],
      [D,   { t: { y: 0 }, o: 1 }],
    ]), { dur: D, delay });
  },

  /** Title "stamp": scale 1.6 -> 0.9 in 167 (linear) with additive white flash, then 1.0. Data: print_overtime_challenge. */
  stampIn(el, { delay = 0, from = 1.6, flashColor = '#fff' } = {}) {
    flash(el, flashColor, { dur: 267, peak: 0.6, ease: EASE.linear, delay });
    return run(el, K(300, [
      [0,   { t: { s: from }, o: 0 }],
      [17,  { t: { s: from }, o: 1 }, EASE.linear],   // alpha snaps on in one frame
      [167, { t: { s: 0.9 }, o: 1 }, EASE.out],
      [300, { t: { s: 1 }, o: 1 }],
    ]), { dur: 300, delay });
  },

  /** Evolution-shard slam: scale 4 -> 1 over 400ms (late-peaking S-curve) with magenta additive flash fading in 283. */
  slam(el, { from = 4, delay = 0, color = '#ff00ff' } = {}) {
    flash(el, color, { dur: 283, delay, ease: EASE.in });
    return run(el, K(400, [[0, { t: { s: from }, o: 1 }], [400, { t: { s: 1 }, o: 1 }]]),
      { dur: 400, delay, ease: EASE.slam });
  },

  /** Pulse up and back (card_full_shards: 1 -> 1.24 -> 1, 133ms each, with +60 additive glow). */
  pulse(el, { to = 1.24, up = 133, down = 133, delay = 0, glow = 'drop-shadow(0 0 14px #a050ff)' } = {}) {
    const D = up + down;
    return run(el, K(D, [
      [0,  { t: { s: 1 },  f: 'none' }, EASE.inOut],
      [up, { t: { s: to }, f: glow },    EASE.inOut],
      [D,  { t: { s: 1 },  f: 'none' }],
    ]), { dur: D, delay });
  },

  /** Claim button breathing: 1 -> 1.21 (617 ease-in) -> 1 (517 ease-out), loops (period 1.23s). */
  claimBounce(el, { to = 1.21 } = {}) {
    const D = T.claimBounceUp + T.claimBounceDown;
    return run(el, K(D, [
      [0, { t: { s: 1 } }, EASE.in],
      [T.claimBounceUp, { t: { s: to } }, EASE.out],
      [D, { t: { s: 1 } }],
    ]), { dur: D, iterations: Infinity });
  },

  /** Unit deploy drop with squash & stretch (filter_deploy_unit_default, 583ms). */
  deployDrop(el, { height = 65, legendary = false, delay = 0 } = {}) {
    if (legendary) {
      return run(el, K(517, [
        [0,   { t: { y: -248, sx: 0.28, sy: 1.64 }, o: 0.4 }, EASE.in],
        [183, { t: { y: -50, sx: 1.0, sy: 1.2 }, o: 1 }],
        [233, { t: { y: 0, sx: 1.27, sy: 0.91 }, o: 1 }, EASE.linear],
        [317, { t: { sx: 0.98, sy: 1.12 }, o: 1 }, EASE.linear],
        [400, { t: { sx: 1.08, sy: 0.99 }, o: 1 }, EASE.linear],
        [517, { t: { sx: 1, sy: 1 }, o: 1 }],
      ]), { dur: 517, delay });
    }
    flash(el, '#fff', { dur: 250, peak: 0.55, delay });
    return run(el, K(583, [
      [0,   { t: { y: -height, sx: 0.87, sy: 1.32 }, o: 0.4 }, EASE.linear],
      [183, { t: { y: -height * 0.2, sx: 0.87, sy: 1.32 }, o: 1 }, EASE.linear],
      [233, { t: { y: 0, sx: 0.87, sy: 1.32 }, o: 1 }],
      [250, { t: { y: 0, sx: 1.33, sy: 0.91 }, o: 1 }, EASE.linear],   // impact: snap to squash
      [367, { t: { sx: 0.98, sy: 1.12 }, o: 1 }, EASE.linear],
      [450, { t: { sx: 1.08, sy: 0.99 }, o: 1 }, EASE.linear],
      [567, { t: { sx: 1, sy: 1 }, o: 1 }],
    ]), { dur: 583, delay });
  },

  /** Hit recoil: knock 4u away for 83ms and stretch 11% (filter_damage_*). Wobble variant: 100ms. */
  recoil(el, { dir = 'up', wobble = false } = {}) {
    const v = { up: [0, 4], down: [0, -4], left: [4, 0], right: [-4, 0] }[dir];
    if (wobble) return run(el, K(100, [[0, { t: { sx: 1, sy: 1 } }], [50, { t: { sx: 0.98, sy: 1.11 } }], [100, { t: { sx: 1.01, sy: 0.98 } }]]), { dur: 100 });
    return run(el, K(83, [[0, { t: { x: v[0], y: -v[1], sy: 1.11 } }], [83, { t: { sy: 1 } }]]), { dur: 83 });
  },

  /** Status tint pulses measured from filter_heal / filter_poison / filter_rage (additive, fades). */
  statusTint(el, kind = 'heal') {
    const cfg = {
      heal:   { c: '#505000', peak: 0.9, dur: 617 },                   // yellow, 50 -> 80 -> 50 (add)
      poison: { c: '#003c00', peak: 0.5, dur: 617 },                   // green, 0 -> 17 (add)
      rage:   { c: '#96088f', peak: 0.9, dur: 1667, iterations: 3 },   // purple, 100 <-> 150 loop
    }[kind];
    return flash(el, cfg.c, { dur: cfg.dur, peak: cfg.peak, ease: EASE.inOut });
  },

  /** Expanding shockwave ring (card_evolution_slot ring: scale 1 -> 6.5 over 933ms linear, fade last 130ms). */
  ringShock(host, { color = '#ffd9a8', size = 40, x = 0, y = 0, dur = 933, to = 6.5 } = {}) {
    if (config.reduced) return Promise.resolve();
    const r = document.createElement('i');
    r.style.cssText = `position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin:${-size / 2 + y}px 0 0 ${-size / 2 + x}px;
      border-radius:50%;border:3px solid ${color};box-shadow:0 0 18px ${color};pointer-events:none;opacity:0`;
    host.appendChild(r);
    return run(r, K(dur, [[0, { t: { s: 1 }, o: 1 }], [dur - 133, { t: { s: to * 0.9 }, o: 1 }], [dur, { t: { s: to }, o: 0 }]]),
      { dur, ease: EASE.linear }).then(() => r.remove());
  },

  /** Slow rotating sunburst/godray (evolution unlock: 120deg over ~4s, linear). */
  sunburst(el, { deg = 120, dur = 3983, delay = 0 } = {}) {
    return run(el, [{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }], { dur, delay });
  },

  /** Diagonal shine sweep across a card (x -196 -> 162 over 700ms ease-in-out, alpha peaks .6). */
  shineSweep(el, { width = 250, delay = 0 } = {}) {
    return run(el, K(700, [
      [0,   { t: { x: -width * 0.78, s: 0.28 }, o: 0.03 }, EASE.inOut],
      [350, { t: { x: -width * 0.07, s: 0.9 }, o: 0.6 }, EASE.inOut],
      [700, { t: { x: width * 0.65, s: 0.39 }, o: 0.05 }],
    ]), { dur: 700, delay, ease: EASE.inOut });
  },

  /** Idle float used by legendary glows (bob +-10u over ~2.3s, repeating). */
  float(el, { amp = 10, dur = 4600 } = {}) {
    return run(el, [{ transform: tf({ y: amp }) }, { transform: tf({ y: -amp }) }, { transform: tf({ y: amp }) }],
      { dur, ease: EASE.inOut, iterations: Infinity });
  },

  /** Count-up number (battle-end crowns, progress). */
  countUp(el, from, to, dur = 600, fmt = (n) => Math.round(n).toLocaleString()) {
    const t0 = performance.now();
    return new Promise((res) => {
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms(dur));
        el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        k < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  },

  /** Floating "+1" style pickup text (elixir_float_txt: rises 62u over ~1.1s ease-out, fades last 170ms). */
  floatText(el, { rise = 62 } = {}) {
    return run(el, K(1333, [
      [0,    { t: { y: 0, s: 0.5 }, o: 0.5 }, EASE.out],
      [633,  { t: { y: -rise * 0.6, s: 1.09 }, o: 1 }, EASE.out],
      [800,  { t: { y: -rise * 0.8, s: 0.92 }, o: 1 }, EASE.out],
      [1233, { t: { y: -rise, s: 0.92 }, o: 1 }, EASE.linear],
      [1333, { t: { y: -rise, s: 0.92 }, o: 0 }],
    ]), { dur: 1333 });
  },
};

/* --------------------------- rarity presentation -------------------------- */
// Measured: rare = warm orange add (144,60,0); epic = magenta-purple add (144,60,69) + slow flare;
// legendary = white shine add 0->255, 4 bobbing glow layers, flare scale 1.44->1.61.
export const RARITY = {
  common:    { glow: null,      add: null,      lift: 0,   flare: false },
  rare:      { glow: '#ff9a3c', add: '#903c00', lift: 46,  flare: false },
  epic:      { glow: '#c04cff', add: '#903c45', lift: 46,  flare: true },
  legendary: { glow: '#fff3c0', add: '#ffffff', lift: 9,   flare: true, extended: true },
};

/* --------------------------------- confetti ------------------------------- */
// Per-piece path from confetti_white1: x ease-out +90u (1067ms), y up ~268u over ~2s then fall, rot -15 -> +28 -> -44.
export function confetti(host, { count = 60, colors = ['#ff5a5a', '#ffd34d', '#59d0ff', '#9b6bff', '#6fe08a'], spread = 360 } = {}) {
  if (config.reduced) return Promise.resolve();
  const jobs = [];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const w = 6 + Math.random() * 6;
    p.style.cssText = `position:absolute;left:50%;top:60%;width:${w}px;height:${w * 1.8}px;background:${colors[i % colors.length]};
      pointer-events:none;border-radius:1px;opacity:0`;
    host.appendChild(p);
    const dx = (Math.random() - 0.5) * u(spread);
    const up = u(180 + Math.random() * 160);
    const dur = 2600 + Math.random() * 1400;
    const rot = (Math.random() - 0.5) * 720;
    jobs.push(run(p, [
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1, offset: 0, easing: EASE.out },
      { transform: `translate(${dx * 0.7}px, ${-up}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.42, easing: EASE.in },
      { transform: `translate(${dx}px, ${u(120)}px) rotate(${rot}deg)`, opacity: 0, offset: 1 },
    ], { dur, delay: Math.random() * 250 }).then(() => p.remove()));
  }
  return Promise.all(jobs);
}

/* -------------------------------- scenes (flows) -------------------------- */
// Higher-level choreographies composed from the motions above. Each takes elements you
// already have; they only animate (they never create or restyle your UI).

/** Evolution shard insert. shards = array of up to 6 shard elements, `n` = how many are NEW this time.
 *  Data: each new shard slams 4 -> 1 in 400ms; once the last slot is filled, the whole frame pulses at +400ms. */
export async function evoShardInsert({ shards, fresh = [0], frame, stagger = 120, onFull }) {
  const jobs = fresh.map((i, k) => motion.slam(shards[i], { delay: k * stagger }));
  await Promise.all(jobs);
  if (frame && onFull) { await motion.pulse(frame); onFull(); }
}

/** "Evolution Unlocked" popup, 3.6s (battle-pass evolution_unlock_anim). Beats (ms):
 *  0 dimmer 0->.75 (383) | 250 sunburst turns 120deg while scaling 0->1.1 | 400 bloom flash | 733 card slams 2.0->.9->1.02->.95
 *  967 title rises 125u + overshoot | 1217 wings fly out ~56u + settle | 1850 shine sweeps card | ~3000 everything collapses.
 *  `sunburst` = outer element (scale/alpha), `rays` = inner element that rotates (kept separate: both animate transform). */
export async function evoUnlocked({ dimmer, sunburst, rays, bloom, card, title, wings = [], shine, hold = 1800, exit = true }) {
  run(dimmer, [{ opacity: 0 }, { opacity: 0.75 }], { dur: 383 });
  run(sunburst, K(520, [[0, { t: { s: 0 }, o: 0 }, EASE.out], [167, { t: { s: 1.1 }, o: 1 }], [520, { t: { s: 1.1 }, o: 1 }]]), { dur: 520, delay: 283 });
  motion.sunburst(rays || sunburst, { dur: 3983, delay: 250 });
  run(bloom, K(700, [[0, { t: { s: 0.24 }, o: 0.07 }, EASE.in], [217, { t: { s: 14 }, o: 0.9 }, EASE.out], [317, { t: { s: 30 }, o: 0.6 }, EASE.out], [700, { t: { s: 30 }, o: 0.22 }]]), { dur: 700, delay: 400 });
  run(card, K(500, [
    [0,   { t: { s: 2.0, y: 6 }, o: 0.02 }, EASE.in],
    [300, { t: { s: 0.9, y: 0 }, o: 1 }, EASE.out],
    [400, { t: { s: 1.02 }, o: 1 }, EASE.inOut],
    [500, { t: { s: 0.95 }, o: 1 }],
  ]), { dur: 500, delay: 733 });
  motion.slideUp(title, { dist: 125, delay: 967 });
  wings.forEach((w, i) => {
    const d = i ? -1 : 1;   // left wing mirrors right wing
    run(w, K(467, [[0, { t: { x: 0 }, o: 1 }, EASE.in], [267, { t: { x: d * 56.5 }, o: 1 }, EASE.out],
                   [367, { t: { x: d * 43.5 }, o: 1 }, EASE.out], [467, { t: { x: d * 48.2 }, o: 1 }]]), { dur: 467, delay: 1217 });
  });
  if (shine) motion.shineSweep(shine, { delay: 1850 });
  await wait(1217 + hold);
  if (exit) {
    await Promise.all([
      run(card, K(250, [[0, { t: { s: 0.95, y: 0 }, o: 1 }, EASE.in], [167, { t: { s: 0.95, y: 86 }, o: 0 }], [250, { t: { s: 0 }, o: 0 }]]), { dur: 250 }),
      run(sunburst, K(250, [[0, { t: { s: 1.1 }, o: 1 }, EASE.in], [250, { t: { s: 0 }, o: 0 }]]), { dur: 250 }),
      run(title, K(183, [[0, { t: { y: 0 }, o: 1 }, EASE.in], [183, { t: { y: 100 }, o: 0 }]]), { dur: 183 }),
      run(dimmer, [{ opacity: 0.75 }, { opacity: 0 }], { dur: 200 }),
      run(bloom, [{ opacity: 1 }, { opacity: 0 }], { dur: 183 }),
      ...wings.map((w) => motion.fadeOut(w, 233)),
    ]);
  }
}

/** Reveal chest/capsule. Data (chest_open_*, 30fps): popup 0-800ms (rises 312u + scale .16->1.02 in 267ms, lands -50 in 100ms),
 *  idle loop until tap, play = burst (rings 1.1->3.65 in 267ms ease-out), end 1733ms (box shrinks .1 + fades 130ms). */
export function capsulePopup(box) {
  return run(box, K(367, [
    [0,   { t: { y: 120, s: 0.16 }, o: 0.05 }, EASE.out],
    [267, { t: { y: -192, s: 1.02 }, o: 1 }, EASE.in],
    [367, { t: { y: -50, s: 1.02 }, o: 1 }],
  ]), { dur: 367 });
}
export async function capsuleBurst({ box, host, rarity = 'common', count = 14 }) {
  const col = RARITY[rarity].glow || '#cfe6ff';
  motion.ringShock(host, { color: col, size: 60, dur: 267, to: 3.65 });
  motion.ringShock(host, { color: '#fff', size: 40, dur: 200, to: 2.2 });
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.style.cssText = `position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;
      background:${col};box-shadow:0 0 12px ${col};opacity:0;pointer-events:none`;
    host.appendChild(s);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4, d = u(120 + Math.random() * 160);
    run(s, K(1000, [[0, { t: { x: 0, y: 0, s: 1.4 }, o: 1 }, EASE.out], [400, { t: { x: Math.cos(a) * d, y: Math.sin(a) * d - u(40), s: 1 }, o: 0.9 }, EASE.linear], [1000, { t: { x: Math.cos(a) * d * 1.2, y: Math.sin(a) * d - u(10), s: 0.4 }, o: 0 }]]),
      { dur: 1000 }).then(() => s.remove());
  }
  await run(box, K(130, [[0, { t: { s: 1.02, y: -50 }, o: 1 }, EASE.in], [130, { t: { s: 0.1, y: -5 }, o: 0 }]]), { dur: 130, delay: 150 });
}

/** Card flip: the game fakes it with a 2-frame scaleX squash (1 -> .22 -> 1) swapping face/back at the narrow frame.
 *  `anticipation` (ms) = 0 for normal rarities, ~3600 for legendary "extended" build-up. */
export async function cardFlip({ card, swap, anticipation = 0 }) {
  if (anticipation) await wait(anticipation);
  await run(card, K(34, [[0, { t: { sx: 1 } }], [34, { t: { sx: 0.22 } }]]), { dur: 34, ease: EASE.linear });
  swap?.();
  await run(card, K(67, [[0, { t: { sx: 0.22 } }, EASE.out], [67, { t: { sx: 1 } }]]), { dur: 67 });
}

/** New-card collect panel (collect_card, 30/60fps). Beats (ms): card rises 100u + scale 1.22->1.4 in 200 | name slides up 109u (167, linear) |
 *  "NEW CARD" stamp 2.5->1.35 (200, linear, after 100ms fade-in) | hold | exit scale 1.4->1.1 + fade in 167. */
export async function collectCard({ card, name, stamp, extras = [], hold = 700 }) {
  const j = [];
  j.push(run(card, K(400, [
    [0,   { t: { y: 100, s: 1.22, x: 21 }, o: 0 }, EASE.out],
    [200, { t: { y: 0, s: 1.4, x: 0 }, o: 1 }],
    [400, { t: { y: 0, s: 1.4, x: 0 }, o: 1 }],
  ]), { dur: 400 }));
  j.push(run(name, K(167, [[0, { t: { y: 109 }, o: 0 }], [167, { t: { y: 0 }, o: 1 }]]), { dur: 167, delay: 233 }));
  j.push(run(stamp, K(300, [[0, { t: { s: 2.5 }, o: 0 }], [100, { t: { s: 2.5 }, o: 1 }], [300, { t: { s: 1.35 }, o: 1 }]]), { dur: 300, delay: 300 }));
  extras.forEach((e, i) => j.push(run(e, [{ opacity: 0 }, { opacity: 1 }], { dur: 200, delay: 300 + i * 70 })));
  await Promise.all(j);
  await wait(hold);
  await Promise.all([
    run(card, K(167, [[0, { t: { s: 1.4 }, o: 1 }, EASE.in], [167, { t: { s: 1.1 }, o: 0 }]]), { dur: 167 }),
    ...[name, stamp, ...extras].map((e) => motion.fadeOut(e, 67)),
  ]);
}

/** Upgrade-card charge & pop: additive white ramps 0->255 (500-833ms), pops 1.0->1.2->0.94 (67ms each) at 1000ms, flash fades in 100ms. */
export async function upgradeCard({ card, glowHost }) {
  const charge = document.createElement('i');
  charge.style.cssText = 'position:absolute;inset:0;background:#fff;mix-blend-mode:plus-lighter;opacity:0;border-radius:inherit;pointer-events:none';
  glowHost.appendChild(charge);
  run(charge, K(1100, [[0, { o: 0 }], [333, { o: 0 }], [833, { o: 1 }], [967, { o: 1 }], [1067, { o: 0 }]]), { dur: 1100 }).then(() => charge.remove());
  await wait(1000);
  await run(card, K(134, [[0, { t: { s: 1 } }], [67, { t: { s: 1.2 } }], [134, { t: { s: 0.94 } }]]), { dur: 134, ease: EASE.linear });
  await run(card, [{ transform: tf({ s: 0.94 }) }, { transform: tf({ s: 1 }) }], { dur: 120, ease: EASE.out });
}

/** Reward toast (tr_claim_reward_notification, 2.67s): pop 0->1 in 333 along a +56u arc, settle bounce, hold, shrink out in 150. */
export async function toast(el, { hold = 1900 } = {}) {
  await run(el, K(633, [
    [0,   { t: { y: 0, s: 0.01 }, o: 1 }, EASE.out],
    [333, { t: { y: -56, s: 1 }, o: 1 }, EASE.in],
    [517, { t: { y: 0, s: 1 }, o: 1 }, EASE.linear],
    [567, { t: { y: -4, s: 1 }, o: 1 }, EASE.linear],
    [633, { t: { y: -1, s: 1 }, o: 1 }],
  ]), { dur: 633 });
  await wait(hold);
  await run(el, K(150, [[0, { t: { s: 1 }, o: 1 }], [150, { t: { s: 0.01 }, o: 1 }]]), { dur: 150, ease: EASE.inOut });
}

/** Level-up banner (player_levelup, 0.9s). */
export async function levelUp({ title, icon, button }) {
  await Promise.all([
    run(title, K(233, [[0, { t: { y: 107, sx: 1 }, o: 0 }, EASE.in], [100, { t: { y: 47, sx: 0.35 }, o: 0 }, EASE.linear], [233, { t: { y: 0, sx: 1 }, o: 1 }]]), { dur: 233 }),
    run(icon, K(267, [[0, { t: { s: 0.1 } }, EASE.out], [67, { t: { s: 1.48 } }, EASE.out], [167, { t: { s: 0.7 } }, EASE.out], [267, { t: { s: 1.09 } }]]), { dur: 267 }),
    run(button, K(133, [[0, { t: { s: 0.27 }, o: 0 }], [67, { t: { s: 1.17 }, o: 1 }], [133, { t: { s: 0.91 }, o: 1 }]]), { dur: 133, delay: 583, ease: EASE.out }),
  ]);
}

export default { config, setUnit, EASE, T, K, run, wait, stopAll, flash, motion, RARITY, confetti,
  evoShardInsert, evoUnlocked, capsulePopup, capsuleBurst, cardFlip, collectCard, upgradeCard, toast, levelUp };
