// Single source of truth for points. The How It Works page and hints read from here,
// and the scoring code (coming with the live leaderboard) must too.
export const POINTS = {
  exactSeed: 5, // team finishes at exactly your predicted seed (final regular-season standings)
  playoffCall: 2, // per team: you correctly called whether it makes the playoffs (after the play-in)
  oneSeed: 10, // per conference: your #1 seed finishes #1
  confChamp: 15, // per conference
  champion: 25,
  award: 10, // per award
  bracket: { r1: 2, r2: 4, cf: 8, finals: 16 }, // per correct series winner
  dailyPick: 1, // separate daily leaderboard
  dailyFeatured: 2,
};

// Your top 8 in each conference are your predicted playoff teams (7-8 via the play-in).
export const PLAYOFF_LINE = 8;
