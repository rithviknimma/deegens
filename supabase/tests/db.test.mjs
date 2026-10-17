import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';

const db = new PGlite({ extensions: { pgcrypto } });
// Runs the migrations against PGlite (Postgres in WASM) with a stub of Supabase's auth schema.
// Usage: npm run test:db
const root = new URL('../', import.meta.url);
const files = ['migrations/0001_init.sql', 'migrations/0002_award_list_and_lock_guard.sql', 'award_options.sql'];
const migrations = await Promise.all(files.map((f) => readFile(new URL(f, root), 'utf8')));

// Minimal stand-in for Supabase's roles and auth schema.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema extensions; create schema auth;
  grant usage on schema public, auth, extensions to anon, authenticated;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
`);
for (const m of migrations) await db.exec(m);

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const U3 = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users values ('${U1}'), ('${U2}'), ('${U3}')`);

let failures = 0;
async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
}
async function expectOk(label, fn, check = () => true) {
  try {
    const r = await fn();
    if (!check(r)) { failures++; console.log('FAIL', label, JSON.stringify(r)); }
    else console.log('ok  ', label);
    return r;
  } catch (e) { failures++; console.log('FAIL', label, 'threw:', e.message); }
}
async function expectErr(label, fn, match) {
  try { const r = await fn(); failures++; console.log('FAIL', label, 'no error, got', JSON.stringify(r)); }
  catch (e) {
    if (match && !e.message.includes(match)) { failures++; console.log('FAIL', label, 'wrong error:', e.message); }
    else console.log('ok  ', label, '->', e.message);
  }
}

const east = (await db.query(`select id from teams where conference='East' order by id`)).rows.map((r) => r.id);
const west = (await db.query(`select id from teams where conference='West' order by id`)).rows.map((r) => r.id);

await expectErr('join before passcode set', () => as(U1, `select join_group('hunter22', 'Rithvik', '123456')`), 'not been set up');
await db.exec(`update app_config set passcode_hash = extensions.crypt('hunter22', extensions.gen_salt('bf'))`);

await expectOk('wrong passcode returns null', () => as(U1, `select join_group('nope', 'Rithvik', '123456') as id`), (r) => r[0].id === null);
const p1 = (await expectOk('join ok', () => as(U1, `select join_group('hunter22', 'Rithvik', '123456') as id`), (r) => r[0].id))[0].id;
await expectOk('first joiner is admin', () => as(U1, `select * from me()`), (r) => r[0].is_admin === true);
await expectErr('duplicate name (case-insensitive)', () => as(U2, `select join_group('hunter22', 'rithvik', '111111')`), 'taken');
await expectErr('bad PIN format', () => as(U2, `select join_group('hunter22', 'Raj', '12ab')`), 'PIN');
await expectErr('bad name format', () => as(U2, `select join_group('hunter22', '<script>', '111111')`), 'Name');
const p2 = (await expectOk('second join', () => as(U2, `select join_group('hunter22', 'Raj', '111111') as id`), (r) => r[0].id))[0].id;
await expectOk('second joiner not admin', () => as(U2, `select * from me()`), (r) => r[0].is_admin === false);

await expectOk('non-member sees no teams', () => as(U3, `select * from teams`), (r) => r.length === 0);
await expectOk('non-member me() empty', () => as(U3, `select * from me()`), (r) => r.length === 0);
await expectErr('non-member cannot save', () => as(U3, `select save_seed_picks('2026-27', 'East', $1)`, [east]), 'Not a member');
await expectErr('anon cannot call functions', () => as(null, `select join_group('hunter22', 'Anon', '111111')`), 'permission denied');
await expectOk('member sees teams', () => as(U1, `select * from teams`), (r) => r.length === 30);
await expectErr('pin_hash hidden', () => as(U2, `select pin_hash from players`), 'permission denied');
await expectOk('player names visible', () => as(U2, `select id, display_name from players`), (r) => r.length === 2);
await expectErr('direct insert blocked', () => as(U1, `insert into seed_picks values ('${p1}', '2026-27', 'BOS', 'East', 1)`), 'permission denied');
await expectErr('app_config unreadable', () => as(U1, `select * from app_config`), 'permission denied');

await expectOk('save East seeds', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [east]));
await expectOk('re-save reordered', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [[...east].reverse()]));
await expectOk('seed 1 is last alphabetically', () => as(U1, `select team_id from seed_picks where seed = 1 and conference = 'East'`), (r) => r.length === 1 && r[0].team_id === 'WSH');
await expectOk('save West seeds', () => as(U1, `select save_seed_picks('2026-27', 'West', $1)`, [west]));
await expectErr('14 teams rejected', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [east.slice(1)]), 'exactly once');
await expectErr('duplicate team rejected', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [[...east.slice(1), east[1]]]), 'exactly once');
await expectErr('West team in East rejected', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [[...east.slice(1), 'LAL']]), 'exactly once');

