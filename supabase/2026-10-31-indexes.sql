-- Indexes for how the apps actually read the ledger. Run ONCE in the Supabase SQL editor
-- (Dashboard -> SQL -> New query). Safe to run again: every statement is "if not exists".
--
-- Before this the table had only (at) and (day), so:
--   * every catch-up poll (each open app, every 30-45 s: inserted_at > cursor order by inserted_at, id)
--     was a full scan plus a sort;
--   * "the newest config row" walked the whole (at) index backwards, filtering on type;
--   * the health sync's "vitals since day X" read the (day) index, then filtered and sorted.

-- catch-up polls and the on-device cache's "what is new since my cursor" (all apps)
create index if not exists events_inserted_idx on public.events (inserted_at, id);

-- first boot of an app that reads a few types, oldest first (Pokedex, Arbor, Strong, Woodshed)
create index if not exists events_type_at_idx on public.events (type, at, id);

-- vitals for a range of days (health webhook, /api/health-check, Life OS's boot head query)
create index if not exists events_type_day_idx on public.events (type, day);

-- (at) stays for Life OS's first full read (order by at, id with no type filter). (day) alone is
-- now unused, but at this size it costs nothing, so it is left in place.

analyze public.events;
