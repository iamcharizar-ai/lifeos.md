# Is Vitals worth keeping? An assessment

Written 15 Oct 2026, from reading the Vitals repo (`vitals/README.md`, `core/model.ts`, `server/`, `tools/sync.mjs`), the guide's section 11, and how the Pokedex and Life OS read its data. It does not change anything.

## The question

"We already have data coming from Google Health and its command-line tool. What is Vitals for? Is it only a visual layer? If so, why not use Google Health directly, and is removing Vitals wise?"

## What Vitals is: three things in one repo

| Part | What it does | Who depends on it |
|---|---|---|
| **The bridge** (`server/`, `api/`, `tools/sync.mjs`) | Signs in to Google Health, reads the last 7 days each morning, and writes them into the shared ledger as `vitals` events. | **The game.** Neither the Pokedex nor Life OS talks to Google. They read the ledger. |
| **The scores** (`core/model.ts`) | Google Health returns raw readings only. This turns them into the **sleep score** (length 40, deep and REM 20, unbroken 20, steady bedtime 20) and **recovery**, and writes the numbers into the ledger so no other app recomputes them. | **The game.** A measured night is a pillar paid on this score; 80 fills it, 90 pays a second Bell. |
| **The viewer** (`src/`: trackers, trends, My page, Training, Band screen) | A Samsung-Health-style set of screens over the same data. | Nobody in the game. It is for looking. |

So the premise "we already have the data" is half true. Google has the data. **The game does not read Google.** What moves it from Google into the ledger, and what turns raw readings into the numbers the game pays on, is Vitals.

## What I can and cannot see

- Vitals' own README (5 Oct) says the band sync has **never run against a real Google account** and nothing is deployed. I cannot see anything newer in the repo.
- On this machine neither Go nor the `ghealth` tool is installed (`ghealth` and `go` are not on the path), so the PC script cannot run here.
- Whether data is reaching your ledger from somewhere else (another machine, the deployed Vercel job) I cannot tell from the code. **The quickest check:** open the Pokedex and look at Today. If "Last night" shows a score, a band reading has arrived. If it says "No band", none has.

## The options

| Option | What it means | Verdict |
|---|---|---|
| **A. Keep it all** | Pipeline and viewer. | Safe, but the viewer repeats what Google's own Health app already shows. |
| **B. Keep the pipeline, retire the viewer** | Keep `server/`, `api/`, `tools/sync.mjs`, `core/model.ts` and the Band connect screen. Drop the trackers, trends, My page and Training screens. | **Recommended.** It removes the part that duplicates something you already own, and keeps the only part the game needs. |
| **C. Remove Vitals, read Google directly from the Pokedex or Life OS** | Move sign-in, the daily job and the scoring into one of the apps. | Not wise. Both apps are static pages with the ledger as their only back end. They would need their own server functions, a stored Google sign-in and a daily schedule: Vitals' `server/` rebuilt somewhere else. The same work for no gain, and the two apps would each need to agree on the scores. |

## Why not just drop it

1. **Sleep is a pillar worth 100 XP** that depends on the score. Without a score the Sleep habit goes back to a 30 XP hand tick.
2. **The egg on steps** (your request) needs a daily step count to arrive. That path is the bridge.
3. **The boss's sleep task** ("four nights at 80 or more") reads the same score.
4. **A single place computes the scores.** That was a deliberate choice (`SLEEP-DESIGN.md`) so two apps never disagree about a night.

## Is the viewer just visuals?

Mostly. Two things in it are not duplicated elsewhere: the **bedtime guidance** (tonight's time, half an hour earlier than your usual, never earlier than your goal) and **Training** (what Strong's workouts add up to, with records). Everything else (sleep and steps trackers, trends, body composition, badges) is also in Google's own Health app. If you rarely open it, Option B costs you very little.

## What this means for the next steps

1. **Prove the bridge first.** Everything that depends on Vitals data (steps hatching eggs, a measured Sleep pillar, the boss's sleep task) is worth building only once one real morning's sync has landed in the ledger. Until then those features would be correct and silent.
2. **To prove it:** either open the Pokedex on a morning after the Vercel job should have run and check "Last night", or run the PC script once (`node tools/sync.mjs --dry-run`, which prints and writes nothing) on a machine with `ghealth` installed.
3. **Then decide between A and B.** That is a small, reversible change (hide the screens) and can wait.
4. **The egg-on-steps change** (rules version 12) should follow the first real sync, not precede it.

## Follow-up, 13 Oct: use the CLI directly, and retire the viewer

You asked whether the Google Health CLI could simply be integrated with the ecosystem. It can, and that is what is built now: **`pokedex/bridge/`**. The CLI gives raw readings; the bridge turns them into ledger events with the scores the game pays on, and the apps read the ledger as before. The Vitals *app* (viewer plus web server) is no longer in that path.

What I found on the way, which changes the picture above: the old PC script `vitals/tools/sync.mjs` wrote the readings but **not the sleep score or recovery**. Only the web sync (`vitals/server/sync.ts`) scored them. So the "direct CLI" path would have fed steps to the game and left the Sleep pillar unmeasured. `bridge/plan.ts` closes that gap, with a test that a night read from the band is written with its score and that a second run writes nothing.

What this leaves in the Vitals repo, untouched: the viewer (trackers, trends, My page, Training), the Vercel web sync and its Google sign-in. None of it is needed by the game. Archive the repo when you are happy with the bridge; nothing here deletes it.

Still true: **nothing has run against a real band yet** (`ghealth` is not installed on this machine). First check: `npm run health -- --dry-run` in the Pokedex folder, on a machine with `ghealth`.
