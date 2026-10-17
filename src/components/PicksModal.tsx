import { useEffect, useState } from 'react';
import { errorMessage, supabase } from '../lib/supabase';
import { formatCountdown, useNow } from '../lib/useNow';
import { PlayerPicks } from './PlayerPicks';

type Props = {
  playerId: string;
  name: string;
  seasonId: string;
  lockAt: string;
  canView: boolean; // false = picks are still hidden for this viewer
  onClose: () => void;
};

type Picks = {
  seeds: { team_id: string; conference: string; seed: number }[];
  bonus: { category: string; pick: string }[];
};

// One friend's seeding and picks, or a "hidden until tipoff" note before the lock.
export function PicksModal({ playerId, name, seasonId, lockAt, canView, onClose }: Props) {
  const now = useNow();
  const [picks, setPicks] = useState<Picks | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canView) return;
    (async () => {
      const [s, b] = await Promise.all([
        supabase.from('seed_picks').select('team_id, conference, seed').eq('season_id', seasonId).eq('player_id', playerId),
        supabase.from('bonus_picks').select('category, pick').eq('season_id', seasonId).eq('player_id', playerId),
      ]);
      if (s.error || b.error) return setError(errorMessage(s.error ?? b.error));
      setPicks({ seeds: s.data, bonus: b.data });
    })();
  }, [canView, seasonId, playerId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal${canView ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s picks`}
        onClick={(e) => e.stopPropagation()}
      >
        {!canView ? (
          <>
            <button className="modal-close" aria-label="Close" onClick={onClose}>
              ✕
            </button>
            <div className="modal-ball">🤫</div>
            <h2>Hidden until opening night!</h2>
            <p className="muted">
              {name}'s picks unlock at tipoff, in <strong>{formatCountdown(new Date(lockAt).getTime() - now)}</strong>.
            </p>
            <button className="btn primary block" onClick={onClose} autoFocus>
              Can't wait
            </button>
          </>
        ) : (
          <>
            <header className="modal-header">
              <h2>{name}</h2>
              <button className="modal-close" aria-label="Close" onClick={onClose}>
                ✕
              </button>
            </header>
            <div className="modal-body">
              {error ? (
                <p className="error">{error}</p>
              ) : !picks ? (
                <p className="muted">Loading…</p>
              ) : (
                <PlayerPicks seeds={picks.seeds} bonus={picks.bonus} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
