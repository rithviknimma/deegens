import { useEffect, useMemo, useState } from 'react';
import { SeedList } from '../components/SeedList';
import { TeamLogo } from '../components/TeamLogo';
import { useAuth } from '../lib/auth';
import { AWARDS, TEAM_BY_ID, teamsIn, type Conference, type OptionGroup } from '../lib/nba';
import { POINTS, PLAYOFF_LINE } from '../lib/scoring';
import { errorMessage, fetchCurrentSeason, supabase, type Season } from '../lib/supabase';
import { formatCountdown, useNow } from '../lib/useNow';

type Bonus = Record<string, string>;

const alphabetical = (conf: Conference) => teamsIn(conf).map((t) => t.id);

export function Picks() {
  const { player } = useAuth();
  const now = useNow();
  const [season, setSeason] = useState<Season | null>(null);
  const [order, setOrder] = useState<Record<Conference, string[]>>({ East: alphabetical('East'), West: alphabetical('West') });
  const [bonus, setBonus] = useState<Bonus>({});
  const [conf, setConf] = useState<Conference>('East');
  const [dirty, setDirty] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchCurrentSeason();
        const [seeds, bonuses] = await Promise.all([
          supabase.from('seed_picks').select('team_id, conference, seed').eq('player_id', player!.id).eq('season_id', s.id),
          supabase.from('bonus_picks').select('category, pick').eq('player_id', player!.id).eq('season_id', s.id),
        ]);
        if (seeds.error) throw seeds.error;
        if (bonuses.error) throw bonuses.error;
        const next = { East: alphabetical('East'), West: alphabetical('West') };
        for (const c of ['East', 'West'] as const) {
          const rows = seeds.data.filter((r) => r.conference === c).sort((a, b) => a.seed - b.seed);
          if (rows.length === 15) next[c] = rows.map((r) => r.team_id);
        }
        setOrder(next);
        setBonus(Object.fromEntries(bonuses.data.map((b) => [b.category, b.pick])));
        setHasSaved(seeds.data.length > 0 || bonuses.data.length > 0);
        setSeason(s);
      } catch (e) {
        setLoadError(errorMessage(e));
      }
    })();
  }, [player]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const locked = season ? now >= new Date(season.lock_at).getTime() : false;

  function updateOrder(c: Conference, next: string[]) {
    setOrder((o) => ({ ...o, [c]: next }));
    setDirty(true);
    setStatus(null);
  }

  function updateBonus(key: string, value: string) {
    setBonus((b) => {
      const next = { ...b, [key]: value };
      // The champion has to be one of the two conference champs.
      if (next.champion && next.champion !== next.east_champ && next.champion !== next.west_champ) next.champion = '';
      return next;
    });
    setDirty(true);
    setStatus(null);
  }

  async function save() {
    if (!season) return;
    setSaving(true);
    setStatus(null);
    try {
      for (const c of ['East', 'West'] as const) {
        const { error } = await supabase.rpc('save_seed_picks', { p_season: season.id, p_conference: c, p_teams: order[c] });
        if (error) throw error;
      }
      const picks = Object.fromEntries(
        ['east_champ', 'west_champ', 'champion', ...AWARDS.map((a) => a.key)].map((k) => [k, bonus[k] ?? '']),
      );
      const { error } = await supabase.rpc('save_bonus_picks', { p_season: season.id, p_picks: picks });
      if (error) throw error;
      setDirty(false);
      setHasSaved(true);
      setStatus({ kind: 'ok', text: 'Saved ✓ You can keep editing until the lock.' });
    } catch (e) {
      setStatus({ kind: 'error', text: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  const missing = useMemo(() => {
    const keys = ['east_champ', 'west_champ', 'champion', ...AWARDS.map((a) => a.key)];
    return keys.filter((k) => !bonus[k]).length;
  }, [bonus]);

  if (loadError) return <p className="error">{loadError}</p>;
  if (!season) return <p className="muted">Loading…</p>;

  const lockMs = new Date(season.lock_at).getTime() - now;

  if (locked && !hasSaved) {
    return (
      <div className="banner locked">
        🔒 Preseason picks closed at opening tip before you submitted. You can still play daily picks and the playoff
        bracket when they open. Check the Group tab to see everyone's picks.
      </div>
    );
  }

  return (
    <div className="picks">
      <div className={`banner ${locked ? 'locked' : ''}`}>
        {locked ? (
          <>🔒 Picks are locked. See everyone's picks on the Group tab.</>
        ) : (
          <>
            Picks lock in <strong>{formatCountdown(lockMs)}</strong>
            <span className="muted"> · {new Date(season.lock_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </>
        )}
      </div>

      <section>
        <h2>Seeding</h2>
        {!locked && (
          <p className="hint">
            Drag or tap the arrows. {POINTS.exactSeed} pts per exact seed, plus {POINTS.playoffCall} per team for calling
            whether it makes the playoffs (your top {PLAYOFF_LINE}).
          </p>
        )}
        <div className="tabs" role="tablist">
          {(['East', 'West'] as const).map((c) => (
            <button key={c} role="tab" aria-selected={conf === c} className={conf === c ? 'active' : ''} onClick={() => setConf(c)}>
              {c}
            </button>
          ))}
        </div>
        <SeedList order={order[conf]} onChange={locked ? undefined : (next) => updateOrder(conf, next)} />
      </section>

      <section>
        <h2>Playoffs</h2>
        <p className="hint">
          Your #1 seeds come from your seeding: <strong>{TEAM_BY_ID[order.East[0]].shortName}</strong> and{' '}
          <strong>{TEAM_BY_ID[order.West[0]].shortName}</strong> ({POINTS.oneSeed} pts each).
        </p>
        <div className="card form">
          <TeamSelect label={`East champion · ${POINTS.confChamp} pts`} conf="East" value={bonus.east_champ ?? ''} disabled={locked} onChange={(v) => updateBonus('east_champ', v)} />
          <TeamSelect label={`West champion · ${POINTS.confChamp} pts`} conf="West" value={bonus.west_champ ?? ''} disabled={locked} onChange={(v) => updateBonus('west_champ', v)} />
          <div className="field">
            <span>NBA champion · {POINTS.champion} pts</span>
            {bonus.east_champ && bonus.west_champ ? (
              <div className="choice">
                {[bonus.east_champ, bonus.west_champ].map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={bonus.champion === t ? 'active' : ''}
                    disabled={locked}
                    onClick={() => updateBonus('champion', t)}
                  >
                    <TeamLogo teamId={t} size={22} /> {TEAM_BY_ID[t].shortName}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">Pick both conference champions first.</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2>Awards</h2>
        <p className="hint">{POINTS.award} pts each. Players are grouped by team.</p>
        <div className="card form">
          {AWARDS.map((a) => (
            <label key={a.key}>
              {a.label}
              <PersonSelect
                groups={a.groups}
                value={bonus[a.key] ?? ''}
                disabled={locked}
                onChange={(v) => updateBonus(a.key, v)}
              />
            </label>
          ))}
        </div>
      </section>

      {!locked && (
        <div className="save-bar">
          <span className="muted">
            {dirty ? 'Unsaved changes' : hasSaved ? 'All changes saved' : 'Not submitted yet'}
            {missing > 0 && ` · ${missing} pick${missing > 1 ? 's' : ''} left`}
          </span>
          <button className="btn primary" onClick={save} disabled={saving || (!dirty && hasSaved)}>
            {saving ? 'Saving…' : 'Save picks'}
          </button>
        </div>
      )}
      {status && <p className={status.kind === 'ok' ? 'success' : 'error'}>{status.text}</p>}
    </div>
  );
}

function PersonSelect({
  groups,
  value,
  disabled,
  onChange,
}: {
  groups: readonly OptionGroup[];
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  // Keep a saved pick visible even if that name has since dropped off the list.
  const listed = groups.some((g) => g.names.includes(value));
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick one</option>
      {value && !listed && <option value={value}>{value}</option>}
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function TeamSelect({
  label,
  conf,
  value,
  disabled,
  onChange,
}: {
  label: string;
  conf: Conference;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pick a team</option>
        {teamsIn(conf).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
