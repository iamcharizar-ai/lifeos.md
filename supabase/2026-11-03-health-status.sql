-- The health watchdog's one row. Run in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Safe to run at any time and again: every statement is idempotent.
--
-- server/health-webhook.ts notes each push from Google here, and server/health-shared.ts notes whether the
-- last read of Google worked. /api/health-check turns it into a warning on the Sleep row (bridge/watch.ts).
-- It holds codes and times only, never error text.

create table if not exists public.health_status (
  id            text primary key,          -- 'google'
  last_push_at  timestamptz,               -- last verified notification from Google
  last_sync_at  timestamptz,               -- last read of Google that did not fail
  last_error    text check (last_error in ('auth', 'read')),
  last_error_at timestamptz
);

alter table public.health_status enable row level security;

-- Readable by the anon role (the server reads it with whichever key it has). No insert or update policy:
-- only the service-role key, which skips RLS, can write it. Until SUPABASE_SERVICE_ROLE_KEY is set in
-- Vercel the server's note is refused and ignored, and the warning simply never appears.
drop policy if exists "anon select" on public.health_status;
create policy "anon select" on public.health_status for select to anon using (true);
