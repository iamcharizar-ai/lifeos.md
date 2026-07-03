// PC-side vault write-back via the File System Access API (Chromium only).
// No backend: the browser holds a handle to the Obsidian vault folder and
// mirrors today's state into daily/YYYY-MM-DD.md in the existing template
// format — HABITS/MONTHLY/NOW dataview stay untouched.
import { useCallback, useEffect, useRef, useState } from 'react'
import { HABITS } from '../config/habits'
import { idbDel, idbGet, idbSet } from './idb'
import type { Stores } from './ledger'

const HANDLE_KEY = 'vault-dir-handle'

export type VaultStatus = 'unsupported' | 'disconnected' | 'need-perm' | 'ready'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fallbackTemplate(date: string): string {
  return `# ${date}\n\n## Habits\n${HABITS.map((h) => `- [ ] ${h.name} ${h.emoji}`).join(
    '\n',
  )}\n\n## Metrics\nweight::\nkcal::\nprotein::\n\n## Diary\n-\n`
}

function upsertField(text: string, field: string, value: string): string {
  const re = new RegExp(`^${field}::.*$`, 'm')
  if (re.test(text)) return text.replace(re, `${field}:: ${value}`)
  // insert after the last existing :: field (metrics block)
  const lines = text.split('\n')
  let lastIdx = -1
  lines.forEach((l, i) => {
    if (/^\w+::/.test(l)) lastIdx = i
  })
  if (lastIdx >= 0) lines.splice(lastIdx + 1, 0, `${field}:: ${value}`)
  else lines.push(`${field}:: ${value}`)
  return lines.join('\n')
}

export function renderDay(existing: string, stores: Stores, date: string): string {
  let text = existing
  const dayTicks = stores.ticks[date] ?? {}
  for (const h of HABITS) {
    const label = `${h.name} ${h.emoji}`
    const re = new RegExp(`- \\[[ xX]\\] ${escapeRegex(label)}`)
    const mark = dayTicks[h.id] ? 'x' : ' '
    if (re.test(text)) text = text.replace(re, `- [${mark}] ${label}`)
  }
  const m = stores.metrics[date]
  if (m?.weight) text = upsertField(text, 'weight', m.weight)
  if (m?.kcal) text = upsertField(text, 'kcal', m.kcal)
  if (m?.protein) text = upsertField(text, 'protein', m.protein)
  const hd = stores.health[date]
  if (hd?.steps) text = upsertField(text, 'steps', hd.steps)
  if (hd?.sleep) text = upsertField(text, 'sleep', hd.sleep)
  const w = stores.workouts[date]
  if (w) text = upsertField(text, 'workout', w.type)
  return text
}

async function readTemplate(vault: FileSystemDirectoryHandle, date: string): Promise<string> {
  try {
    const dir = await vault.getDirectoryHandle('templates')
    const fh = await dir.getFileHandle('daily-template.md')
    const raw = await (await fh.getFile()).text()
    return raw.replace(/\{\{date\}\}/g, date)
  } catch {
    return fallbackTemplate(date)
  }
}

export async function writeToday(
  vault: FileSystemDirectoryHandle,
  stores: Stores,
  date: string,
): Promise<void> {
  const daily = await vault.getDirectoryHandle('daily', { create: true })
  let existing: string
  try {
    const fh = await daily.getFileHandle(`${date}.md`)
    existing = await (await fh.getFile()).text()
  } catch {
    existing = await readTemplate(vault, date)
  }
  const next = renderDay(existing, stores, date)
  if (next === existing) return
  const fh = await daily.getFileHandle(`${date}.md`, { create: true })
  const w = await fh.createWritable()
  await w.write(next)
  await w.close()
}

export function useVault() {
  const [status, setStatus] = useState<VaultStatus>(
    'showDirectoryPicker' in window ? 'disconnected' : 'unsupported',
  )
  const [lastWrite, setLastWrite] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null)

  useEffect(() => {
    if (!('showDirectoryPicker' in window)) return
    idbGet<FileSystemDirectoryHandle>(HANDLE_KEY).then(async (h) => {
      if (!h) return
      handleRef.current = h
      const perm = await h.queryPermission?.({ mode: 'readwrite' })
      setStatus(perm === 'granted' ? 'ready' : 'need-perm')
    })
  }, [])

  const connect = useCallback(async () => {
    try {
      const h = await window.showDirectoryPicker({ id: 'vault', mode: 'readwrite' })
      handleRef.current = h
      await idbSet(HANDLE_KEY, h)
      setStatus('ready')
      setError(null)
    } catch {
      /* user cancelled */
    }
  }, [])

  const authorize = useCallback(async () => {
    const h = handleRef.current
    if (!h) return
    const perm = await h.requestPermission?.({ mode: 'readwrite' })
    if (perm === 'granted') setStatus('ready')
  }, [])

  const disconnect = useCallback(async () => {
    handleRef.current = null
    await idbDel(HANDLE_KEY)
    setStatus('disconnected')
  }, [])

  const writeNow = useCallback(async (stores: Stores, date: string) => {
    const h = handleRef.current
    if (!h) return
    try {
      await writeToday(h, stores, date)
      setLastWrite(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'write failed')
    }
  }, [])

  return { status, lastWrite, error, connect, authorize, disconnect, writeNow }
}
