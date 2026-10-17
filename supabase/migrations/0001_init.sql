-- deegens v1: players, passcode join, name+PIN login, preseason picks.
--
-- Security model:
--   * Every browser gets an anonymous Supabase session (auth.uid()).
--   * player_sessions maps that session to one of our players after a
--     successful join (passcode) or login (name + PIN).
--   * Tables are read through RLS; all writes go through security-definer
--     functions that check membership, lock times and input.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Single-row config. No policies, so it is unreadable from the API.
create table public.app_config (
  id boolean primary key default true check (id),
  passcode_hash text
);
insert into public.app_config default values;

create table public.teams (
  id text primary key,
  name text not null,
  conference text not null check (conference in ('East', 'West'))
);

create table public.seasons (
  id text primary key,                 -- e.g. '2026-27'
  lock_at timestamptz not null,        -- preseason picks lock (first tipoff)
  playoff_lock_at timestamptz,         -- bracket lock (first round 1 game)
  is_current boolean not null default false
);
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index players_name_unique on public.players (lower(display_name));

create table public.player_sessions (
  auth_uid uuid primary key references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('join', 'login')),
  auth_uid uuid,
  player_id uuid references public.players (id) on delete cascade,
  success boolean not null,
  at timestamptz not null default now()
);
create index auth_attempts_recent on public.auth_attempts (at);

create table public.seed_picks (
  player_id uuid not null references public.players (id) on delete cascade,
  season_id text not null references public.seasons (id),
  team_id text not null references public.teams (id),
  conference text not null,
  seed int not null check (seed between 1 and 15),
  primary key (player_id, season_id, team_id),
  unique (player_id, season_id, conference, seed)
);

create table public.bonus_picks (
  player_id uuid not null references public.players (id) on delete cascade,
  season_id text not null references public.seasons (id),
  category text not null check (category in (
    'east_champ', 'west_champ', 'champion',
    'mvp', 'roy', 'dpoy', 'smoy', 'mip', 'coy'
  )),
  pick text not null check (length(pick) between 1 and 80),
  primary key (player_id, season_id, category)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select player_id from public.player_sessions where auth_uid = auth.uid();
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_admin from public.players p where p.id = public.current_player_id()),
    false
  );
$$;

create function public.season_locked(p_season text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select now() >= s.lock_at from public.seasons s where s.id = p_season), true);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security (reads only; no write policies)
-- ---------------------------------------------------------------------------

alter table public.app_config enable row level security;
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.seed_picks enable row level security;
alter table public.bonus_picks enable row level security;

create policy "members read teams" on public.teams
  for select to authenticated using (public.current_player_id() is not null);

create policy "members read seasons" on public.seasons
  for select to authenticated using (public.current_player_id() is not null);

-- pin_hash is hidden by the column grant below.
create policy "members read players" on public.players
  for select to authenticated using (public.current_player_id() is not null);

-- Own picks any time; everyone's picks once the season has locked.
create policy "read seed picks" on public.seed_picks
  for select to authenticated using (
    player_id = public.current_player_id()
    or (public.current_player_id() is not null and public.season_locked(season_id))
  );

create policy "read bonus picks" on public.bonus_picks
  for select to authenticated using (
    player_id = public.current_player_id()
    or (public.current_player_id() is not null and public.season_locked(season_id))
  );

revoke all on all tables in schema public from anon, authenticated;
grant select on public.teams, public.seasons, public.seed_picks, public.bonus_picks to authenticated;
grant select (id, display_name, is_admin, created_at) on public.players to authenticated;

-- ---------------------------------------------------------------------------
-- Auth functions
-- ---------------------------------------------------------------------------

