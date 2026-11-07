# Letting an AI read your data

Written 2026-11-08. The apps are pictures: every page is an empty `<div id="root">` plus JavaScript, and the data loads only inside your own browser. ChatGPT and Gemini fetch a pasted link as text and do not run the JavaScript, so they saw nothing. This adds a plain-text view of the whole system, and an MCP server over the same thing.

## What you paste

`npm run ai:links` prints these from the key in `.env.local`:

| Link | Gives |
|---|---|
| `https://redesign-life-os-ui.vercel.app/api/ai/<secret>` | everything |
| `https://pokedex-theta-swart.vercel.app/ai/<secret>` | habits, months, game |
| `https://arbor-umber.vercel.app/ai/<secret>` | Arbor skills, workouts |
| `https://woodshed-sooty.vercel.app/ai/<secret>` | guitar |
| `https://strong-five.vercel.app/ai/<secret>` | workouts, Arbor |

The per-app links are rewrites to the Life OS one with `?sections=` filled in, so pasting any app's address plus the secret works.

Add to any of them: `?days=60` (history, 14 by default, 120 at most), `?sections=body,game` (today, habits, months, game, body, arbor, woodshed, workouts), `?format=json`, `?redact=health` (no band readings, weight or Sleep; for a link you share more widely).

The page starts with a short "how to read this" that explains the apps and the words (pillar, partner, boss), so a model that has never seen the system can use it. A default 14-day page is about 4,000 tokens; 120 days about 7,000.

## MCP

`https://redesign-life-os-ui.vercel.app/api/mcp/<secret>` (or `/api/mcp` with `Authorization: Bearer <secret>`). Streamable HTTP, stateless. Add it as a custom connector in Claude, ChatGPT (developer mode) or Cursor, or `gemini mcp add` in the Gemini CLI. Tools, all read-only: `get_snapshot`, `get_today`, `get_habits`, `get_months`, `get_game`, `get_health`, `get_arbor`, `get_woodshed`, `get_workouts`, `list_event_types`, `query_events` (raw ledger rows by type and day). Consumer Gemini and a plain ChatGPT chat have no MCP: use the pasted link there.

## How it works

`server/ai-data.ts` reads the ledger over REST (GET only; kept in memory while the function is warm, then only newer rows are fetched). `server/ai-snapshot.ts` folds the rows with the same cores the apps run (`game-core`, `arbor-core`, `woodshed-core`) and writes Markdown or JSON, so the AI is told what the screens show. It is not a second copy of any rule. `server/ai.ts` serves the text, `server/mcp.ts` the MCP server, `server/ai-http.ts` the key check. `scripts/build-api.mjs` bundles them into `api/ai*.js` and `api/mcp*.js`.

Changing a rule in `game-core` (copied from the Pokedex) changes what the snapshot says the next time Life OS is built, the same as for the app.

## The secret

`AI_SNAPSHOT_TOKEN` in the Life OS Vercel project (Production), at least 24 characters. Without one the feature is shut (503), never open. A wrong key gets a bare 404 and the ledger is not touched. The key can ride in the path, `?k=`, `Authorization: Bearer` or `x-api-key`; it is compared by digest in constant time.

- **The link is the key.** Anyone with it can read the data until you change the token. It also lands in that AI's chat history, and the data goes to that company under its own terms.
- **Cut every link off:** change `AI_SNAPSHOT_TOKEN` in Vercel, redeploy, run `npm run ai:links` for the new ones.
- **Share more widely** with `?redact=health` (and the same on the MCP URL, which also hides `get_health` and the health event types from `query_events`). The game's numbers still carry what the band earned, so this is not a guarantee of silence about your sleep.
- The Supabase anon key in the apps' bundles can still read the whole ledger. That is the old single-user trade-off (see `supabase/2026-11-03-vitals-server-only.sql`); this does not change it, and does not widen it: a pasted link reads no more than that key already could.

## Read-only, and what was checked

Nothing here writes: every request to the database is a GET (a test fails if any other method is sent), and the MCP server has no write tool. `npm test` covers the key (wrong, missing, short, three ways to send it), paging past the 1,000-row cap, the warm refresh asking only for newer rows, the MCP protocol, redaction, and the Markdown for an empty ledger. Run against the real ledger on 2026-11-08: 4,551 rows read in 1.7 s over 6 GETs, built in under 100 ms.

Not checked before the first deploy: the Vercel rewrites (`/ai/:token` on each app, and the external ones to Life OS) and the dynamic `api/ai/[token]` route. `curl` the links after the first deploy.

## Not in the snapshot

Raw sets of Strong sessions beyond the summary's exercises, the Pokedex's full collection and bag, the older `config` copies, and anything older than the first tick. `query_events` reaches the raw rows for anything else.
