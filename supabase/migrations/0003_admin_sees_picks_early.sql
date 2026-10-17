-- The admin can read everyone's picks before the lock (to help fix issues).
-- Other players still only see their own picks until the season locks.

drop policy "read seed picks" on public.seed_picks;
create policy "read seed picks" on public.seed_picks
  for select to authenticated using (
    player_id = public.current_player_id()
    or (public.current_player_id() is not null and (public.season_locked(season_id) or public.is_admin()))
  );

drop policy "read bonus picks" on public.bonus_picks;
create policy "read bonus picks" on public.bonus_picks
  for select to authenticated using (
    player_id = public.current_player_id()
    or (public.current_player_id() is not null and (public.season_locked(season_id) or public.is_admin()))
  );
