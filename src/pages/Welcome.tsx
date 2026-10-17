import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/supabase';

export function Welcome() {
  const { join, login } = useAuth();
  const [mode, setMode] = useState<'join' | 'login'>('join');
  const [passcode, setPasscode] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'join') await join(passcode, name, pin);
      else await login(name, pin);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="welcome">
      <h1 className="wordmark">deegens</h1>
      <p className="muted">
        NBA predictions for the group. Picks lock at opening tip. <Link to="/how">How it works →</Link>
      </p>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')}>
          Join
        </button>
        <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
          Log in
        </button>
      </div>

      <form className="card form" onSubmit={submit}>
        {mode === 'join' && (
          <label>
            Group passcode
            <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required autoComplete="off" />
          </label>
        )}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={24} autoComplete="username" />
        </label>
        <label>
          6-digit PIN
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            required
            autoComplete={mode === 'join' ? 'new-password' : 'current-password'}
          />
        </label>
        {mode === 'join' && <p className="hint">You'll use your name + PIN to log in on other devices. Don't forget it.</p>}
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? '…' : mode === 'join' ? 'Join the group' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
