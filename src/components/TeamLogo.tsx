import { TEAM_BY_ID, teamLogoUrl } from '../lib/nba';

export function TeamLogo({ teamId, size = 28 }: { teamId: string; size?: number }) {
  const team = TEAM_BY_ID[teamId];
  // 2x for sharp logos on high-density screens.
  const src = team ? teamLogoUrl(team, size * 2) : null;
  if (!src) return <span className="team-logo" style={{ width: size, height: size }} />;
  return <img className="team-logo" src={src} alt="" width={size} height={size} loading="lazy" />;
}
