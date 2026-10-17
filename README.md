# CourtCast

Private NBA predictions for the group. See [docs/SPEC.md](docs/SPEC.md) for the full design.

React (Vite) on GitHub Pages · Supabase (Postgres + anonymous auth) · ESPN data.

## Develop

```sh
npm install
npm run dev
```

## One-time Supabase setup

1. **Authentication → Sign In / Providers:** enable **Allow anonymous sign-ins**.
2. **SQL Editor:** paste and run each file, in order (one at a time):
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_award_list_and_lock_guard.sql`
   3. `supabase/award_options.sql`
3. **SQL Editor:** set the group passcode (8+ characters):
   ```sql
   update app_config set passcode_hash = extensions.crypt('YOUR-PASSCODE', extensions.gen_salt('bf'));
   ```
   After that, the passcode can be changed from the in-app Admin page.
4. Join the app first: the first player to join becomes admin.

## Deploy

Pushing to `main` deploys via `.github/workflows/deploy.yml`. One-time: repo **Settings → Pages → Source: GitHub Actions**.

## Refresh NBA data

Team and player lists are generated from ESPN (it blocks browser requests):

```sh
npm run fetch-nba-data
```

This also regenerates `supabase/award_options.sql`. Re-run it in the Supabase SQL Editor afterwards.

## Test the database

```sh
npm run test:db
```
