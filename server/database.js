import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACHIEVEMENTS } from '../shared/game.js';
import { GAME_CATALOG } from '../shared/catalog.js';
const dataDir = process.env.DATA_DIR || './data';
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'puzzlemind.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, avatar TEXT DEFAULT '🌱', bio TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS game_sessions (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, difficulty TEXT NOT NULL, board TEXT NOT NULL, daily TEXT, created INTEGER NOT NULL, completed INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS results (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, difficulty TEXT NOT NULL, seconds INTEGER NOT NULL, moves INTEGER NOT NULL, hints INTEGER NOT NULL, score INTEGER NOT NULL, xp INTEGER NOT NULL, daily TEXT, date TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS daily_once ON results(user_id, daily) WHERE daily IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_achievements (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, achievement_id TEXT NOT NULL, unlocked_at TEXT NOT NULL, PRIMARY KEY(user_id, achievement_id));
CREATE TABLE IF NOT EXISTS games (slug TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_challenges (date TEXT PRIMARY KEY, difficulty TEXT NOT NULL, puzzle_data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, requirement_value INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, category TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', response TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_audit (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, target TEXT NOT NULL, detail TEXT NOT NULL, date TEXT NOT NULL);
`);
// Additive migrations preserve existing accounts and completed games.
function addColumn(table, name, definition) {
  if (
    !db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((column) => column.name === name)
  )
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
addColumn('users', 'role', "TEXT NOT NULL DEFAULT 'player'");
addColumn('users', 'suspended', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'suspension_reason', "TEXT NOT NULL DEFAULT ''");
addColumn('achievements', 'requirement_type', 'TEXT');
addColumn('games', 'category', "TEXT NOT NULL DEFAULT 'LOGIC'");
addColumn('games', 'color', "TEXT NOT NULL DEFAULT 'green'");
for (const a of ACHIEVEMENTS)
  db.prepare(
    'INSERT OR IGNORE INTO achievements(id,name,description,icon,requirement_value) VALUES(?,?,?,?,?)',
  ).run(a.id, a.name, a.description, a.icon, a.goal);
db.exec('UPDATE achievements SET requirement_type=id WHERE requirement_type IS NULL');
for (const game of GAME_CATALOG)
  db.prepare(
    'INSERT OR IGNORE INTO games(slug,name,description,status,category,color) VALUES(?,?,?,?,?,?)',
  ).run(
    game.id,
    game.name,
    game.description,
    game.available ? 'available' : 'coming-soon',
    game.tag,
    game.color,
  );
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)');
if (!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get('catalog-colors')) {
  for (const game of GAME_CATALOG)
    db.prepare('UPDATE games SET category=?,color=? WHERE slug=?').run(
      game.tag,
      game.color,
      game.id,
    );
  db.prepare('INSERT INTO schema_migrations VALUES(?)').run('catalog-colors');
}
db.exec(
  'CREATE INDEX IF NOT EXISTS results_user_date ON results(user_id,date); CREATE INDEX IF NOT EXISTS reports_user_date ON reports(user_id,created_at);',
);

export { db };
