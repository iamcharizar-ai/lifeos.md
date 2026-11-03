// "Is last night in yet?" While Today waits for the band, ask Life OS's own
// /api/health-check (bridge/check.ts). It reads Google itself, at most
// once a minute, so the night lands without waiting on Google's webhook, and it
// says what the hold-up is: Google not having the night yet means the phone has
// not synced it, which only opening Google Health (or the band app) fixes.
import { useEffect, useState } from 'react'
import { CATCH_UP_EVENT } from './cloudSync'

export type CheckState = 'measured' | 'scoring' | 'not-synced' | 'error'
export interface CheckAnswer {
  day: string
  state: CheckState
  score?: number
  checkedAt?: string
  message: string
  /** the pipe itself is unhealthy (expired sign-in, Google gone quiet): shown instead of `message` */
  warning?: string
}

/** How often to ask while the page is in view and the night is still missing. */
const EVERY_MS = 2 * 60_000

/** The latest answer while `active` (Sleep is waiting for today's reading); null when not asked or the endpoint cannot be reached. */
export function useHealthCheck(active: boolean): CheckAnswer | null {
  const [answer, setAnswer] = useState<CheckAnswer | null>(null)
  useEffect(() => {
    if (!active) { setAnswer(null); return }
    let gone = false
    const ask = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const res = await fetch('/api/health-check', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
        if (!res.ok) return
        const a = (await res.json()) as CheckAnswer
        if (gone || !a || typeof a.state !== 'string') return
        setAnswer(a)
        // the server found (or just wrote) the night: pull the row now instead of waiting for the next poll
        if (a.state === 'measured') window.dispatchEvent(new Event(CATCH_UP_EVENT))
      } catch {
        /* offline, or a dev server with no functions: say nothing */
      }
    }
    void ask()
    const t = window.setInterval(() => void ask(), EVERY_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void ask() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { gone = true; window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [active])
  return answer
}
