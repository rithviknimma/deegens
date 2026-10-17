import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { errorMessage, fetchCurrentSeason, supabase, type Season } from '../lib/supabase';

type Member = { id: string; display_name: string; is_admin: boolean };

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function Admin() {
  const { player } = useAuth();
  const [season, setSeason] = useState<Season | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [lockAt, setLockAt] = useState('');
  const [playoffLockAt, setPlayoffLockAt] = useState('');
  const [passcode, setPasscode] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function load() {
    try {
      const s = await fetchCurrentSeason();
      const { data, error } = await supabase.from('players').select('id, display_name, is_admin').order('created_at');
      if (error) throw error;
      setSeason(s);
      setLockAt(toLocalInput(s.lock_at));
      setPlayoffLockAt(toLocalInput(s.playoff_lock_at));
      setMembers(data);
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setMessage(null);
    const { error } = await fn();
    if (error) setMessage({ kind: 'error', text: errorMessage(error) });
    else {
      setMessage({ kind: 'ok', text: ok });
      load();
    }
  }

  function saveLocks(e: FormEvent) {
    e.preventDefault();
    if (!season) return;
    run(
      () => supabase.rpc('admin_set_lock', { p_season: season.id, p_lock_at: fromLocalInput(lockAt), p_playoff_lock_at: fromLocalInput(playoffLockAt) }),
      'Lock times saved',
    );
  }

  function savePasscode(e: FormEvent) {
    e.preventDefault();
    run(() => supabase.rpc('admin_set_passcode', { p_passcode: passcode }), 'Passcode changed. Share the new one with the group.');
    setPasscode('');
  }

  function resetPin(m: Member) {
    const pin = window.prompt(`New 6-digit PIN for ${m.display_name}:`);
    if (pin) run(() => supabase.rpc('admin_reset_pin', { p_player: m.id, p_pin: pin }), `PIN reset for ${m.display_name}`);
  }

  function remove(m: Member) {
    if (window.confirm(`Remove ${m.display_name} and all their picks? This can't be undone.`)) {
      run(() => supabase.rpc('admin_remove_player', { p_player: m.id }), `${m.display_name} removed`);
    }
  }

  if (!player?.is_admin) return <p className="error">Admins only.</p>;
  if (!season) return <p className="muted">Loading…</p>;

  return (
    <div className="admin">
      {message && <p className={message.kind === 'ok' ? 'success' : 'error'}>{message.text}</p>}

      <h2>Season {season.id}</h2>
      <form className="card form" onSubmit={saveLocks}>
        <label>
          Preseason picks lock (your local time)
          <input type="datetime-local" value={lockAt} onChange={(e) => setLockAt(e.target.value)} required />
        </label>
        <label>
          Playoff bracket lock
          <input type="datetime-local" value={playoffLockAt} onChange={(e) => setPlayoffLockAt(e.target.value)} />
        </label>
        <button className="btn">Save lock times</button>
      </form>

      <h2>Members ({members.length})</h2>
      <ul className="card status-list">
        {members.map((m) => (
          <li key={m.id}>
            <span>
              {m.display_name}
              {m.is_admin && <span className="muted"> (admin)</span>}
            </span>
            <span className="chips">
              <button className="btn small" onClick={() => resetPin(m)}>Reset PIN</button>
              {m.id !== player.id && (
                <button className="btn small danger" onClick={() => remove(m)}>Remove</button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <h2>Group passcode</h2>
      <form className="card form" onSubmit={savePasscode}>
        <label>
          New passcode (8+ characters)
          <input type="password" value={passcode} minLength={8} onChange={(e) => setPasscode(e.target.value)} required autoComplete="off" />
        </label>
        <p className="hint">Changing it doesn't log anyone out. It only affects new joins.</p>
        <button className="btn">Change passcode</button>
      </form>
    </div>
  );
}
