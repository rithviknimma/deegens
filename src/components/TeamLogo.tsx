import { TEAM_BY_ID } from '../lib/nba';

export function TeamLogo({ teamId, size = 28 }: { teamId: string; size?: number }) {
  const team = TEAM_BY_ID[teamId];
  if (!team?.logo) return <span className="team-logo" style={{ width: size, height: size }} />;
  return <img className="team-logo" src={team.logo} alt="" width={size} height={size} loading="lazy" />;
}
