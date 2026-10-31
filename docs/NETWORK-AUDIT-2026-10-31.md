# Network and load audit: 31 Oct 2026

Until now the audits looked at system design and the cost of the code (time complexity, folds). This one looks at what goes over the wire: what each app downloads, how often, in what order, and what each deploy stores on Vercel. It covers Life OS (and its Google Health pipeline), the Pokedex, Arbor, Strong and Woodshed. Every number below was measured on the live ledger or a real build, not estimated.

## The short answer

| Problem | Measured | Fix (in this change) | After |
|---|---|---|---|
| Every Pokedex deploy stored all the sprites again | `dist` 104 MB per deploy; account deployment storage reached ~10 GB before the 28 Oct cleanup | Sprites moved out of `public/` into `sprites/`, deployed **once** as their own project, served at the same `/sprites/...` URLs through a rewrite | `dist` 3.4 MB per deploy |
| Life OS read the **whole ledger** on every open | 7 requests, ~1.3 MB, one 1000-row page after another (seconds on a phone) | The rows read are kept on the device (IndexedDB); an open folds that copy and asks only for rows inserted since | **1 request, 214 bytes, 135 ms**, with an identical result (all 12 local stores compared) |
| The Pokedex did the same, with an older ledger client | 5 sequential requests, **7.6 s** to first data | Pokedex now uses Arbor's ledger client (ids, overlap, timeouts) plus the same on-device copy | Data in **14 ms**, in sync with the server after **0.4 s, 1 request** |
| No index matches how the apps read | Every catch-up poll (each open app, every 30-45 s) filters on `inserted_at`, which had no index | `supabase/2026-10-31-indexes.sql` | Index lookups instead of full scans plus sorts (**run the file once, see below**) |
| Health webhook re-read all 12 data types per notification | A steps notification = 12+ Google requests; Google sends steps, distance, calories... as separate POSTs seconds apart | Reads only the kinds a notification names (sleep brings the overnight dailies) | 1 request for a steps update instead of 12+ |
| Racing health syncs wrote the same row twice | **211 of 780** `vitals` rows (27%) are exact duplicates | Each planned row gets an id made from its content and the ledger state it was planned on, written with `on_conflict=id` | Racing duplicates are kept once |
| Life OS fonts came from Google Fonts | A render-blocking chain HTML → CSS → fonts.googleapis.com → fonts.gstatic.com; never cached for offline | Self-hosted variable fonts (Outfit, Space Grotesk) and the IBM Plex Mono that was referenced but never loaded | No third-party hop; the service worker precaches them |

## How the system talks today

```
Google Health ──push──▶ Life OS /api/health-webhook ──▶ Google Health API (reads) ──▶ Supabase `events` (append-only)
                                                                                         ▲   │
     Life OS · Pokedex · Arbor · Strong · Woodshed ─── read on open, poll 30-45 s, write ─┘   │
     Life OS also: realtime channel (every insert)  ◀──────────────────────────────────────────┘
     Life OS ──<img>──▶ Pokedex /sprites/...  (partner sprite, items)
```

## The critique, in detail

### 1. Deploy storage: the sprites (fixed)

`pokedex/public/sprites` held 4,965 files, 102 MB, of which the animated GIFs (`ani/`, `ani-shiny/`) were 92 MB. Everything in `public/` is copied into every build, so every Pokedex deploy, including ones that changed one line, stored another 104 MB. Deployment storage climbed past 9.5 GB in October until old deployments were deleted on 28 Oct.

**New design.** The sprites are static and almost never change, so they are deployed apart from the app:

- `pokedex/sprites/` (no longer under `public/`) is its own Vercel project, `iamcharizar-pokedex-sprites`, deployed by hand with `npm run sprites:deploy` only when sprites are added.
- `pokedex/vercel.json` rewrites `/sprites/:path*` to that project. The app, its service worker and Life OS keep using the same `/sprites/...` paths, still same-origin for the Pokedex. The sprite project sends `immutable` with `s-maxage`, so Vercel's CDN keeps them and browsers fetch each one once.
- `vite.config.ts` serves `sprites/` at `/sprites` in `npm run dev` and `vite preview`, so local work and the screenshot tools are unchanged.
- `sprites/vercel.json` carries an `ignoreCommand` that skips the build unless `sprites/` changed, in case the project is ever connected to git instead.

Rollback still works: an old Pokedex deployment carries its own copy of the sprites.

### 2. The ledger: what each open downloads (fixed for Life OS and the Pokedex)

Measured: 4,505 rows, 4.57 MB in total. **`config` is 340 rows but 3.58 MB (78%)**, because each habit edit writes the whole habit library (~10.5 KB). Life OS and the Pokedex already read only the newest `config`; the rest of the history (~1 MB) was read in full on every open, 1000 rows per request, one request after another with offset paging (each page costs the database more than the last).

**New design: local-first reads.** The ledger is append-only, so "the rows I already have, plus everything inserted after my cursor" is the whole history.

