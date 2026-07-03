// Builds public/graph.json from the Obsidian vault's [[wiki-links]].
// Run: npm run graph  (re-run any time to refresh the Graph tab)
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const VAULT = 'G:/My Drive/My Files/Obsidian Vault'
const OUT = new URL('../public/graph.json', import.meta.url)
const SKIP_DIRS = new Set([
  '.obsidian', '.claude', '.git', '.trash', '_backup', 'daily', 'templates', 'raw', 'node_modules',
])

function groupOf(rel) {
  if (rel.startsWith('Mini Notes/')) return 'mini'
  if (rel.startsWith('Archive/')) return 'archive'
  if (rel.startsWith('wiki/entities/')) return 'entity'
  if (rel.startsWith('wiki/topics/')) return 'topic'
  if (rel.startsWith('wiki/sources/')) return 'source'
  if (rel.startsWith('wiki/outputs/')) return 'output'
  if (rel.startsWith('wiki/')) return 'wiki'
  return 'root'
}

async function walk(dir, rel = '') {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...(await walk(path.join(dir, entry.name), relPath)))
    } else if (entry.name.endsWith('.md')) {
      out.push(relPath)
    }
  }
  return out
}

function parseAliases(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) return []
  const out = []
  const inline = fm[1].match(/^aliases:\s*\[([^\]]*)\]/m)
  if (inline) {
    out.push(...inline[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')))
  } else {
    const block = fm[1].match(/^aliases:\s*\r?\n((?:\s+-\s+.*\r?\n?)+)/m)
    if (block) {
      for (const line of block[1].split('\n')) {
        const m = line.match(/-\s+(.*)/)
        if (m) out.push(m[1].trim().replace(/^["']|["']$/g, ''))
      }
    }
  }
  return out.filter(Boolean)
}

const files = await walk(VAULT)
const nodes = []
const byKey = new Map() // lowercase basename or alias -> id

for (const rel of files) {
  const name = path.basename(rel, '.md')
  const id = rel
  nodes.push({ id, name, group: groupOf(rel) })
  byKey.set(name.toLowerCase(), id)
  byKey.set(rel.toLowerCase().replace(/\.md$/, ''), id)
}

const links = []
const degree = new Map()

for (const rel of files) {
  const content = await readFile(path.join(VAULT, rel), 'utf8')
  for (const alias of parseAliases(content)) byKey.set(alias.toLowerCase(), rel)
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
  for (const m of body.matchAll(/\[\[([^\]]+?)\]\]/g)) {
    const raw = m[1].split('|')[0].split('#')[0].trim().toLowerCase()
    const target = byKey.get(raw) ?? byKey.get(raw.split('/').pop())
    if (target && target !== rel) {
      links.push({ source: rel, target })
      degree.set(rel, (degree.get(rel) ?? 0) + 1)
      degree.set(target, (degree.get(target) ?? 0) + 1)
    }
  }
}

for (const n of nodes) n.val = Math.max(degree.get(n.id) ?? 0, 1)

await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), nodes, links }))
console.log(`graph.json: ${nodes.length} nodes, ${links.length} links`)
