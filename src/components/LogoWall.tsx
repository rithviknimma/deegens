import { TEAMS } from '../lib/nba';
import { TeamLogo } from './TeamLogo';

// Two rows of team logos drifting in opposite directions. Each row renders its logos twice
// so the CSS animation (translateX -50%) loops seamlessly.
const ROWS = [TEAMS.filter((_, i) => i % 2 === 0), TEAMS.filter((_, i) => i % 2 === 1)];

export function LogoWall() {
  return (
    <div className="logo-wall" aria-hidden="true">
      {ROWS.map((teams, r) => (
        <div key={r} className={`logo-row ${r === 1 ? 'reverse' : ''}`}>
          {[...teams, ...teams].map((t, i) => (
            <TeamLogo key={`${t.id}-${i}`} teamId={t.id} size={40} />
          ))}
        </div>
      ))}
    </div>
  );
}
