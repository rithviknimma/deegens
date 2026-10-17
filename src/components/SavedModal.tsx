import { useEffect, useMemo } from 'react';
import { TEAM_BY_ID } from '../lib/nba';
import { TeamLogo } from './TeamLogo';

type Props = {
  oneSeeds: { East: string; West: string };
  bonus: Record<string, string>;
  missing: number;
  lockLabel: string;
  onClose: () => void;
};

const CONFETTI_COLORS = ['#ff7a1a', '#ffb36b', '#3ecf8e', '#eef0f4', '#ffc400'];

// Celebration shown after a successful save, with a quick summary of the headline picks.
export function SavedModal({ oneSeeds, bonus, missing, lockLabel, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  const champ = bonus.champion ? TEAM_BY_ID[bonus.champion] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <span
            key={i}
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="saved-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-ball">🏀</div>
        <h2 id="saved-title">Your picks are in!</h2>
        <p className="muted">You can change them anytime until the lock: {lockLabel}.</p>

        <ul className="modal-summary">
          <li>
            <span className="muted">#1 seeds</span>
            <span>
              <TeamLogo teamId={oneSeeds.East} size={22} /> <TeamLogo teamId={oneSeeds.West} size={22} />
            </span>
          </li>
          <li>
            <span className="muted">NBA champ</span>
            <span>{champ ? <><TeamLogo teamId={champ.id} size={22} /> {champ.shortName}</> : '–'}</span>
          </li>
          <li>
            <span className="muted">MVP</span>
            <span>{bonus.mvp || '–'}</span>
          </li>
        </ul>

        {missing > 0 && (
          <p className="hint">
            {missing} pick{missing > 1 ? 's are' : ' is'} still empty. Fill {missing > 1 ? 'them' : 'it'} in before the lock for more points.
          </p>
        )}
        <button className="btn primary block" onClick={onClose} autoFocus>
          Nice
        </button>
      </div>
    </div>
  );
}
