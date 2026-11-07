// GET /api/ai/<token>: the whole system as one page of plain text an AI can read. Paste the link into ChatGPT, Gemini or Claude.
//   ?days=30                how much history (default 14, at most 120)
//   ?sections=game,body     only these: today, habits, months, game, body, arbor, woodshed, workouts
//   ?format=json            the same thing as JSON
//   ?redact=health          leave out the band's readings, weight and Sleep, for a link you share more widely
// Read-only. The same endpoint answers at /api/ai with the token in an `Authorization: Bearer` header instead.
import { NO_STORE, asked, authorize, refuse, snapshot } from './ai-http.ts'
import { renderJson, renderMarkdown } from './ai-snapshot.ts'

export async function GET(req: Request): Promise<Response> {
  const auth = authorize(req)
  if (auth !== 'ok') return refuse(auth)
  const a = asked(new URL(req.url))
  try {
    const snap = await snapshot(a)
    const body = a.json ? renderJson(snap, a.sections) : renderMarkdown(snap, a.sections)
    return new Response(body, { status: 200, headers: { ...NO_STORE, 'Content-Type': a.json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' } })
  } catch (err) {
    console.log(`ai snapshot failed: ${err instanceof Error ? err.message : String(err)}`)
    return new Response('The ledger could not be read just now. Try again in a minute.\n', { status: 502, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
