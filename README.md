# LifeOS - a personal dashboard for daily life


**Live**: https://redesign-life-os-ui.vercel.app · React + Supabase (TypeScript) · installable as a PWA

**Status (as of 2026-09-07)**: v2.1. LifeOS is now purely a habit tracker with 2 tabs (Daily · Monthly). Everything about a habit — adding, reordering, renaming, switching on/off, deleting — happens on the Daily tab; the separate Library tab is gone. Finished months are sealed and immutable, so habits can be deleted for good without losing history. Vault write-back was deliberately removed in v2.0 and this app no longer writes to or reads from any notes vault. Offline-first, append-only event log, and PWA install all still hold.

LifeOS is a personal web app (built by Rishabh, for Rishabh) that acts like a single home screen for the day's habits, instead of juggling apps.

## What it actually does

Two tabs. **Daily** is the day: your checklist up top, tap to tick, drag the handle to reorder, and a "shelf" underneath holding every habit you've switched off. **Monthly** is the history: a completion graph and a habit-by-day grid.

You open it once a day, tick a few things, and it keeps a running history.

## Months are sealed

The moment a month is behind you, the app writes it down for good — the habits that ran that month and how each day went. The Monthly tab reads that record and nothing else. This means:

- **Deleting a habit really deletes it.** No "we have to keep this for the recap."
- **Past months never move**, no matter what you do to your habits afterwards.
- **The current month stays live** and follows your edits, which is the point — this month is still yours to change.

Deleted habits are remembered as deleted, so a phone and a PC that disagree can never resurrect one.

## Linked habits (Arbor, Strong and Woodshed)

Three habits are fed by other apps through the same event ledger and wear those apps' looks:

- **Gym** is ticked by Strong. Finishing a workout there writes a `workout` event; Life OS ticks Gym from it. Once the first workout has come through, Gym can no longer be ticked by hand (until then it still can, so you are never locked out).
- **Arbor skills** opens into the calisthenics skills the Arbor coach picked for this morning. Tick each one here; type a number first to log a new best. Every tick is a `skill` event that Arbor reads, and the habit ticks itself when all of them are done. The day's plan is published once (a `plan` event) so the phone, the desktop and Strong all show the same thing.

- **Guitar** opens into today's practice session from the Woodshed coach. Log each item by how it went (rough, nearly, clean); every log is a `guitar` event that Woodshed reads, and the habit ticks itself when the whole session is logged. Woodshed has the tabs and the metronome. Set `VITE_WOODSHED_URL` to its address so the link in the block points there.

`src/woodshed-core/` is copied from the Woodshed repo (`npm run core` there): the guitar course and the coach. Do not edit it here.

`src/arbor-core/` is copied from the Arbor repo (`npm run core` there): the skill tree, the coach and the pixel figures. Do not edit it here.

## How your data is handled

- **Instant, offline-first**: everything you tick or type is saved straight to your device immediately - no waiting on a server.
- **Synced between phone and PC**: an optional cloud sync (via Supabase) lets an action on your phone show up on your PC in under a second, and vice versa. It works as an append-only log - every action is recorded as an event, and the current state is always rebuilt from that history rather than overwritten, so nothing gets silently lost.
- **Installable like an app**: it's a Progressive Web App, meaning you can add it to your phone's home screen from the browser and it behaves like a normal app icon, no app store needed.

## Setting up the cloud sync (optional, ~15 minutes)

1. Create a free Supabase project, open its SQL editor, and run the setup script included in this repo (`supabase/schema.sql`).
2. Copy `.env.example` to `.env.local` and fill in your project's Supabase URL and key.
3. Restart the app locally - the footer should switch from "cloud sync off" to "cloud sync live."
4. Deploy it (e.g. to Vercel) so you can open the same URL on your phone and add it to your home screen.

## Commands

    npm run dev      # run it locally at localhost:5173
    npm run build    # build the production version
    npm run lint     # check code style

## Rules this app follows

- Your running totals (like XP) are never stored directly - they're always recalculated from the full history of events, so there's no risk of a stored number silently drifting out of sync with reality.
- A habit's id never changes once it's created - that's what ties it to its history.
- A sealed month is never rewritten. If two devices seal the same month, the one that sealed it first wins.
