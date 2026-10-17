import { Link } from 'react-router-dom';
import { POINTS, PLAYOFF_LINE } from '../lib/scoring';

// Kept deliberately short: people don't read. All numbers come from lib/scoring.ts.
export function HowItWorks({ showBack = false }: { showBack?: boolean }) {
  const { bracket } = POINTS;
  return (
    <div className="how">
      {showBack && <Link to="/" className="link">← Back</Link>}
      <h1>How it works</h1>

      <ol className="steps">
        <li><strong>Before opening tip:</strong> rank all 15 teams in each conference, and pick the champs and awards.</li>
        <li><strong>At opening tip:</strong> picks lock and everyone's picks are revealed.</li>
        <li><strong>During the season:</strong> watch the live leaderboard and make daily game picks.</li>
        <li><strong>April:</strong> fill out a playoff bracket.</li>
        <li><strong>June:</strong> everyone gets their Wrapped.</li>
      </ol>

      <h2>Points</h2>
      <table className="points">
        <tbody>
          <tr><td>Team finishes at exactly your seed</td><td>{POINTS.exactSeed}</td></tr>
          <tr><td>Correctly called whether a team makes the playoffs</td><td>{POINTS.playoffCall}</td></tr>
          <tr><td>Your #1 seed finishes #1 (per conference)</td><td>{POINTS.oneSeed}</td></tr>
          <tr><td>Conference champion (each)</td><td>{POINTS.confChamp}</td></tr>
          <tr><td>NBA champion</td><td>{POINTS.champion}</td></tr>
          <tr><td>Each award (MVP, ROY, DPOY, 6MOY, MIP, COY)</td><td>{POINTS.award}</td></tr>
          <tr><td>Bracket: each correct series winner</td><td>{bracket.r1} / {bracket.r2} / {bracket.cf} / {bracket.finals}</td></tr>
        </tbody>
      </table>

      <div className="card example">
        <strong>Example:</strong> you put the Heat 8th. They finish 9th, then win the play-in.
        <br />
        Not exact = 0, but you said they'd make the playoffs and they did = <strong>{POINTS.playoffCall} pts</strong>.
      </div>

      <details>
        <summary>The fine print</summary>
        <ul>
          <li>Seeds use the <strong>final regular-season standings</strong>.</li>
          <li>Your top {PLAYOFF_LINE} in each conference are your playoff teams. Whether a team made the playoffs is decided after the play-in.</li>
          <li>Bracket points go by round: first round, second round, conference finals, Finals.</li>
          <li>Ties are broken by the most exact seeds.</li>
          <li>Daily game picks have their own leaderboard: {POINTS.dailyPick} pt per correct pick, {POINTS.dailyFeatured} for the featured game.</li>
        </ul>
      </details>

      <details>
        <summary>FAQ</summary>
        <ul>
          <li><strong>Forgot your PIN?</strong> Ask the admin to reset it.</li>
          <li><strong>New phone or laptop?</strong> Log in with your name and PIN.</li>
          <li><strong>Joined after opening tip?</strong> You can still play daily picks and the bracket. Preseason picks are closed.</li>
          <li><strong>Can people see my picks?</strong> Not until the lock. Before then, they can only see whether you've submitted.</li>
          <li><strong>Postponed game?</strong> Picks on it don't count.</li>
        </ul>
      </details>
    </div>
  );
}
