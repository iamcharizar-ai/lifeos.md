# Push vs pull audit — 3 Nov 2026

> **Status (3 Nov):** steps 1–7 are written, uncommitted and not yet deployed. Step 7 uses option A only: you chose no login, so the anon key can still *read* the ledger. Two things need you: set `SUPABASE_SERVICE_ROLE_KEY` in Vercel and run the two SQL files in `supabase/` (the status table any time; `vitals-server-only` only after the key is live).

Question: where does the system poll (ask over and over with a key) when it should be pushed to (webhook / realtime)? And why does the morning sleep reading need a manual refresh?

## First, the terms

"API key" and "webhook" are not opposites. A **key** is *who you are*. **Push vs pull** is *who starts the conversation*. A webhook still needs a secret; a realtime socket still uses the Supabase anon key. So the useful questions are:

1. Is each hop push or pull, and is that the right choice?
2. Is each key the right key, in the right place?

## The system as it is

```
Fitbit band ──BT──▶ phone (Google Health app) ──▶ Google cloud
                                                     │  PUSH: webhook (signed + WEBHOOK_SECRET)
                                                     ▼
                         Life OS  /api/health-webhook  ──PULL (refresh token)──▶ Google Health API
                                                     │  writes with SUPABASE anon key
                                                     ▼
                                   Supabase `events` (append-only ledger)
                     ┌───────────────────────┼─────────────────────────┐
         PUSH realtime + 45 s poll       PULL 30 s poll             PULL 30 s poll
             Life OS (cloudSync.ts)     Pokedex (lib/ledger.ts)    Arbor, Woodshed (core/ledger.ts)

  fallback: Life OS page ──PULL every 2 min while Sleep waits──▶ /api/health-check ──▶ Google (≤ 1/min)
```

| Hop | Today | Right choice? |
|---|---|---|
| Google → Life OS server | **Webhook** (`server/health-webhook.ts`) | Yes. Already push. |
| Server → Google Health API | Pull with refresh token, after each webhook | Yes. Google's webhook only says "day X changed"; reading it is required. |
| `/api/health-check` fallback | Page polls every 2 min while sleep is "waiting"; server reads Google at most once a minute per warm instance | Fine as a fallback. The memo is per instance, so cold starts can read Google more often. Minor. |
| Ledger → Life OS | **Realtime** websocket + catch-up on focus + 45 s poll | Push is right. **But it has a hang bug (below).** |
| Ledger → Pokedex / Arbor / Woodshed | 30 s REST poll, no realtime | This is the real "pull where push fits". Cheap thanks to the row cache, but up to 30 s late and wakes the radio every 30 s. |
| Phone → Google | Only when the Google Health / Fitbit app syncs | Out of our control. No webhook can fire before this. |

So the design is mostly push already. The "dumb mistake" is not the architecture; it is two bugs and one key problem.

## Why the morning refresh is needed (most likely cause)

**`fetchEvents` in `src/lib/cloudSync.ts:95` has no timeout.** `catchUp()` sets `catching = true` and only clears it when that fetch returns.

Overnight the phone suspends the PWA. In the morning:

1. The realtime socket is dead (mobile OS killed it) and supabase-js has not reconnected yet.
2. The tab becomes visible → `catchUp()` fires a fetch while the network is still waking. That request can hang on a half-open connection for minutes.
3. While it hangs, `catching` is `true`, so **every** later catch-up — focus, the 45 s poll, and the realtime `SUBSCRIBED` handler — returns `'skipped'`.
4. The webhook writes last night's row; nothing in the page picks it up. A reload starts fresh and it appears.

The shared core (`src/arbor-core/ledger.ts`) already wraps its fetches in `AbortSignal.timeout(REQUEST_MS)`; cloudSync's supabase-js reads do not.

Second, smaller gap: `/api/health-check` may answer `state: 'measured'` (it just wrote the night to the ledger itself), but `useHealthCheck` only stores the answer. It relies on the stuck path above to bring the row in.

Third, upstream (not a bug): if the phone has not synced the band to Google yet, nothing anywhere has the night. `/api/health-check` already says `not-synced` for this. Opening Google Health is the only fix.

**Unverified:** this is from reading the code, not from catching it on the phone. Step 1 of the plan adds the logging that confirms it.

## Key audit

