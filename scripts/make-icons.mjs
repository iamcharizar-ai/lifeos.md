// Rasterize public/favicon.svg into the PWA icon set (run: node scripts/make-icons.mjs).
// Maskable variant pads the glyph into the 80% safe zone on the app background color.
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pub = (f) => path.join(root, 'public', f)
const BG = '#09090b'
const svg = await readFile(pub('favicon.svg'))

async function icon(size, out, { pad = 0.12 } = {}) {
  const inner = Math.round(size * (1 - pad * 2))
  const glyph = await sharp(svg).resize(inner, inner, { fit: 'contain' }).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toFile(pub(out))
  console.log(`${out} (${size}x${size})`)
}

await icon(192, 'icon-192.png')
await icon(512, 'icon-512.png')
await icon(512, 'icon-maskable-512.png', { pad: 0.2 })
await icon(180, 'apple-touch-icon.png')
