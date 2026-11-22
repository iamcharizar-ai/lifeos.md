# The health bridge

Life OS is where the workspace talks to Google Health. The bridge reads the band (a Fitbit Air, through the Google Health API) into the shared ledger as `vitals` events; Life OS, the Pokedex and the other apps read the ledger, never Google. It lived in the Pokedex until 21 Oct 2026, and before that in the Vitals app, which is retired.

```
Fitbit Air -> Google Health -> api/health-webhook (Google calls it)  -> ledger (`vitals`) -> Life OS, Pokedex
                            -> api/health-check  (Life OS asks)    /
                            -> npm run health    (by hand, the PC) /
    map.ts: Google's shapes -> a day's readings
    model.ts + plan.ts: the sleep score and recovery, worked out once, here
```

## What the apps take from it

- the **sleep score** (`sleepScore`): a measured night ends the day in Life OS and fills the Sleep pillar (80 fills it, 90 pays a second Bell in the Pokedex); the boss's sleep task and the sky's weather read it
- **steps** (`steps`): in the Pokedex, 10,000 pays an Iron mark and a walking feat, and steps warm the Mystery Egg. In Life OS they fill the **Steps** tile (below).
- **water** (`waterMl`, from Google Health's `hydration-log`): fills the **Water** tile. Nothing in the game reads it directly.
- **recovery** (`recovery`), once a week of mornings has HRV and resting heart rate

## Steps and Water tiles

Two core habits (30 XP, not pillars) that Google Health fills and nothing in the app can tick (`src/lib/vitalHabits.ts`). The tile is the progress bar: 5,000 of 10,000 steps colours half of it. The habit is ticked only at 100%, through an ordinary `tick`, so the game needs no rule for it; below that the tile shows its percentage and pays nothing. Goals are constants there: 10,000 steps (the API does not hand over the goal set in the Google Health app) and 4,000 ml of water.

Water needs one thing from you, once: the Google sign-in must include the **Nutrition (read)** scope. Run `ghealth auth login` again with it, put the new refresh token in `GOOGLE_REFRESH_TOKEN` on Vercel and redeploy. Until then only the water read fails (it is logged, and nothing else is affected) and the tile reads "Waiting for Google Health". Water is read whenever steps notify (steps arrive every few minutes), so it needs no subscription of its own; a `hydration-log` subscription would also work.

The water rollup, as the live API sends it (checked 22 Nov 2026), is `hydrationLog: { amountConsumed: { millilitersSum } }`, two levels down unlike the other rollups; `waterOf` in `bridge/health.ts` finds the number by what it is, at any depth. If the tile ever stays empty, look at a raw `ghealth data hydration-log daily-rollup` row.

Logging water sends no notification of its own, so the app asks: while a Steps or Water tile is on the checklist and the app is open, `useVitalsRefresh` calls `/api/health-check?vitals=1` on opening, on coming back into view and every two minutes; the server reads today's and yesterday's steps and water from Google (at most every 45 s) and writes what is new.

In the Monthly graph the Steps, Water and Sleep rows show their number in the box (percent of the goal, or the sleep score). A box is green only when the day counted: 100% for Steps and Water, 80 or more for Sleep (`SLEEP_DONE`); a day that fell short keeps its number in a plain box.

## Which night counts

Google Health also receives nights from other apps through Health Connect (Samsung Health sent every night until the Air arrived on 21 Oct 2026). Those are one stage-less "ASLEEP" block. A night with stages (deep, light, REM: the band's) always beats one without; between two of a kind the longest wins. A night only another app saw still counts, so a night without the band is not lost.

## Run it

```
npm run health -- --dry-run     print what would be written
npm run health                  last 3 days into the ledger
npm run health -- --days 14     a longer catch-up
npm test                        the bridge's tests (no Google needed)
npm run api                     rebuild api/ after changing server/ or bridge/ (also part of npm run build)
```

`npm run health` needs `ghealth` on PATH (or `GHEALTH_BIN`; it is built at `~/bin/ghealth`), signed in with `ghealth setup`, and `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. It is safe to run twice: a day whose numbers match the ledger writes nothing.

`api/` is generated but checked in, because Vercel runs those files as they are.

## The webhook

Google tells us when a day changes. `server/health-webhook.ts` (served at `/api/health-webhook`) checks the shared secret and Google's signature, answers 204, then reads the touched days and writes what is new. Notifications come in bursts, so a burst may write the same row a few times; the apps keep the newest value per field, so nothing counts twice.

Vercel production variables (names only, never commit values): `WEBHOOK_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (the Desktop OAuth client and sign-in from `~/.config/ghealth/`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `HEALTH_TZ` (default Asia/Kolkata). If the sign-in is ever renewed (`ghealth auth login`), update `GOOGLE_REFRESH_TOKEN` and redeploy.

The Google Cloud project's consent screen is in production, so the sign-in does not lapse after 7 days. Its homepage and privacy page are `public/privacy.html` here.

The subscriber `lifeos-health` (steps, sleep, weight, distance) is managed from a separate ghealth config, because webhook admin needs the `cloud-platform` scope and a token carrying it is refused by the data endpoints:

```
GHEALTH_CONFIG_DIR=~/.config/ghealth-webhooks
ghealth auth login --scopes cloud-platform
ghealth webhooks subscribers update ...   (endpoint https://<life os>/api/health-webhook)
```

Use the project number, not the project ID, in that config (with the ID the API answers 403). **Never revoke afterwards.** Both configs use the same OAuth client, and revoking any of its tokens (or removing the app at myaccount.google.com/permissions) revokes them all, the data sign-in included: on 21 Oct 2026 that silently cut the bridge off from Google. Just delete `~/.config/ghealth-webhooks/credentials.json` instead.

## "Is last night in yet?"

`server/health-check.ts` (served at `/api/health-check`) is what Life OS's Sleep row asks while it waits. It answers from the ledger when the night is there; otherwise it reads Google itself (at most once a minute) with the same sync as the webhook, so a night never depends on the webhook alone. The answer names the hold-up: `not-synced` (Google has no night ending today: open Google Health so the phone syncs), `scoring`, `measured` or `error`. The decisions are in `check.ts`, tested without Google.
