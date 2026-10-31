// The ledger rows this device has already read, kept in IndexedDB, so opening Life OS reads only
// what was inserted after them instead of the whole ledger every time (cloudSync.ts). The ledger is
// append-only, so the copy plus "everything newer than its cursor" is the whole history. The copy is
// thrown away after a week, which bounds anything a late-committing row could have slipped past.
import type { LifeEvent } from './cloudSync'

const DB = 'lifeos-ledger', STORE = 'rows', KEY = 'events', VERSION = 1
export const FULL_READ_EVERY_MS = 7 * 86_400_000

export interface Kept {
  v: number
  /** newest inserted_at folded */
  cursor: string
  /** when the whole ledger was last read */
  full: number
  rows: LifeEvent[]
}

let db: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return db
}

/** The copy, or null when there is none worth booting from (none yet, too old, no IndexedDB). */
export async function loadRows(): Promise<Kept | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const d = await open()
    const kept = await new Promise<Kept | undefined>((resolve, reject) => {
      const q = d.transaction(STORE).objectStore(STORE).get(KEY)
      q.onsuccess = () => resolve(q.result as Kept | undefined)
      q.onerror = () => reject(q.error)
    })
    if (!kept || kept.v !== VERSION || !kept.cursor || Date.now() - kept.full > FULL_READ_EVERY_MS) return null
    return kept
  } catch {
    return null
  }
}

/** Each `config` row is a whole copy of the habit library and only the newest stands: keep just that one. */
function trim(rows: LifeEvent[]): LifeEvent[] {
  let newest: LifeEvent | undefined
  for (const r of rows) if (r.type === 'config' && (!newest || r.at > newest.at)) newest = r
  return rows.filter((r) => r.type !== 'config' || r === newest)
}

let pending: Kept | null = null
let timer: number | undefined
/** Save the copy a moment later (rows arrive in bursts). A failed save only means a bigger read next time. */
export function saveRows(kept: Omit<Kept, 'v'>): void {
  pending = { v: VERSION, ...kept, rows: trim(kept.rows) }
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    const value = pending
    if (!value || typeof indexedDB === 'undefined') return
    open()
      .then((d) => {
        const t = d.transaction(STORE, 'readwrite')
        t.objectStore(STORE).put(value, KEY)
      })
      .catch(() => {})
  }, 2000)
}
