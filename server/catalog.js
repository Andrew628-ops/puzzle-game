import { db } from './database.js';
import { generatePuzzle, achievementProgress } from '../shared/game.js';
import { GAME_ENGINES } from '../shared/catalog.js';
export const achievements = () =>
  db
    .prepare(
      'SELECT id,name,description,icon,requirement_value AS goal,requirement_type AS metric FROM achievements ORDER BY rowid',
    )
    .all();
export function games() {
  return db
    .prepare('SELECT * FROM games ORDER BY rowid')
    .all()
    .map((game) => ({
      id: game.slug,
      name: game.name,
      description: game.description,
      tag: game.category,
      color: game.color,
      available: game.status === 'available' && GAME_ENGINES.includes(game.slug),
    }));
}
export function dailyChallenge(date = new Date().toISOString().slice(0, 10)) {
  let stored = db.prepare('SELECT * FROM daily_challenges WHERE date=?').get(date);
  if (!stored) {
    const puzzle = generatePuzzle('medium', date);
    db.prepare('INSERT OR IGNORE INTO daily_challenges VALUES(?,?,?)').run(
      date,
      'medium',
      JSON.stringify(puzzle),
    );
    stored = db.prepare('SELECT * FROM daily_challenges WHERE date=?').get(date);
  }
  const data = JSON.parse(stored.puzzle_data);
  const puzzle = Array.isArray(data) ? generatePuzzle(stored.difficulty, date) : data;
  return { date, difficulty: stored.difficulty, ...puzzle };
}
export function unlockAchievements(userId, history) {
  const earned = new Set(
    db
      .prepare('SELECT achievement_id FROM user_achievements WHERE user_id=?')
      .all(userId)
      .map((row) => row.achievement_id),
  );
  let pending = achievements().filter((a) => !earned.has(a.id));
  if (!pending.length) return;
  const played = [];
  let xp = 0;
  for (const game of [...history].reverse()) {
    played.push(game);
    xp += game.xp;
    pending = pending.filter((a) => {
      if (achievementProgress(a.metric, played, xp) < a.goal) return true;
      db.prepare('INSERT OR IGNORE INTO user_achievements VALUES(?,?,?)').run(
        userId,
        a.id,
        game.date,
      );
      return false;
    });
    if (!pending.length) break;
  }
}
