# CourtCast — Spec

A private NBA prediction game for a small group of friends (<15). Yearly seasons, live leaderboards, and an end-of-season "Wrapped".

## Stack

- **Frontend:** React (Vite), hosted on GitHub Pages (static).
- **Backend:** Supabase (Postgres + Auth), free tier. All access rules enforced with Row-Level Security (RLS), never in the browser.
- **Jobs:** GitHub Actions on a schedule:
  - Daily: fetch standings + scores from ESPN → write snapshots to Supabase (also keeps the free-tier project from pausing).
  - Weekly: `pg_dump` backup to a **private** location (not this repo if it's public).
- **NBA data:** ESPN's unofficial API, wrapped in one swappable module. The browser only reads our DB, never ESPN.
  - Standings: `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings` (request regular season explicitly)
  - Scores/schedule: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=YYYYMMDD&seasontype=2` (3 = playoffs)
  - Rejected: cdn.nba.com (403), stats.nba.com (blocks cloud IPs). Backup option: balldontlie.io.
  - Awards (MVP etc.): no API — admin enters results.

## Access

- One **group passcode** (stored hashed in DB). Joining: passcode → pick display name + 6-digit PIN.
- Under the hood: every browser gets an **anonymous Supabase session**. `join_group` (passcode) and `login` (name + PIN) map that session to a player via `player_sessions`. No emails anywhere. (Synthetic emails were rejected: Supabase validates email domains.)
- PINs are bcrypt-hashed in `players`. Rate limits: 10 failed joins/hour per session; 5 wrong PINs per name per 15 min; 20 failed logins/hour per session.
- The first player to join becomes admin.
- RLS: only players can read anything; all writes go through security-definer functions (no table write grants).
- Known tradeoff: anyone who knows a name + PIN can act as that person. Acceptable for this group.
- One admin (owner) with an in-app **admin page**: reset PINs, override results, change lock times, enter award winners, open new seasons.

## Game modes

### 1. Preseason picks (lock at first regular-season tipoff)
2026–27 lock: **Tue Oct 20, 2026, 19:00 UTC** (BOS @ DET per ESPN — re-verify before launch).

- **Seeding:** rank all 15 teams in each conference.
- **Bonus picks:** #1 seed in each conference, each conference champion, NBA champion.
- **Awards:** MVP, ROY, DPOY, 6MOY, MIP, COY. Names must come from a fixed list (players / rookies / coaches from ESPN rosters), enforced in the app and DB (`award_options`).
- Picks are **hidden from others until lock**, then revealed.
- Partial picks count as-is; missing picks score 0.
- The lock can't be moved once it has passed (DB-enforced) — that would reopen revealed picks.
- Late joiners (after lock) can join and play daily picks + bracket; preseason = 0.

### 2. Playoff bracket (opens after play-in, locks before first Round 1 game)
- Winners only, full bracket filled up front. ~36h window with a countdown + reminder banner on every page.

### 3. Daily game picks (post-launch)
- Pick winners of any/all games each day, locked at each game's tipoff.
- One **featured game** per day worth double: auto-chosen (best combined win %, national TV breaks ties), admin can override.
- Others' picks for a game are hidden until that game tips off.
- Postponed/cancelled games are void (no points, excluded from stats).
- Separate leaderboard from the main season game.

### Future (not planned yet)
- **Multiple leagues** (separate friend groups, each with its own passcode and admin). v1 is single-group; adding leagues later means moving existing players and picks into a default league.
- **"Start new season" admin button.** Until then, insert a new `seasons` row and switch `is_current` in the SQL Editor.
- **NBA expansion:** seeding assumes 15 teams per conference (UI + `save_seed_picks` + `seed` check).
- **Teams per season:** `teams` is shared across seasons, so a rename or relocation shows the new name on past seasons.

### Dropped for now
- Hot takes / friend props (revisit later; if added: flat points).
- Group chat bot (group uses iMessage/WhatsApp — no easy bot).

## Scoring

**Season leaderboard** = seeding + bonus picks + awards + bracket.

All values live in `src/lib/scoring.ts`.

- **Seeding (per team):** exact seed = 5, judged on **final regular-season standings** (no partial credit).
- **Playoff call (per team):** +2 if you correctly called whether it makes the playoffs. Your top 8 per conference = your playoff teams; "made it" is decided after the play-in. Max seeding total 210.
- **Bonus picks:** #1 seed = 10 each, conference champ = 15 each, NBA champ = 25.
- **Awards:** 10 each (MVP not weighted extra).
- **Bracket:** correct winner per round: R1 = 2, R2 = 4, CF = 8, Finals = 16.
- **Live "if the season ended today"** scoring from the latest standings snapshot, with daily ↑/↓ movement.
- **Tiebreak:** most exact seeds.

**Daily picks leaderboard:** 1 pt per correct pick, featured game = 2. Running total (not accuracy %).

## Wrapped (end of season, after Finals)

_Design deferred to a separate grilling round in spring 2027._

- Story-style, tap-through mobile slides per player.
- Viewed in-app (passcode-gated); each slide exportable as PNG for sharing.
- Content ideas: final rank, best call, worst miss, score-over-season chart (from daily snapshots), daily-picks streaks, persona, year-over-year comparison.

## Data model (sketch)

- `seasons` — year, preseason lock time, playoff lock time
- `players` — display name, PIN hash, is_admin
- `player_sessions` — anonymous auth uid → player
- `seed_picks` — player, season, team, conference, predicted seed
- `bonus_picks` — player, season, category (one_seed_east, champ, mvp, …), pick
- `bracket_picks` — player, season, series slot, picked winner
- `standings_snapshots` — season, date, team, wins, losses, seed
- `games` — season, ESPN game id, date/tipoff, teams, result, is_featured
- `game_picks` — player, game, picked team
- `results` — season, category, actual value (awards, champs, series winners)

## Rollout

1. **By Oct 20 (opening night):** passcode join, preseason picks (seeding + bonus + awards), lock + reveal, admin basics.
2. **Early season:** daily standings job, live leaderboard with movement, daily game picks.
3. **By April:** playoff bracket.
4. **By June:** Wrapped.

## How It Works page

Reachable before login (from the Join screen) and as the **Rules** tab. Short on purpose: 5-step timeline, one points table, one example, fine print + FAQ collapsed. Numbers are read from `src/lib/scoring.ts`.
