// Pixel-figure engine. A pose is a handful of compass angles (0 = up,
// 90 = right, 180 = down, 270 = left); forward kinematics gives the joints and
// a Bresenham pass rasterises them onto a tiny grid. Pure functions, no DOM —
// the same code renders the in-app sprites and the generated PWA icons.
//
// Tones in the returned grid:
//   0 empty · 1 near limbs / torso / head · 2 far limbs · 3 prop · 4 motion mark

export const G = 24

const UA = 3, FA = 3, TH = 4.7, SH = 4.7, TORSO = 5.3, HEAD = 2.5

const rad = (d) => (d * Math.PI) / 180
const vec = (a, len) => [Math.sin(rad(a)) * len, -Math.cos(rad(a)) * len]
const add = (p, v) => [p[0] + v[0], p[1] + v[1]]

// Far-side limbs default to the near limb nudged a few degrees so the two
// read as separate strokes without every pose spelling out both sides.
const nudge = (pair, d) => pair.map((a) => a + d)

function limb(root, [a1, a2], l1, l2) {
  const mid = add(root, vec(a1, l1))
  return [mid, add(mid, vec(a2, l2))]
}

function build(spec) {
  const t = spec.t ?? 0
  const pelvis = [0, 0]
  const neck = add(pelvis, vec(t, TORSO))
  const head = add(neck, vec(t + (spec.hd ?? 0), HEAD))
  const armN = spec.a ?? [180, 180]
  const armF = spec.b ?? nudge(armN, 10)
  const legN = spec.l ?? [180, 180]
  const legF = spec.m ?? nudge(legN, -8)
  const [elbowN, handN] = limb(neck, armN, UA, FA)
  const [elbowF, handF] = limb(neck, armF, UA, FA)
  const [kneeN, footN] = limb(pelvis, legN, TH, SH)
  const [kneeF, footF] = limb(pelvis, legF, TH, SH)
  return { pelvis, neck, head, elbowN, handN, elbowF, handF, kneeN, footN, kneeF, footF }
}

class Grid {
  constructor() { this.px = new Uint8Array(G * G) }
  set(x, y, tone) {
    if (x < 0 || y < 0 || x >= G || y >= G) return
    this.px[y * G + x] = tone
  }
  get(x, y) { return this.px[y * G + x] }
  line(x0, y0, x1, y1, tone) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x0, y0, tone)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }
  thick(x0, y0, x1, y1, tone) {
    this.line(x0, y0, x1, y1, tone)
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) this.line(x0, y0 + 1, x1, y1 + 1, tone)
    else this.line(x0 + 1, y0, x1 + 1, y1, tone)
  }
  rect(x, y, w, h, tone) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, tone)
  }
}

const R = Math.round