-- Returns the signed-in player, or nothing.
create function public.me()
returns table (id uuid, display_name text, is_admin boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, p.is_admin
  from public.players p
  where p.id = public.current_player_id();
$$;

-- Join with the group passcode. Returns the new player id, or null if the
-- passcode is wrong. The first player to join becomes admin.
create function public.join_group(p_passcode text, p_name text, p_pin text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if (select count(*) from public.auth_attempts
      where kind = 'join' and auth_uid = auth.uid() and not success
        and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many attempts. Try again later.';
  end if;

  select passcode_hash into v_hash from public.app_config;
  if v_hash is null then
    raise exception 'The group passcode has not been set up yet';
  end if;

  if extensions.crypt(p_passcode, v_hash) <> v_hash then
    insert into public.auth_attempts (kind, auth_uid, success) values ('join', auth.uid(), false);
    return null;
  end if;

  if v_name !~ '^[A-Za-z0-9][A-Za-z0-9 ._''-]{0,23}$' then
    raise exception 'Name must be 1-24 letters, numbers, spaces or . _ '' -';
  end if;
  if p_pin !~ '^\d{6}$' then
    raise exception 'PIN must be exactly 6 digits';
  end if;
  if exists (select 1 from public.players where lower(display_name) = lower(v_name)) then
    raise exception 'That name is taken. If it''s you, log in instead.';
  end if;

  insert into public.players (display_name, pin_hash, is_admin)
  values (
    v_name,
    extensions.crypt(p_pin, extensions.gen_salt('bf')),
    not exists (select 1 from public.players)
  )
  returning id into v_id;

  insert into public.player_sessions (auth_uid, player_id) values (auth.uid(), v_id)
  on conflict (auth_uid) do update set player_id = excluded.player_id, created_at = now();
  insert into public.auth_attempts (kind, auth_uid, player_id, success) values ('join', auth.uid(), v_id, true);
  return v_id;
end;
$$;

-- Log in on a new device. Returns the player id, or null on a bad name/PIN.
-- 5 failed PINs in 15 minutes locks that name temporarily.
create function public.login(p_name text, p_pin text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_player public.players;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if (select count(*) from public.auth_attempts
      where kind = 'login' and auth_uid = auth.uid() and not success
        and at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many attempts. Try again later.';
  end if;

  select * into v_player from public.players where lower(display_name) = lower(btrim(p_name));

  if v_player.id is not null and (
    select count(*) from public.auth_attempts
    where kind = 'login' and player_id = v_player.id and not success
      and at > now() - interval '15 minutes') >= 5 then
    raise exception 'Too many wrong PINs for this name. Wait 15 minutes.';
  end if;

  if v_player.id is null or extensions.crypt(p_pin, v_player.pin_hash) <> v_player.pin_hash then
    insert into public.auth_attempts (kind, auth_uid, player_id, success)
    values ('login', auth.uid(), v_player.id, false);
    return null;
  end if;

  insert into public.player_sessions (auth_uid, player_id) values (auth.uid(), v_player.id)
  on conflict (auth_uid) do update set player_id = excluded.player_id, created_at = now();
  insert into public.auth_attempts (kind, auth_uid, player_id, success)
  values ('login', auth.uid(), v_player.id, true);
  return v_player.id;
end;
$$;

create function public.logout() returns void
language sql security definer set search_path = '' as $$
  delete from public.player_sessions where auth_uid = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Picks
-- ---------------------------------------------------------------------------

-- Replace a player's seeding for one conference. p_teams is ordered 1..15.
create function public.save_seed_picks(p_season text, p_conference text, p_teams text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public.current_player_id();
begin
  if v_player is null then raise exception 'Not a member'; end if;
  if public.season_locked(p_season) then raise exception 'Picks are locked'; end if;
  if p_conference not in ('East', 'West') then raise exception 'Bad conference'; end if;

  if cardinality(p_teams) <> 15
     or (select count(distinct t) from unnest(p_teams) t) <> 15
     or (select count(*) from public.teams
         where id = any (p_teams) and conference = p_conference) <> 15 then
    raise exception 'Seeding must rank all 15 % teams exactly once', p_conference;
  end if;

  delete from public.seed_picks
  where player_id = v_player and season_id = p_season and conference = p_conference;

  insert into public.seed_picks (player_id, season_id, team_id, conference, seed)
  select v_player, p_season, t.team, p_conference, t.ord::int
  from unnest(p_teams) with ordinality as t (team, ord);
end;
$$;

-- Upsert bonus picks from {"category": "pick", ...}. Empty values are removed.
create function public.save_bonus_picks(p_season text, p_picks jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public.current_player_id();
  v_key text;
  v_val text;
  v_east text := nullif(btrim(p_picks ->> 'east_champ'), '');
  v_west text := nullif(btrim(p_picks ->> 'west_champ'), '');
  v_champ text := nullif(btrim(p_picks ->> 'champion'), '');
begin
  if v_player is null then raise exception 'Not a member'; end if;
  if public.season_locked(p_season) then raise exception 'Picks are locked'; end if;

  if v_east is not null and not exists (select 1 from public.teams where id = v_east and conference = 'East') then
    raise exception 'East champion must be an East team';
  end if;
  if v_west is not null and not exists (select 1 from public.teams where id = v_west and conference = 'West') then
    raise exception 'West champion must be a West team';
  end if;
  if v_champ is not null and v_champ is distinct from v_east and v_champ is distinct from v_west then
    raise exception 'Champion must be one of your conference champions';
  end if;

  for v_key, v_val in select key, nullif(btrim(value), '') from jsonb_each_text(p_picks) loop
    if v_key not in ('east_champ', 'west_champ', 'champion', 'mvp', 'roy', 'dpoy', 'smoy', 'mip', 'coy') then
      raise exception 'Unknown pick category %', v_key;
    end if;
    if v_val is null then
      delete from public.bonus_picks
      where player_id = v_player and season_id = p_season and category = v_key;
    else
      insert into public.bonus_picks (player_id, season_id, category, pick)
      values (v_player, p_season, v_key, left(v_val, 80))
      on conflict (player_id, season_id, category) do update set pick = excluded.pick;
    end if;
  end loop;
end;
$$;

-- Who has submitted what, without revealing picks before the lock.
create function public.submission_status(p_season text)
returns table (player_id uuid, display_name text, seed_count int, bonus_count int)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name,
    (select count(*)::int from public.seed_picks s where s.player_id = p.id and s.season_id = p_season),
    (select count(*)::int from public.bonus_picks b where b.player_id = p.id and b.season_id = p_season)
  from public.players p
  where public.current_player_id() is not null
  order by p.created_at;
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create function public.admin_reset_pin(p_player uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_pin !~ '^\d{6}$' then raise exception 'PIN must be exactly 6 digits'; end if;
  update public.players set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = p_player;
  -- Clear lockouts so they can log in right away.
  delete from public.auth_attempts where player_id = p_player and not success;
end;
$$;

create function public.admin_set_passcode(p_passcode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if length(p_passcode) < 8 then raise exception 'Passcode must be at least 8 characters'; end if;
  update public.app_config set passcode_hash = extensions.crypt(p_passcode, extensions.gen_salt('bf'));
end;
$$;

create function public.admin_set_lock(p_season text, p_lock_at timestamptz, p_playoff_lock_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.seasons set lock_at = p_lock_at, playoff_lock_at = p_playoff_lock_at
  where id = p_season;
end;
$$;

create function public.admin_remove_player(p_player uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_player = public.current_player_id() then raise exception 'You can''t remove yourself'; end if;
  delete from public.players where id = p_player;
end;
$$;

-- Functions are only callable by signed-in (incl. anonymous) sessions.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.teams (id, name, conference) values
  ('ATL', 'Atlanta Hawks', 'East'),
  ('BOS', 'Boston Celtics', 'East'),
  ('BKN', 'Brooklyn Nets', 'East'),
  ('CHA', 'Charlotte Hornets', 'East'),
  ('CHI', 'Chicago Bulls', 'East'),
  ('CLE', 'Cleveland Cavaliers', 'East'),
  ('DAL', 'Dallas Mavericks', 'West'),
  ('DEN', 'Denver Nuggets', 'West'),
  ('DET', 'Detroit Pistons', 'East'),
  ('GS', 'Golden State Warriors', 'West'),
  ('HOU', 'Houston Rockets', 'West'),
  ('IND', 'Indiana Pacers', 'East'),
  ('LAC', 'LA Clippers', 'West'),
  ('LAL', 'Los Angeles Lakers', 'West'),
  ('MEM', 'Memphis Grizzlies', 'West'),
  ('MIA', 'Miami Heat', 'East'),
  ('MIL', 'Milwaukee Bucks', 'East'),
  ('MIN', 'Minnesota Timberwolves', 'West'),
  ('NO', 'New Orleans Pelicans', 'West'),
  ('NY', 'New York Knicks', 'East'),
  ('OKC', 'Oklahoma City Thunder', 'West'),
  ('ORL', 'Orlando Magic', 'East'),
  ('PHI', 'Philadelphia 76ers', 'East'),
  ('PHX', 'Phoenix Suns', 'West'),
  ('POR', 'Portland Trail Blazers', 'West'),
  ('SAC', 'Sacramento Kings', 'West'),
  ('SA', 'San Antonio Spurs', 'West'),
  ('TOR', 'Toronto Raptors', 'East'),
  ('UTAH', 'Utah Jazz', 'West'),
  ('WSH', 'Washington Wizards', 'East');

-- First tipoff per ESPN: BOS @ DET, Tue Oct 20 2026 19:00 UTC. Adjust in the admin page if it moves.
insert into public.seasons (id, lock_at, is_current) values ('2026-27', '2026-10-20 19:00:00+00', true);
