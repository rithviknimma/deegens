import { useEffect, useState } from 'react';
import { TeamLogo } from '../components/TeamLogo';
import { useAuth } from '../lib/auth';
import { AWARDS, BONUS_LABELS, TEAM_BY_ID, teamsIn, tierOf, type Conference } from '../lib/nba';
import { errorMessage, fetchCurrentSeason, supabase, type Season } from '../lib/supabase';
import { formatCountdown, useNow } from '../lib/useNow';

type Status = { player_id: string; display_name: string; seed_count: number; bonus_count: number };
type SeedPick = { player_id: string; team_id: string; conference: string; seed: number };
type BonusPick = { player_id: string; category: string; pick: string };

const BONUS_TOTAL = 3 + AWARDS.length;

export function Group() {
  const { player } = useAuth();
  const now = useNow();
  const [season, setSeason] = useState<Season | null>(null);
  const [status, setStatus] = useState<Status[]>([]);
  const [seeds, setSeeds] = useState<SeedPick[]>([]);
  const [bonus, setBonus] = useState<BonusPick[]>([]);
  const [conf, setConf] = useState<Conference>('East');
  const [error, setError] = useState('');

  const locked = season ? now >= new Date(season.lock_at).getTime() : false;

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchCurrentSeason();
        const { data, error } = await supabase.rpc('submission_status', { p_season: s.id });
        if (error) throw error;
        setStatus(data as Status[]);
        setSeason(s);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, []);

  // Everyone's picks become readable once the season locks (enforced by RLS).
  useEffect(() => {
    if (!season || !locked) return;
    (async () => {
      const [s, b] = await Promise.all([
        supabase.from('seed_picks').select('player_id, team_id, conference, seed').eq('season_id', season.id),
        supabase.from('bonus_picks').select('player_id, category, pick').eq('season_id', season.id),
      ]);
      if (s.error || b.error) return setError(errorMessage(s.error ?? b.error));
      setSeeds(s.data);
      setBonus(b.data);
    })();
  }, [season, locked]);

  if (error) return <p className="error">{error}</p>;
  if (!season) return <p className="muted">Loading…</p>;

  if (!locked) {
    return (
      <div>
        <div className="banner">
          Picks are hidden until the lock: <strong>{formatCountdown(new Date(season.lock_at).getTime() - now)}</strong>
        </div>
        <h2>Who's in ({status.length})</h2>
        <ul className="card status-list">
          {status.map((p) => (
            <li key={p.player_id}>
              <span>
                {p.display_name}
                {p.player_id === player?.id && <span className="muted"> (you)</span>}
              </span>
              <span className="chips">
                <span className={`chip ${p.seed_count === 30 ? 'done' : ''}`}>Seeding {p.seed_count === 30 ? '✓' : '–'}</span>
                <span className={`chip ${p.bonus_count === BONUS_TOTAL ? 'done' : ''}`}>
                  Picks {p.bonus_count}/{BONUS_TOTAL}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const players = status.filter((p) => p.seed_count > 0 || p.bonus_count > 0);
  const seedOf = (playerId: string, teamId: string) =>
    seeds.find((s) => s.player_id === playerId && s.team_id === teamId)?.seed;

  // Sort teams by the group's average predicted seed.
  const teams = teamsIn(conf)
    .map((t) => {
      const picks = players.map((p) => seedOf(p.player_id, t.id)).filter((x): x is number => x != null);
      return { team: t, avg: picks.length ? picks.reduce((a, b) => a + b, 0) / picks.length : 99 };
    })
    .sort((a, b) => a.avg - b.avg);

  return (
    <div>
      <div className="banner locked">🔒 Picks locked. Here's what everyone said.</div>

      <h2>Seeding</h2>
      <div className="tabs" role="tablist">
        {(['East', 'West'] as const).map((c) => (
          <button key={c} role="tab" aria-selected={conf === c} className={conf === c ? 'active' : ''} onClick={() => setConf(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">Team</th>
              <th title="Group average">Avg</th>
              {players.map((p) => (
                <th key={p.player_id}>{p.display_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map(({ team, avg }) => (
              <tr key={team.id}>
                <th className="sticky team-cell">
                  <TeamLogo teamId={team.id} size={20} /> {team.shortName}
                </th>
                <td className="muted">{avg < 99 ? avg.toFixed(1) : '–'}</td>
                {players.map((p) => {
                  const seed = seedOf(p.player_id, team.id);
                  return (
                    <td key={p.player_id} className={seed ? `tier-${tierOf(seed)}` : ''}>
                      {seed ?? '–'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Bonus picks</h2>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="sticky">Pick</th>
              {players.map((p) => (
                <th key={p.player_id}>{p.display_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(BONUS_LABELS).map((cat) => (
              <tr key={cat}>
                <th className="sticky">{BONUS_LABELS[cat]}</th>
                {players.map((p) => {
                  const pick = bonus.find((b) => b.player_id === p.player_id && b.category === cat)?.pick;
                  const team = pick ? TEAM_BY_ID[pick] : undefined;
                  return (
                    <td key={p.player_id} className="text-cell">
                      {team ? <><TeamLogo teamId={team.id} size={18} /> {team.shortName}</> : pick ?? '–'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