await expectOk('save bonus', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ east_champ: 'BOS', west_champ: 'OKC', champion: 'OKC', mvp: 'Shai Gilgeous-Alexander', roy: '' }]));
await expectOk('bonus rows', () => as(U1, `select category from bonus_picks order by category`), (r) => r.map((x) => x.category).join() === 'champion,east_champ,mvp,west_champ');
await expectErr('champion not a conf champ', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ east_champ: 'BOS', west_champ: 'OKC', champion: 'LAL' }]), 'Champion');
await expectErr('wrong-conference champ', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ east_champ: 'LAL' }]), 'East champion');
await expectErr('unknown category', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ worst_ref: 'Scott Foster' }]), 'Unknown');
await expectOk('clearing a pick deletes it', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ mvp: '' }]));
await expectOk('mvp removed', () => as(U1, `select * from bonus_picks where category = 'mvp'`), (r) => r.length === 0);

await expectOk('others hidden before lock', () => as(U2, `select * from seed_picks`), (r) => r.length === 0);
await expectOk('own picks visible', () => as(U1, `select * from seed_picks`), (r) => r.length === 30);
await expectOk('status shows counts, not picks', () => as(U2, `select * from submission_status('2026-27')`), (r) => r.find((x) => x.display_name === 'Rithvik').seed_count === 30);

await expectErr('award not on list', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ mvp: 'Shai' }]), 'list');
await expectErr('rookie list enforced for ROY', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ roy: 'Shai Gilgeous-Alexander' }]), 'ROY');
await expectErr('coach list enforced for COY', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ coy: 'Shai Gilgeous-Alexander' }]), 'COY');
await expectOk('valid award names save', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ mvp: 'Shai Gilgeous-Alexander', roy: 'Aday Mara', coy: 'Joe Mazzulla' }]));
await expectOk('valid awards stored', () => as(U1, `select pick from bonus_picks where category in ('mvp','roy','coy') order by category`), (r) => r.length === 3);
await expectOk('clear them again', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ mvp: '', roy: '', coy: '' }]));
await expectOk('admin can move lock later before it passes', () => as(U1, `select admin_set_lock('2026-27', now() + interval '2 days', null)`));
await expectErr('non-admin cannot move lock', () => as(U2, `select admin_set_lock('2026-27', now() - interval '1 minute', null)`), 'Admins only');
await expectOk('admin moves lock to past', () => as(U1, `select admin_set_lock('2026-27', now() - interval '1 minute', null)`));
await expectOk('others revealed after lock', () => as(U2, `select * from seed_picks`), (r) => r.length === 30);
await expectOk('bonus revealed after lock', () => as(U2, `select * from bonus_picks`), (r) => r.length === 3);
await expectErr('cannot move lock after it passed', () => as(U1, `select admin_set_lock('2026-27', now() + interval '3 days', null)`), "can't be moved");
await expectOk('setting playoff lock still allowed after preseason lock', () => as(U1, `select admin_set_lock('2026-27', (select lock_at from seasons), now() + interval '180 days')`));
await expectErr('save after lock blocked', () => as(U1, `select save_seed_picks('2026-27', 'East', $1)`, [east]), 'locked');
await expectErr('bonus after lock blocked', () => as(U1, `select save_bonus_picks('2026-27', $1)`, [{ mvp: 'X' }]), 'locked');
await expectOk('non-member still sees nothing after lock', () => as(U3, `select * from seed_picks`), (r) => r.length === 0);

// Login from a new device (U3 session) as Raj.
await expectOk('unknown name returns null', () => as(U3, `select login('Nobody', '111111') as id`), (r) => r[0].id === null);
for (let i = 0; i < 5; i++) await as(U3, `select login('Raj', '000000')`);
await expectErr('lockout after 5 bad PINs', () => as(U3, `select login('Raj', '111111')`), 'Wait 15 minutes');
await expectOk('admin resets PIN', () => as(U1, `select admin_reset_pin($1, '222222')`, [p2]));
await expectOk('old PIN fails', () => as(U3, `select login('Raj', '111111') as id`), (r) => r[0].id === null);
await expectOk('new PIN works (case-insensitive name)', () => as(U3, `select login(' raj ', '222222') as id`), (r) => r[0].id === p2);
await expectOk('new device is Raj', () => as(U3, `select * from me()`), (r) => r[0]?.display_name === 'Raj');
await expectOk('logout', () => as(U3, `select logout()`));
await expectOk('after logout not a member', () => as(U3, `select * from me()`), (r) => r.length === 0);

await expectErr('admin cannot remove self', () => as(U1, `select admin_remove_player($1)`, [p1]), 'yourself');
await expectOk('admin removes player', () => as(U1, `select admin_remove_player($1)`, [p2]));
await expectOk('removed player session gone', () => as(U2, `select * from me()`), (r) => r.length === 0);
await expectErr('short passcode rejected', () => as(U1, `select admin_set_passcode('short')`), '8 characters');
await expectOk('admin rotates passcode', () => as(U1, `select admin_set_passcode('newpasscode')`));
await expectOk('old passcode now fails', () => as(U2, `select join_group('hunter22', 'Raj2', '111111') as id`), (r) => r[0].id === null);

console.log(failures ? `\n${failures} FAILURES` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
