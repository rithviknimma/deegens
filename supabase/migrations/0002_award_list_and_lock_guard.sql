-- 1. Award picks must come from a fixed list (filled by supabase/award_options.sql).
-- 2. A lock time can't be changed once it has passed (that would reopen revealed picks).

create table public.award_options (
  kind text not null check (kind in ('player', 'rookie', 'coach')),
  name text not null,
  primary key (kind, name)
);
alter table public.award_options enable row level security;
-- Only read inside security-definer functions; the app ships its own copy of the list.

create or replace function public.save_bonus_picks(p_season text, p_picks jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public.current_player_id();
  v_key text;
  v_val text;
  v_kind text;
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

    v_kind := case v_key
      when 'roy' then 'rookie'
      when 'coy' then 'coach'
      when 'mvp' then 'player' when 'dpoy' then 'player' when 'smoy' then 'player' when 'mip' then 'player'
    end;
    if v_val is not null and v_kind is not null
       and not exists (select 1 from public.award_options where kind = v_kind and name = v_val) then
      raise exception '"%" isn''t on the % list', v_val, upper(v_key);
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

create or replace function public.admin_set_lock(p_season text, p_lock_at timestamptz, p_playoff_lock_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_season public.seasons;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into v_season from public.seasons where id = p_season;
  if v_season.id is null then raise exception 'Unknown season'; end if;

  if now() >= v_season.lock_at and p_lock_at is distinct from v_season.lock_at then
    raise exception 'Preseason picks already locked and revealed; the lock can''t be moved';
  end if;
  if v_season.playoff_lock_at is not null and now() >= v_season.playoff_lock_at
     and p_playoff_lock_at is distinct from v_season.playoff_lock_at then
    raise exception 'Bracket already locked; the lock can''t be moved';
  end if;

  update public.seasons set lock_at = p_lock_at, playoff_lock_at = p_playoff_lock_at
  where id = p_season;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