| Key | Where | Problem |
|---|---|---|
| Supabase **anon** key | Every client bundle (public by nature) | RLS is `select … using (true)` and `insert … with check (true)` for `anon` (`supabase/schema.sql:28-31`). Anyone who opens any of the five sites can read the key from the JS and **read your whole ledger (sleep, steps, weight) or insert fake rows**. This is the real key mistake. |
| Supabase anon key | Server (`server/health-shared.ts:23`) | The server should use the **service role** key (server-only env var) so the anon role can be narrowed. |
| `WEBHOOK_SECRET` + Google signature | Vercel env | Good. |
| `GOOGLE_REFRESH_TOKEN` | Vercel env | Good place. But when it dies (as on 21 Oct) nothing tells you; only the sleep row silently stops. |

## Plan (for Sonnet to implement)

Order matters: 1–3 fix the morning problem, 4–5 are the push upgrades, 6–7 are the key fix (needs you in the Supabase dashboard).

### 1. Make catch-up unable to hang — `lifeos/src/lib/cloudSync.ts`
- In `fetchEvents`, add `.abortSignal(AbortSignal.timeout(15_000))` to each query (supabase-js v2 supports it). A timeout returns `error` → `null` → `'failed'`, and `catching` is released in `finally`.
- Add one `console.info('[sync] catchUp', result, fresh.length)` line (and the same in the realtime status callback) so the next morning can confirm the cause from the phone's remote console.
- Done when: a fetch stalled in DevTools (throttling "offline" mid-request) no longer blocks the next poll.

### 2. Kick realtime on wake — same file
- In `onVisible`, if the channel's state is not `joined`, call `sb.removeChannel(channel)` and resubscribe (or `sb.realtime.connect()`), then `catchUp()`. Keeps push working after the phone sleeps instead of leaning on the 45 s poll.

### 3. Act on the health-check answer — `lifeos/src/lib/healthCheck.ts`, `src/App.tsx`
- When an answer comes back `'measured'`, trigger a ledger catch-up (expose `catchUp` from `useCloudSync`'s return, or dispatch a `lifeos:catchup` window event that cloudSync listens to). The row the server just wrote then shows within a second.

### 4. Realtime in the shared ledger client — `arbor/core/ledger.ts` (source of truth), synced copies in `pokedex/src/lib/ledger.ts` and `lifeos/src/arbor-core/ledger.ts`
- Add opt-in `realtime: true`: open the Supabase realtime websocket (`/realtime/v1/websocket?apikey=…&vsn=1.0.0`, Phoenix protocol, `postgres_changes` INSERT on `public.events` filtered to `o.types`) — or take `@supabase/supabase-js` as a dependency if the bundle size is acceptable; each new row runs the same path a poll result does.
- Keep the poll but stretch it to 5 min when the socket is joined; back to 30 s when it is not. Focus/visibility catch-up stays.
- Same timeout rule as step 1.
- Turn it on in the Pokedex only. Woodshed stays as is (it freezes its day plan on the first batch; see its README).

### 5. Webhook watchdog — `lifeos/server/health-webhook.ts`, `server/health-check.ts`
- Each webhook call (and each check-path sync) records `last_push_at` / `last_sync_error` — a tiny `health_status` table with one row, written by the server.
- `/api/health-check` returns them; Life OS shows "Google hasn't pushed in 36 h" or "Google sign-in expired — redo `ghealth auth login`" in the Sleep row instead of a silent wait. Catches the 21 Oct failure mode.

### 6. Server gets its own key — `lifeos/server/health-shared.ts`
- Read `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `VITE_`), fall back to anon until it is set. **You** add the env var in Vercel (Life OS project) and redeploy; Claude is blocked from writing secrets there.

### 7. Narrow the anon role — new `lifeos/supabase/2026-11-xx-rls.sql`
- Option A (simple): keep anon read, but deny anon insert of `type = 'vitals'` so only the server can write health rows.
- Option B (proper): add Supabase Auth (one magic-link user, you) to the five apps and change both policies to `to authenticated`. Bigger change, touches every app.
- Recommend A now, B later. **You** run the SQL in the Supabase SQL editor, and only after step 6 is live, or the webhook stops writing.

### Not worth changing
- The 2-minute health-check poll: it only runs while the night is missing and the page is open; making it push would need a socket to the server for no gain once step 3 lands.
- Google → server: already webhook.
- Phone → Google sync delay: no API for it.

## Safety notes for whoever implements
- Never boot Life OS against the live ledger with a fresh profile (it writes default-habit rows); use the nosync mode or a read-only proxy.
- `arbor/core/ledger.ts` is the source; copy it into the Pokedex and Life OS the way the existing "Sync game-core" commits do.
- Pushes to `iamcharizar-ai` repos need the `gh auth switch` dance.
