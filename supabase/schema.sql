-- LifeOS event ledger — run ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- Append-only: every habit tick, metric, workout, spend and skill change is an
-- immutable event row. Balance/XP are always derived in the app, never stored here.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  device text not null,          -- 8-char device id (echo suppression for realtime)
  at timestamptz not null,       -- when the event happened (client clock)
  day date not null,             -- the daily/ note this event belongs to
  type text not null,            -- tick | untick | metric | health | workout | workout_clear | spend | skill
  payload jsonb not null default '{}'::jsonb,
  inserted_at timestamptz not null default now()
);

create index if not exists events_at_idx on public.events (at);
create index if not exists events_day_idx on public.events (day);

-- Single-user system: the anon key is the credential (don't publish the URL+key pair).
-- RLS on, select+insert only — no update/delete policies, so the ledger is
-- append-only even if the key leaks into a client bundle.
alter table public.events enable row level security;

drop policy if exists "anon select" on public.events;
create policy "anon select" on public.events for select to anon using (true);

drop policy if exists "anon insert" on public.events;
create policy "anon insert" on public.events for insert to anon with check (true);

-- Realtime: broadcast inserts to every connected device (<1s phone↔PC sync)
alter publication supabase_realtime add table public.events;