export function renderPose(spec) {
  const j = build(spec)
  const pts = Object.fromEntries(Object.entries(j).map(([k, p]) => [k, [R(p[0]), R(p[1])]]))

  // Bounding box of the body (head is 3x3) → integer shift that centres it.
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
  const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  for (const [k, [x, y]] of Object.entries(pts)) {
    if (k === 'head') { grow(x - 1, y - 1); grow(x + 1, y + 1) } else grow(x, y)
  }
  const props = spec.props || []
  const hasFloor = props.some((p) => p === 'floor' || p === 'box' || p === 'bars' || p === 'para')
  const padBottom = hasFloor ? 1 : 0
  const w = x1 - x0 + 1, h = y1 - y0 + 1 + padBottom
  const dx = Math.floor((G - w) / 2) - x0
  const dy = Math.floor((G - h) / 2) - y0
  for (const p of Object.values(pts)) { p[0] += dx; p[1] += dy }
  const bx0 = x0 + dx, bx1 = x1 + dx, by0 = y0 + dy, by1 = y1 + dy

  const g = new Grid()

  // ── props first (underneath) ──
  const floorY = by1 + 1
  for (const p of props) {
    switch (p) {
      case 'floor':
        g.line(Math.max(0, bx0 - 2), floorY, Math.min(G - 1, bx1 + 2), floorY, 3)
        break
      case 'bar': { // horizontal bar through the hands
        const { handN } = pts
        g.line(Math.max(0, handN[0] - 7), handN[1], Math.min(G - 1, handN[0] + 7), handN[1], 3)
        g.set(Math.max(0, handN[0] - 7), handN[1] + 1, 3)
        g.set(Math.min(G - 1, handN[0] + 7), handN[1] + 1, 3)
        break
      }
      case 'pole': // vertical pole through the hands (human flag)
        g.line(pts.handN[0], 0, pts.handN[0], G - 1, 3)
        break
      case 'rope':
        for (let y = 0; y <= pts.handN[1]; y += 2) g.set(pts.handN[0], y, 3)
        break
      case 'rings':
        for (const h of [pts.handN, pts.handF]) {
          g.line(h[0], 0, h[0], h[1] - 1, 3)
          g.rect(h[0] - 1, h[1] - 1, 3, 2, 3)
        }
        break
      case 'wallR':
        g.line(Math.min(G - 1, bx1 + 2), 0, Math.min(G - 1, bx1 + 2), G - 1, 3)
        break
      case 'wallL':
        g.line(Math.max(0, bx0 - 2), 0, Math.max(0, bx0 - 2), G - 1, 3)
        break
      case 'bars': { // parallel dip bars: rail under the hands + a post to the floor
        const { handN } = pts
        g.line(handN[0] - 3, handN[1] + 1, handN[0] + 3, handN[1] + 1, 3)
        g.line(handN[0] + 3, handN[1] + 1, handN[0] + 3, floorY, 3)
        g.line(handN[0] - 3, handN[1] + 1, handN[0] - 3, floorY, 3)
        g.line(Math.max(0, bx0 - 2), floorY, Math.min(G - 1, bx1 + 2), floorY, 3)
        break
      }
      case 'para': { // parallettes: a little rail under each hand
        for (const h of [pts.handN, pts.handF]) g.line(h[0] - 2, h[1] + 1, h[0] + 2, h[1] + 1, 3)
        g.line(Math.max(0, bx0 - 2), floorY, Math.min(G - 1, bx1 + 2), floorY, 3)
        break
      }
      case 'box': // step/box under the feet
        g.rect(pts.footN[0] - 2, pts.footN[1] + 1, 5, floorY - pts.footN[1], 3)
        g.line(Math.max(0, bx0 - 2), floorY, Math.min(G - 1, bx1 + 2), floorY, 3)
        break
      case 'bench': // bench under the hands (dips behind the back)
        g.rect(pts.handN[0] - 2, pts.handN[1] + 1, 5, 2, 3)
        break
      case 'plate': // weight hanging off the hips
        g.line(pts.pelvis[0], pts.pelvis[1], pts.pelvis[0], pts.pelvis[1] + 2, 3)
        g.rect(pts.pelvis[0] - 1, pts.pelvis[1] + 2, 3, 3, 3)
        break
      default:
    }
  }

  // ── far limbs, then near limbs, torso, head ──
  const line = (a, b, tone) => g.thick(a[0], a[1], b[0], b[1], tone)
  line(pts.neck, pts.elbowF, 2); line(pts.elbowF, pts.handF, 2)
  line(pts.pelvis, pts.kneeF, 2); line(pts.kneeF, pts.footF, 2)
  line(pts.pelvis, pts.neck, 1)
  // thicken the torso by one pixel on the minor axis
  const tdx = Math.abs(pts.neck[0] - pts.pelvis[0]), tdy = Math.abs(pts.neck[1] - pts.pelvis[1])
  if (tdx >= tdy) g.line(pts.pelvis[0], pts.pelvis[1] + 1, pts.neck[0], pts.neck[1] + 1, 1)
  else g.line(pts.pelvis[0] + 1, pts.pelvis[1], pts.neck[0] + 1, pts.neck[1], 1)
  line(pts.neck, pts.elbowN, 1); line(pts.elbowN, pts.handN, 1)
  line(pts.pelvis, pts.kneeN, 1); line(pts.kneeN, pts.footN, 1)
  const [hx, hy] = pts.head
  g.rect(hx - 1, hy - 1, 3, 3, 1)

  // ── motion marks on top ──
  for (const p of props) {
    if (p === 'speed') {
      g.line(0, by0, 2, by0, 4); g.line(0, R((by0 + by1) / 2), 3, R((by0 + by1) / 2), 4); g.line(0, by1, 2, by1, 4)
    } else if (p === 'spin') { // a curl in the top-right corner
      g.line(G - 5, 1, G - 2, 1, 4); g.line(G - 2, 1, G - 2, 4, 4); g.set(G - 3, 4, 4); g.set(G - 1, 4, 4)
    } else if (p === 'up') { // rise arrow
      g.line(G - 2, 6, G - 2, 1, 4); g.set(G - 3, 2, 4); g.set(G - 1, 2, 4)
    } else if (p === 'twist') {
      g.line(1, 1, 4, 1, 4); g.line(1, 1, 1, 4, 4); g.set(0, 4, 4); g.set(2, 4, 4)
      g.line(G - 5, G - 2, G - 2, G - 2, 4); g.line(G - 2, G - 5, G - 2, G - 2, 4); g.set(G - 3, G - 5, 4); g.set(G - 1, G - 5, 4)
    } else if (p === 'note') {
      g.line(G - 3, 1, G - 3, 5, 4); g.rect(G - 5, 4, 2, 2, 4); g.set(G - 2, 1, 4); g.set(G - 2, 2, 4)
    } else if (p === 'spark') {
      g.set(G - 3, 2, 4); g.set(G - 3, 4, 4); g.set(G - 4, 3, 4); g.set(G - 2, 3, 4); g.set(G - 3, 3, 4)
    }
  }

  if (spec.flip) {
    const f = new Uint8Array(G * G)
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) f[y * G + (G - 1 - x)] = g.get(x, y)
    return f
  }
  return g.px
}