- **Life OS** (`src/lib/rowCache.ts`, `cloudSync.ts`): an open folds the IndexedDB copy straight away, then one catch-up fetches what is new. The copy keeps only the newest `config` row. It is thrown away after a week, so a full read still happens weekly (a bound on anything the overlap window could miss).
- **Shared client** (`arbor/core/ledger.ts`, copied to the Pokedex, Strong, Woodshed): the same, opt-in with `cache: true`. Turned on for the Pokedex, whose game is a fold over ~4,000 rows. Not turned on for Woodshed, which freezes its day plan as soon as the first batch lands and should not freeze on a copy that may be a few seconds behind.
- **Catch-up correctness:** Life OS's catch-up had no overlap: a row whose transaction started before a neighbour's but committed after it was skipped by `inserted_at > cursor`. It now re-reads 60 s before the cursor and drops what it has already applied, by id. The Pokedex's old client had the same gap and wrote rows without ids (a retry after a lost response duplicated them); it now uses the shared client, which has both.
- **Boot CPU:** each game row (vitals, boss days, item uses...) re-derived the whole game and rewrote its localStorage copy, ~900 times per boot. They are now handed over in one batch first.
- **Retries:** when a batch insert failed for a connection reason (offline, timeout, 5xx), Life OS resent every queued row one by one, turning one failed request into N. It now does that only when the server rejected the data.
- **Config poll:** the Pokedex re-downloaded the ~10 KB habit library every minute. It now asks for "a config newer than mine", which answers `[]` when nothing changed.

### 3. Indexes (written; you run it once)

The table had only `(at)` and `(day)`. The queries actually used:

| Query | Who | Index now |
|---|---|---|
| `inserted_at > X order by inserted_at, id` | every catch-up, every app, every 30-45 s | `(inserted_at, id)` |
| `type in (...) order by at, id` | first open of the Pokedex, Arbor, Strong, Woodshed | `(type, at, id)` |
| `type = vitals and day >= X` | health webhook, `/api/health-check`, Life OS's first-open head query | `(type, day)` |
| newest `config` | Life OS, Pokedex | `(type, at, id)` |

### 4. Google Health pipeline (fixed)

What one notification cost before, and now:

| Step | Before | Now |
|---|---|---|
| Google reads | all 12 kinds, whatever changed | only the kinds named (`kindsFor` in `bridge/webhook.ts`) |
| Ledger read of 35 days of vitals | after the Google reads finished | at the same time as the sign-in and the Google reads |
| Write | plain insert; racing syncs duplicated rows | deterministic id + `on_conflict=id`, ignore duplicates (`bridge/plan.ts`) |
| `npm run health` | 12 CLI calls one after another | all 12 at once |

The id is made from the row's content **and** the newest row the ledger held for that day when it was planned. Two syncs racing on the same notification burst plan the same row from the same ledger, so they make the same id and one is kept. A later write of the same numbers, after something else changed them, sees a newer row and gets a new id, so it still lands. Covered by two new tests.

### 5. Life OS boot (partly fixed)

- **Fonts:** fixed (self-hosted, see the table).
- **Service worker:** navigations were network-first with no timeout, so a weak signal meant a blank screen until the browser gave up. Now the cached shell is served after 2.5 s (the Pokedex already did this), and the slow answer still refreshes the cache.
- **Bundle:** 283 KB gzipped in one chunk (framer-motion, all of supabase-js including auth, ~340 KB of game-core source). **Not split on purpose:** the service worker precaches only what `index.html` references, so a lazily loaded Monthly tab would break offline. Splitting needs the worker to precache every chunk first. A follow-up.
- **Build skipping:** Life OS rebuilt on every push. It now has the same `ignoreCommand` as the Pokedex, and both compare against the last deployed commit (`VERCEL_GIT_PREVIOUS_SHA`) instead of only the previous commit, so a push of several commits is judged as a whole.

## Not done, and why

1. **Run `lifeos/supabase/2026-10-31-indexes.sql`** in the Supabase SQL editor. It needs the dashboard (no database password is kept here). Safe to run twice.
2. **Vitals is retired but still deployed** (`vitals` project). Anyone opening it reads its full history and polls every 30 s. It can be deleted on Vercel; nothing reads from it.
3. **Bundle splitting** for Life OS (section 5): needs the service worker change first.
4. **92 MB of animated GIFs:** animated WebP would be roughly half the size. Worth doing only if the sprite project ever needs redeploying often; with the new layout it is stored once, so it no longer multiplies.
5. **Seven copies of the ledger client.** Arbor's is canonical; Life OS and Vitals have their own. A shared package would stop the drift.
6. **Vercel usage oddities to look at:** ~21K ISR writes and 22 cron invocations this month, though none of these apps declares ISR or a cron. Most likely an older project on the account.

## Deploying the next build without filling storage again

Order matters: the rewrite must have a target before the Pokedex deploy that drops the sprites.

1. Sign the Vercel CLI into the iamcharizar account (it is currently signed into `rishabhvelocity3-6479`): `npx vercel login`.
2. `cd pokedex && npm run sprites:deploy`. This creates `iamcharizar-pokedex-sprites` and uploads the sprites **once** (~100 MB). Check that `https://iamcharizar-pokedex-sprites.vercel.app/items/key-stone.png` loads.
3. Push the Pokedex. That deploy is ~3.4 MB, and every later one is too.
4. Check `https://pokedex-theta-swart.vercel.app/sprites/items/key-stone.png` (through the rewrite), then delete the older Pokedex deployments (~104 MB each) in the Vercel dashboard, keeping the newest production one plus one rollback.
5. Push Life OS, Arbor, Strong and Woodshed (small deploys).
