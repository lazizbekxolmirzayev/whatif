-- WHAT IF? — database schema
-- Postgres / Supabase. Apply with `supabase db push` (or the SQL editor).
-- Authoritative full world state lives in Storage (gzip blobs); the relational tables
-- below hold metadata, reference data, and per-turn normalised snapshots of multiplayer
-- worlds (queryable for timelines, statistics and leaderboards).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- users & profiles
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  display_name text not null default 'Chronicler' check (char_length(display_name) between 1 and 32),
  stats jsonb not null default '{}'::jsonb,
  favorites text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email) on conflict do nothing;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(left(new.raw_user_meta_data->>'display_name', 32), 'Chronicler')) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- reference data
create table public.cities (
  id text primary key,
  lon double precision not null check (lon between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  founded integer not null,
  abandoned integer,
  names jsonb not null -- [[until_year, name], ...]
);

create table public.historical_events (
  id uuid primary key default gen_random_uuid(),
  scenario_id text,
  year integer not null,
  month smallint not null check (month between 0 and 11),
  title text not null,
  description text not null,
  countries text[] not null default '{}',
  is_documented boolean not null default true -- documented history vs. alternative
);
create index historical_events_year_idx on public.historical_events (year, month);
create index historical_events_scenario_idx on public.historical_events (scenario_id);

-- ---------------------------------------------------------------- scenarios
create table public.scenario_definitions (
  id text primary key check (char_length(id) between 3 and 80),
  author_id uuid references public.users(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  question text not null check (char_length(question) between 10 and 400),
  start_year integer not null check (start_year between -500 and 2010),
  map_key text not null,
  definition jsonb not null,
  is_public boolean not null default false,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint definition_size check (pg_column_size(definition) < 200000)
);
create index scenario_public_idx on public.scenario_definitions (is_public, updated_at desc);
create index scenario_author_idx on public.scenario_definitions (author_id);

create table public.scenario_decisions (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null references public.scenario_definitions(id) on delete cascade,
  decision_key text not null,
  question text not null,
  options jsonb not null, -- [{id,label,description,historical}]
  depends_on jsonb,
  unique (scenario_id, decision_key)
);

-- ---------------------------------------------------------------- multiplayer
create table public.multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 2 and 40),
  host_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  map_key text not null,
  start_year integer not null,
  scenario_id text,
  is_public boolean not null default true,
  max_players smallint not null default 4 check (max_players between 2 and 8),
  turn_months smallint not null default 6 check (turn_months in (1, 3, 6, 12)),
  turn_number integer not null default 0,
  world_path text,
  created_at timestamptz not null default now()
);
create index rooms_lobby_idx on public.multiplayer_rooms (is_public, status, created_at desc);

create table public.multiplayer_players (
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  country_name text,
  country_id text,
  ready boolean not null default false,
  submitted_turn integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create unique index players_country_unique on public.multiplayer_players (room_id, country_name) where country_name is not null;

-- ---------------------------------------------------------------- worlds & saves
create table public.game_worlds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete cascade,
  room_id uuid unique references public.multiplayer_rooms(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('scenario', 'sandbox', 'custom', 'multiplayer')),
  scenario_id text,
  map_key text not null,
  seed bigint not null,
  sim_year integer not null,
  sim_month smallint not null check (sim_month between 0 and 11),
  storage_path text not null,
  state_hash text,
  version integer not null default 1, -- optimistic concurrency for server writes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is not null or room_id is not null)
);
create index game_worlds_owner_idx on public.game_worlds (owner_id);

create table public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slot text not null check (char_length(slot) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  simulation_date text,
  size_bytes integer check (size_bytes >= 0 and size_bytes < 50000000),
  is_autosave boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);
create index saved_games_user_idx on public.saved_games (user_id, updated_at desc);

