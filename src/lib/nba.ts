import teamsJson from '../data/teams.json';
import playersJson from '../data/players.json';

export type Conference = 'East' | 'West';
export type Team = {
  id: string;
  name: string;
  shortName: string;
  conference: Conference;
  logo: string | null;
};

export const TEAMS = teamsJson as Team[];
export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<string, Team>;
export const teamsIn = (conf: Conference) => TEAMS.filter((t) => t.conference === conf);

export type OptionGroup = { label: string; names: string[] };

// Dropdown options grouped by team (sorted by team name), names sorted within each team.
function byTeam(people: { name: string; team: string }[]): OptionGroup[] {
  return TEAMS.map((t) => ({
    label: t.name,
    names: [...new Set(people.filter((p) => p.team === t.id).map((p) => p.name))].sort(),
  })).filter((g) => g.names.length > 0);
}

const PLAYER_GROUPS = byTeam(playersJson.players);
const ROOKIE_GROUPS = byTeam(playersJson.players.filter((p) => p.rookie));
const COACH_GROUPS = byTeam(playersJson.coaches);

// Award picks must come from these lists (the database checks too, via award_options).
export const AWARDS = [
  { key: 'mvp', label: 'MVP', groups: PLAYER_GROUPS },
  { key: 'roy', label: 'Rookie of the Year', groups: ROOKIE_GROUPS },
  { key: 'dpoy', label: 'Defensive Player', groups: PLAYER_GROUPS },
  { key: 'smoy', label: 'Sixth Man', groups: PLAYER_GROUPS },
  { key: 'mip', label: 'Most Improved', groups: PLAYER_GROUPS },
  { key: 'coy', label: 'Coach of the Year', groups: COACH_GROUPS },
] as const;

export const BONUS_LABELS: Record<string, string> = {
  east_champ: 'East champ',
  west_champ: 'West champ',
  champion: 'NBA champ',
  ...Object.fromEntries(AWARDS.map((a) => [a.key, a.label])),
};

// Seeds 1-6 make the playoffs, 7-10 the play-in, 11-15 the lottery.
export function tierOf(seed: number): 'playoff' | 'playin' | 'lottery' {
  return seed <= 6 ? 'playoff' : seed <= 10 ? 'playin' : 'lottery';
}
