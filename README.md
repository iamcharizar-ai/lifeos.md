# LifeOS — HUD

Personal OS frontend: 6-tab HUD (Dashboard · Habits · Health · Body · Wallet · Graph) backed by the Obsidian vault. React + Vite + TS + Tailwind + Framer Motion.

- **Spec authority**: `wiki/outputs/lifeos-master-plan.md` in the vault (XP economy, phases, data-ownership law)
- **Session state**: `wiki/outputs/lifeos-session-status.md`

## Commands

```bash
npm run dev        # localhost:5173
npm run build      # typecheck + dist/
npm run graph      # regenerate public/graph.json from the vault
npm run lint       # oxlint
```

## Architecture

- **Local state**: localStorage maps (ticks/metrics/health/workouts/spends/skills) — instant, offline-first
- **Vault write-back (PC)**: File System Access API mirrors today's state into `daily/YYYY-MM-DD.md` in the exact template format (`src/lib/vaultSync.ts`)
- **Cloud sync (phone↔PC)**: Supabase append-only event ledger (`src/lib/cloudSync.ts`) — every mutation emits an immutable event; state is derived by folding events. Inert until env keys exist.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` — installable on the phone from the deployed URL

## Supabase + Vercel setup (the 15-minute runbook)

1. **Supabase**: create a free project → Dashboard → SQL editor → paste + run `supabase/schema.sql`
2. Copy `.env.example` → `.env.local`, fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Project Settings → API)
3. Restart `npm run dev` — footer should flip from "cloud sync off" to "☁️ cloud sync live". First boot with an empty table auto-seeds it from existing localStorage history.
4. **Vercel**: push this repo to GitHub → vercel.com → Import project → framework auto-detects Vite → add both `VITE_SUPABASE_*` env vars in project settings → Deploy
5. Open the URL on the phone (Chrome) → menu → **Add to Home screen** → tick a habit → it appears on the PC in <1s and lands in the vault's daily note

## Rules baked in

- Ledger is append-only; balance/XP always derived, never stored
- Habit ids in `src/config/habits.ts` are stable forever — they key the ledger and write-back
- Vault format never changes; the write-back conforms to the vault, not vice versa