-- normalised per-turn snapshots of a world (written by Edge Functions only)
create table public.countries (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_id text not null,
  name text not null,
  government text not null,
  color text,
  flag jsonb,
  alive boolean not null default true,
  overlord_id text,
  is_player boolean not null default false,
  capital_province integer,
  updated_at timestamptz not null default now(),
  primary key (world_id, country_id)
);
create table public.provinces (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  province_id integer not null,
  name text not null,
  owner_id text,
  controller_id text,
  population bigint not null default 0 check (population >= 0),
  development smallint not null default 1,
  buildings jsonb not null default '{}'::jsonb,
  unrest real not null default 0,
  primary key (world_id, province_id)
);
create index provinces_owner_idx on public.provinces (world_id, owner_id);
create table public.country_relations (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_a text not null,
  country_b text not null,
  opinion real not null default 0 check (opinion between -200 and 200),
  trust real not null default 30,
  primary key (world_id, country_a, country_b),
  check (country_a < country_b)
);
create table public.diplomacy (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_a text not null,
  country_b text not null,
  kind text not null check (kind in ('alliance', 'trade', 'nap', 'guarantee', 'vassal', 'war', 'truce')),
  since_year integer, since_month smallint,
  details jsonb
);
create index diplomacy_world_idx on public.diplomacy (world_id, kind);
create table public.economy_state (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_id text not null, year integer not null,
  treasury double precision, gdp double precision, income double precision, expenses double precision,
  tax_rate real, inflation real, debt double precision,
  primary key (world_id, country_id, year)
);
create table public.population_state (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_id text not null, year integer not null,
  population bigint, growth_rate real, urbanization real, famine_deaths bigint, epidemic_deaths bigint, war_deaths bigint,
  primary key (world_id, country_id, year)
);
create table public.food_state (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_id text not null, year integer not null,
  production double precision, consumption double precision, stock double precision, shortage real,
  primary key (world_id, country_id, year)
);
create table public.technology_state (
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  country_id text not null, year integer not null,
  tech_level real, known text[], researching text, education real,
  primary key (world_id, country_id, year)
);
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.game_worlds(id) on delete cascade,
  event_key text not null,
  year integer not null, month smallint not null,
  kind text not null,
  title text not null,
  description text not null,
  countries text[] not null default '{}',
  is_documented boolean not null default false,
  importance smallint not null default 1,
  unique (world_id, event_key)
);
create index timeline_world_date_idx on public.timeline_events (world_id, year desc, month desc);

create table public.achievements (
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id text not null check (char_length(achievement_id) < 64),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------- rate limiting
create table public.api_rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);
create or replace function public.check_rate_limit(p_user uuid, p_action text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
declare n integer;
begin
  insert into api_rate_limits (user_id, action, window_start, hits) values (p_user, p_action, w, 1)
  on conflict (user_id, action, window_start) do update set hits = api_rate_limits.hits + 1
  returning hits into n;
  delete from api_rate_limits where window_start < now() - interval '1 day';
  return n <= p_max;
end $$;
revoke all on function public.check_rate_limit from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from multiplayer_players where room_id = p_room and user_id = auth.uid())
      or exists (select 1 from multiplayer_rooms where id = p_room and host_id = auth.uid());
$$;
create or replace function public.can_read_world(p_world uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from game_worlds g where g.id = p_world and (g.owner_id = auth.uid() or (g.room_id is not null and public.is_room_member(g.room_id))));
$$;
create or replace function public.find_room_by_code(p_code text) returns public.multiplayer_rooms
language sql stable security definer set search_path = public as $$
  select * from multiplayer_rooms where code = upper(p_code) and status <> 'finished' limit 1;
$$;
grant execute on function public.find_room_by_code to authenticated;

-- players may change their own lobby fields, never turn bookkeeping or assigned ids
create or replace function public.guard_player_update() returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then return new; end if;
  if new.submitted_turn <> old.submitted_turn or coalesce(new.country_id, '') <> coalesce(old.country_id, '') then
    raise exception 'submitted_turn and country_id are server-managed';
  end if;
  if new.country_name is distinct from old.country_name and (select status from multiplayer_rooms where id = new.room_id) <> 'lobby' then
    raise exception 'countries can only be changed in the lobby';
  end if;
  return new;
end $$;
create trigger guard_player_update before update on public.multiplayer_players for each row execute function public.guard_player_update();

create or replace function public.guard_room_capacity() returns trigger language plpgsql as $$
begin
  if (select count(*) from multiplayer_players where room_id = new.room_id) >= (select max_players from multiplayer_rooms where id = new.room_id) then
    raise exception 'room is full';
  end if;
  if (select status from multiplayer_rooms where id = new.room_id) <> 'lobby' then raise exception 'game already started'; end if;
  return new;
end $$;
create trigger guard_room_capacity before insert on public.multiplayer_players for each row execute function public.guard_room_capacity();

