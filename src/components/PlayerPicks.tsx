import { BONUS_LABELS, PERSON_BY_NAME, TEAM_BY_ID, type Conference } from '../lib/nba';
import { Avatar } from './PersonCombobox';
import { SeedList } from './SeedList';
import { TeamLogo } from './TeamLogo';

type Props = {
  seeds: { team_id: string; conference: string; seed: number }[];
  bonus: { category: string; pick: string }[];
};

// One friend's full set of picks, read-only: both seeding lists plus playoff and award picks.
export function PlayerPicks({ seeds, bonus }: Props) {
  const orderOf = (conf: Conference) =>
    seeds
      .filter((s) => s.conference === conf)
      .sort((a, b) => a.seed - b.seed)
      .map((s) => s.team_id);
  const pickOf = (cat: string) => bonus.find((b) => b.category === cat)?.pick;

  return (
    <>
      <h3 className="section-title">Seeding</h3>
      {seeds.length === 0 ? (
        <p className="muted">No seeding saved.</p>
      ) : (
        <div className="conf-columns">
          {(['East', 'West'] as const).map((conf) => (
            <section key={conf}>
              <h4>{conf}</h4>
              <SeedList order={orderOf(conf)} />
            </section>
          ))}
        </div>
      )}

      <h3 className="section-title">Picks</h3>
      <ul className="card pick-list">
        {Object.keys(BONUS_LABELS).map((cat) => {
          const pick = pickOf(cat);
          const team = pick ? TEAM_BY_ID[pick] : undefined;
          const person = pick ? PERSON_BY_NAME[pick] : undefined;
          return (
            <li key={cat}>
              <span className="muted">{BONUS_LABELS[cat]}</span>
              <span className="pick-value">
                {team ? (
                  <>
                    <TeamLogo teamId={team.id} size={24} /> {team.shortName}
                  </>
                ) : pick ? (
                  <>
                    {person && <Avatar person={person} />} {pick}
                  </>
                ) : (
                  '–'
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
