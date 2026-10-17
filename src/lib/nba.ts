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

export type Person = { name: string; team: string; headshotId?: string | null };

// One entry per name, sorted by name.
function people(list: Person[]): Person[] {
  const seen = new Set<string>();
  return list
    .filter((p) => !seen.has(p.name) && seen.add(p.name))
    .map((p) => ({ name: p.name, team: p.team, headshotId: p.headshotId ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ESPN's image resizer (combiner) serves small thumbnails instead of the full 500px PNGs.
export function teamLogoUrl(team: Team, px: number) {
  if (!team.logo) return null;
  return `https://a.espncdn.com/combiner/i?img=${new URL(team.logo).pathname}&w=${px}&h=${px}`;
}

// ~8 KB thumbnails instead of ~200 KB full PNGs.
export function headshotUrl(espnId: string) {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=96&h=70&scale=crop&cquality=60`;
}

const PLAYERS = people(playersJson.players);
const ROOKIES = people(playersJson.players.filter((p) => p.rookie));
const COACHES = people(playersJson.coaches);

// Award picks must come from these lists (the database checks too, via award_options).
export const AWARDS = [
  { key: 'mvp', label: 'MVP', options: PLAYERS },
  { key: 'roy', label: 'Rookie of the Year', options: ROOKIES },
  { key: 'dpoy', label: 'Defensive Player', options: PLAYERS },
  { key: 'smoy', label: 'Sixth Man', options: PLAYERS },
  { key: 'mip', label: 'Most Improved', options: PLAYERS },
  { key: 'coy', label: 'Coach of the Year', options: COACHES },
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
