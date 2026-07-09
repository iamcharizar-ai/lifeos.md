// PC-side vault write-back via the File System Access API (Chromium only).
// No backend: the browser holds a handle to the Obsidian vault folder and
// mirrors today's state into daily/YYYY-MM-DD.md in the existing template
// format — HABITS/MONTHLY/NOW dataview stay untouched.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Habit } from '../config/habits'
import { getHabits } from './habitConfig'
import { idbDel, idbGet, idbSet } from './idb'
import type { Stores } from './ledger'
import { renderWorkoutMarkdown } from './workout'

const HANDLE_KEY = 'vault-dir-handle'

export type VaultStatus = 'unsupported' | 'disconnected' | 'need-perm' | 'ready'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function fallbackTemplate(date: string): string {
  return `# ${date}\n\n## Habits\n${getHabits()
    .map((h) => `- [ ] ${h.name} ${h.emoji}`)
    .join('\n')}\n\n## Metrics\nweight::\nkcal::\nprotein::\n\n## Diary\n-\n`
}

/** Insert checkbox lines for habits the note predates (added to the template later). */
function ensureHabitLines(text: string, habits: Habit[]): string {
  const missing = habits.filter((h) => !text.includes(`] ${h.name} ${h.emoji}`))
  if (missing.length === 0) return text
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^##\s+Habits\b/i.test(l))
  if (start === -1) return text
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++)
    if (/^##\s/.test(lines[i])) {
      end = i
      break
    }
  let insertAt = start + 1
  for (let i = start + 1; i < end; i++) if (/^\s*-\s*\[/.test(lines[i])) insertAt = i + 1
  lines.splice(insertAt, 0, ...missing.map((h) => `- [ ] ${h.name} ${h.emoji}`))
  return lines.join('\n')
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
  const habits = getHabits()
  let text = ensureHabitLines(existing, habits)
  const dayTicks = stores.ticks[date] ?? {}
  for (const h of habits) {
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
  if (hd?.water) text = upsertField(text, 'water', hd.water)
  const w = stores.workouts[date]
  if (w) text = upsertField(text, 'workout', w.type)
  if (w?.session) text = upsertWorkoutSection(text, renderWorkoutMarkdown(w.session))
  return text
}

/** Replace (or insert before ## Diary) a `## Workout` section — idempotent,
 *  renderDay reruns on every state change. Only the section body is owned. */
export function upsertWorkoutSection(text: string, body: string): string {
  const section = `## Workout\n${body}\n`
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^##\s+Workout\b/i.test(l))
  if (start !== -1) {
    let end = lines.length
    for (let i = start + 1; i < lines.length; i++)
      if (/^##\s/.test(lines[i])) {
        end = i
        break
      }
    lines.splice(start, end - start, ...section.split('\n'))
    return lines.join('\n')
  }
  const diary = lines.findIndex((l) => /^##\s+Diary\b/i.test(l))
  if (diary !== -1) {
    lines.splice(diary, 0, ...section.split('\n'))
    return lines.join('\n')
  }
  return text.replace(/\n*$/, '\n\n') + section
}

// ── Day tasks — the `## Tasks` section of the daily note ────────────
// Claude (JARVIS-0 planning) writes the day's tasks into the note from the
// vault timeline; the HUD renders them and toggles write straight back, so
// app and Obsidian always show the same checkboxes.

export interface VaultTask {
  text: string
  done: boolean
}

/** Checkbox lines of the `## Tasks` section; null when the note has no section. */
export function parseTasksSection(text: string): VaultTask[] | null {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+Tasks\b/i.test(l))
  if (start === -1) return null
  const out: VaultTask[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s/.test(line)) break
    const m = line.match(/^\s*-\s*\[([ xX])\]\s+(.+?)\s*$/)
    if (m) out.push({ text: m[2], done: m[1] !== ' ' })
  }
  return out
}

async function readDaily(
  vault: FileSystemDirectoryHandle,
  date: string,
): Promise<string | null> {
  try {
    const daily = await vault.getDirectoryHandle('daily')
    const fh = await daily.getFileHandle(`${date}.md`)
    return await (await fh.getFile()).text()
  } catch {
    return null
  }
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

  /** Raw daily template text — the habit-list authority the config poller parses. */
  const readTemplateText = useCallback(async (): Promise<string | null> => {
    const h = handleRef.current
    if (!h) return null
    try {
      const dir = await h.getDirectoryHandle('templates')
      const fh = await dir.getFileHandle('daily-template.md')
      return await (await fh.getFile()).text()
    } catch {
      return null
    }
  }, [])

  /** Today's `## Tasks` checkboxes, or null (no note / no section / no vault). */
  const readTasks = useCallback(async (date: string): Promise<VaultTask[] | null> => {
    const h = handleRef.current
    if (!h) return null
    const text = await readDaily(h, date)
    return text ? parseTasksSection(text) : null
  }, [])

  /** Flip one task checkbox in the daily note — the HUD's write-back. */
  const toggleTask = useCallback(async (date: string, taskText: string): Promise<void> => {
    const h = handleRef.current
    if (!h) return
    const text = await readDaily(h, date)
    if (!text) return
    const re = new RegExp(`^(\\s*-\\s*\\[)([ xX])(\\]\\s+${escapeRegex(taskText)}\\s*)$`, 'm')
    const m = text.match(re)
    if (!m) return
    const next = text.replace(re, `$1${m[2] === ' ' ? 'x' : ' '}$3`)
    const daily = await h.getDirectoryHandle('daily', { create: true })
    const fh = await daily.getFileHandle(`${date}.md`, { create: true })
    const w = await fh.createWritable()
    await w.write(next)
    await w.close()
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

  return {
    status,
    lastWrite,
    error,
    connect,
    authorize,
    disconnect,
    writeNow,
    readTemplateText,
    readTasks,
    toggleTask,
  }
}
