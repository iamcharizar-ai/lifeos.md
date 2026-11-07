// Prints the links to paste into an AI, built from AI_SNAPSHOT_TOKEN in .env.local (or the environment).
// The output contains the secret: keep it out of screenshots, chats you share and anything you commit.
//   npm run ai:links
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
let token = process.env.AI_SNAPSHOT_TOKEN ?? ''
if (!token) {
  try {
    token = /^AI_SNAPSHOT_TOKEN=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'))?.[1].trim().replace(/^["']|["']$/g, '') ?? ''
  } catch {
    /* no .env.local */
  }
}
if (token.length < 24) {
  console.error('AI_SNAPSHOT_TOKEN is missing or under 24 characters (.env.local or the environment).')
  console.error('Make one:  node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))"')
  process.exit(1)
}

const APPS = [
  ['Life OS (everything)', 'https://redesign-life-os-ui.vercel.app/api/ai'],
  ['Pokedex (habits, months, game)', 'https://pokedex-theta-swart.vercel.app/ai'],
  ['Arbor (skills, workouts)', 'https://arbor-umber.vercel.app/ai'],
  ['Woodshed (guitar)', 'https://woodshed-sooty.vercel.app/ai'],
  ['Strong (workouts, Arbor)', 'https://strong-five.vercel.app/ai'],
]
console.log('Paste one of these into ChatGPT, Gemini or Claude (read-only, plain text):\n')
for (const [name, base] of APPS) console.log(`  ${name}\n    ${base}/${token}`)
console.log('\nMore history:        add ?days=60   (up to 120)')
console.log('One part only:       add ?sections=body   (today, habits, months, game, body, arbor, woodshed, workouts)')
console.log('As JSON:             add ?format=json')
console.log('Without health data: add ?redact=health   (drops the band, weight and Sleep)')
console.log(`\nMCP connector URL (Claude, ChatGPT developer mode, Cursor, Gemini CLI):\n    https://redesign-life-os-ui.vercel.app/api/mcp/${token}`)
console.log(`    without health: https://redesign-life-os-ui.vercel.app/api/mcp/${token}?redact=health`)
console.log('\nTo cut every link off at once: change AI_SNAPSHOT_TOKEN in Vercel and redeploy.')
