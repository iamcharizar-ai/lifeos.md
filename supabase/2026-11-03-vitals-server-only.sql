-- Only the server may write the band's readings (`vitals` rows). Run in the Supabase SQL editor.
--
-- RUN THIS ONLY AFTER:
--   1. SUPABASE_SERVICE_ROLE_KEY is set in the Life OS Vercel project (Settings -> Environment Variables,
--      Production) and the project is redeployed, AND
--   2. SUPABASE_SERVICE_ROLE_KEY is in lifeos/.env.local if you still use `npm run health` from the PC.
-- Otherwise the webhook starts getting 403/42501 on every write and the nights stop arriving.
-- (Check first: after the redeploy, open /api/health-check with the night missing; Vercel logs should show
-- "wrote N day(s)" with no ledger error.)
--
-- Why: the anon key is in every app's JavaScript, so anyone can read it and post rows as the band. The ledger
-- stays readable and writable by the apps for everything else (ticks, plans, boss cards, ...); only `vitals`
-- is closed to anon. The service-role key skips RLS, so the server is unaffected.
--
-- What this does NOT do: the anon key can still READ the ledger, because the apps read it without a sign-in.
-- Closing that needs a login, which Life OS deliberately does not have. Keep the site URLs private.
--
-- To undo: re-run the "anon insert" policy line from supabase/schema.sql.

drop policy if exists "anon insert" on public.events;
create policy "anon insert" on public.events for insert to anon with check (type <> 'vitals');
