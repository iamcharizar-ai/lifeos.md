# LifeOS - a personal dashboard for daily life

LifeOS is a personal web app (built by Rishabh, for Rishabh) that acts like a single home screen for tracking day-to-day life - habits, health, body stats, spending, and a visual map of notes - instead of juggling five different apps.

## What it actually does

Think of it as one dashboard with a few tabs, each covering a different part of daily life (for example: today's habits, health numbers, money spent, and a visual graph of connected notes). You open it once a day, glance at it or tick a few things, and it keeps a running history.

## How your data is handled

- **Instant, offline-first**: everything you tick or type is saved straight to your device immediately - no waiting on a server.
- **Backed up to your notes vault**: on a PC, it also writes a copy of today's state into a daily note inside the user's Obsidian notes vault, in a fixed format, so the vault always has a readable historical record.
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
    npm run graph    # refresh the notes graph from the vault
    npm run lint     # check code style

## Rules this app follows

- Your running totals (like balance or XP) are never stored directly - they're always recalculated from the full history of events, so there's no risk of a stored number silently drifting out of sync with reality.
- The format it writes back into the notes vault never changes to suit the app - the app always adapts to match the vault's existing format, not the other way around.