-- ---------------------------------------------------------------- row level security
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.historical_events enable row level security;
alter table public.scenario_definitions enable row level security;
alter table public.scenario_decisions enable row level security;
alter table public.multiplayer_rooms enable row level security;
alter table public.multiplayer_players enable row level security;
alter table public.game_worlds enable row level security;
alter table public.saved_games enable row level security;
alter table public.countries enable row level security;
alter table public.provinces enable row level security;
alter table public.country_relations enable row level security;
alter table public.diplomacy enable row level security;
alter table public.economy_state enable row level security;
alter table public.population_state enable row level security;
alter table public.food_state enable row level security;
alter table public.technology_state enable row level security;
alter table public.timeline_events enable row level security;
alter table public.achievements enable row level security;
alter table public.api_rate_limits enable row level security;

create policy users_self on public.users for select using (id = auth.uid());
create policy profiles_read on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy cities_read on public.cities for select using (true);
create policy hist_events_read on public.historical_events for select using (true);

create policy scen_read on public.scenario_definitions for select using (is_public or is_builtin or author_id = auth.uid());
create policy scen_insert on public.scenario_definitions for insert with check (author_id = auth.uid() and not is_builtin);
create policy scen_update on public.scenario_definitions for update using (author_id = auth.uid() and not is_builtin) with check (author_id = auth.uid() and not is_builtin);
create policy scen_delete on public.scenario_definitions for delete using (author_id = auth.uid() and not is_builtin);
create policy scen_dec_read on public.scenario_decisions for select using (exists (select 1 from scenario_definitions s where s.id = scenario_id and (s.is_public or s.is_builtin or s.author_id = auth.uid())));
create policy scen_dec_write on public.scenario_decisions for all using (exists (select 1 from scenario_definitions s where s.id = scenario_id and s.author_id = auth.uid())) with check (exists (select 1 from scenario_definitions s where s.id = scenario_id and s.author_id = auth.uid()));

create policy rooms_read on public.multiplayer_rooms for select using (is_public or host_id = auth.uid() or public.is_room_member(id));
create policy rooms_insert on public.multiplayer_rooms for insert with check (host_id = auth.uid() and status = 'lobby' and turn_number = 0 and world_path is null);
create policy rooms_delete on public.multiplayer_rooms for delete using (host_id = auth.uid());
-- (status/turn/world updates are performed by the Edge Function with the service role)

create policy players_read on public.multiplayer_players for select using (public.is_room_member(room_id));
create policy players_join on public.multiplayer_players for insert with check (user_id = auth.uid() and submitted_turn = 0 and country_id is null and ready = false);
create policy players_update on public.multiplayer_players for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy players_leave on public.multiplayer_players for delete using (user_id = auth.uid());

create policy worlds_read on public.game_worlds for select using (owner_id = auth.uid() or (room_id is not null and public.is_room_member(room_id)));
create policy worlds_own_write on public.game_worlds for insert with check (owner_id = auth.uid() and room_id is null);
create policy worlds_own_update on public.game_worlds for update using (owner_id = auth.uid() and room_id is null) with check (owner_id = auth.uid() and room_id is null);
create policy worlds_own_delete on public.game_worlds for delete using (owner_id = auth.uid() and room_id is null);

create policy saves_own on public.saved_games for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ach_read on public.achievements for select using (user_id = auth.uid());
create policy ach_write on public.achievements for insert with check (user_id = auth.uid());
create policy ach_update on public.achievements for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy c_read on public.countries for select using (public.can_read_world(world_id));
create policy p_read on public.provinces for select using (public.can_read_world(world_id));
create policy r_read on public.country_relations for select using (public.can_read_world(world_id));
create policy d_read on public.diplomacy for select using (public.can_read_world(world_id));
create policy e_read on public.economy_state for select using (public.can_read_world(world_id));
create policy pop_read on public.population_state for select using (public.can_read_world(world_id));
create policy f_read on public.food_state for select using (public.can_read_world(world_id));
create policy t_read on public.technology_state for select using (public.can_read_world(world_id));
create policy tl_read on public.timeline_events for select using (public.can_read_world(world_id));
-- api_rate_limits: no policies → only service role.

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table public.multiplayer_rooms;
alter publication supabase_realtime add table public.multiplayer_players;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public) values ('saves', 'saves', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('worlds', 'worlds', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('game-data', 'game-data', true) on conflict do nothing;

create policy saves_rw on storage.objects for all to authenticated
  using (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'saves' and (storage.foldername(name))[1] = auth.uid()::text);
-- worlds/<room_id>/world.wif : readable by room members, written only by the service role
create policy worlds_read on storage.objects for select to authenticated
  using (bucket_id = 'worlds' and public.is_room_member(((storage.foldername(name))[1])::uuid));
create policy game_data_read on storage.objects for select using (bucket_id = 'game-data');
