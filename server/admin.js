import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from './database.js';
import { achievements, games } from './catalog.js';
import { DIFFICULTIES, generatePuzzle, levelInfo } from '../shared/game.js';
import { ACHIEVEMENT_METRICS, GAME_ENGINES } from '../shared/catalog.js';

export const admin = Router();
admin.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (req.user.role !== 'admin' || req.user.suspended)
    return res.status(403).json({ error: 'Administrator access is required.' });
  next();
});
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    fail(`${label} must have ${min}–${max} characters.`);
  return value.trim();
}
function atomic(req, action, target, detail, mutation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = mutation();
    db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(
      randomUUID(),
      req.user.id,
      action,
      target,
      detail,
      new Date().toISOString(),
    );
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
function futurePuzzle(body) {
  const { date, difficulty } = body;
  const today = new Date().toISOString().slice(0, 10);
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail('Choose a valid UTC date.');
  if (date <= today) fail('Today’s and past puzzles are locked. Choose a future UTC date.', 409);
  if (Date.parse(date) > Date.now() + 366 * 86400000)
    fail('Schedule a puzzle within the next year.');
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) fail('Choose a valid difficulty.');
  const seed = body.seed ? text(body.seed, 'Puzzle seed', 1, 80) : date;
  return { date, difficulty, seed, ...generatePuzzle(difficulty, seed) };
}
admin.get('/overview', (req, res) => {
  const users = db
    .prepare(
      'SELECT COUNT(*) total,SUM(CASE WHEN suspended=0 THEN 1 ELSE 0 END) active,SUM(CASE WHEN suspended=1 THEN 1 ELSE 0 END) suspended FROM users',
    )
    .get();
  const stats = db
    .prepare(
      'SELECT COUNT(*) completions,COALESCE(SUM(score),0) points,COALESCE(SUM(seconds),0) seconds,COALESCE(ROUND(AVG(moves),1),0) averageMoves,COUNT(DISTINCT user_id) players FROM results',
    )
    .get();
  const difficulty = db
    .prepare(
      'SELECT difficulty,COUNT(*) completions,ROUND(AVG(seconds)) seconds,ROUND(AVG(moves),1) moves FROM results GROUP BY difficulty',
    )
    .all();
  const leaders = db
    .prepare(
      'SELECT u.id,u.username,u.avatar,COALESCE(SUM(r.score),0) score,COALESCE(SUM(r.xp),0) xp FROM users u JOIN results r ON r.user_id=u.id WHERE u.suspended=0 GROUP BY u.id ORDER BY score DESC,u.created_at ASC LIMIT 10',
    )
    .all()
    .map((row, index) => ({ ...row, rank: index + 1, level: levelInfo(row.xp).level }));
  const activity = db
    .prepare(
      'SELECT a.*,u.username FROM admin_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.date DESC LIMIT 30',
    )
    .all();
  res.json({
    users,
    stats,
    difficulty,
    leaders,
    activity,
    openReports: db.prepare("SELECT COUNT(*) total FROM reports WHERE status='open'").get().total,
    scheduled: db
      .prepare('SELECT COUNT(*) total FROM daily_challenges WHERE date>?')
      .get(new Date().toISOString().slice(0, 10)).total,
  });
});
admin.get('/users', (req, res) => {
  const query = String(req.query.q || '')
    .toLowerCase()
    .slice(0, 100);
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  const count = db
    .prepare(
      'SELECT COUNT(*) total FROM users WHERE instr(lower(username),?)>0 OR instr(lower(email),?)>0',
    )
    .get(query, query).total;
  const rows = db
    .prepare(
      'SELECT u.id,u.username,u.email,u.avatar,u.role,u.suspended,u.suspension_reason,u.created_at,COUNT(r.id) solved,COALESCE(SUM(r.score),0) score,COALESCE(SUM(r.xp),0) xp FROM users u LEFT JOIN results r ON r.user_id=u.id WHERE instr(lower(u.username),?)>0 OR instr(lower(u.email),?)>0 GROUP BY u.id ORDER BY u.created_at DESC LIMIT 20 OFFSET ?',
    )
    .all(query, query, (page - 1) * 20)
    .map((row) => ({ ...row, level: levelInfo(row.xp).level }));
  res.json({ rows, total: count, page, pages: Math.max(1, Math.ceil(count / 20)) });
});
admin.patch('/users/:id', (req, res) => {
  const user = db.prepare('SELECT id,username,role FROM users WHERE id=?').get(req.params.id);
  if (!user) fail('Player not found.', 404);
  if (user.role === 'admin')
    fail('Administrator accounts cannot be suspended from the dashboard.', 403);
  if (typeof req.body.suspended !== 'boolean') fail('Choose an account status.');
  const reason = req.body.suspended ? text(req.body.reason, 'Suspension reason', 5, 300) : '';
  atomic(
    req,
    req.body.suspended ? 'player.suspend' : 'player.restore',
    user.id,
    `${user.username}${reason ? `: ${reason}` : ''}`,
    () => {
      db.prepare('UPDATE users SET suspended=?,suspension_reason=? WHERE id=?').run(
        Number(req.body.suspended),
        reason,
        user.id,
      );
      if (req.body.suspended) db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(user.id);
    },
  );
  res.json({ ok: true });
});
admin.get('/daily', (req, res) => {
  const rows = db
    .prepare(
      'SELECT d.*,COUNT(r.id) completions FROM daily_challenges d LEFT JOIN results r ON r.daily=d.date GROUP BY d.date ORDER BY d.date DESC LIMIT 400',
    )
    .all();
  const today = new Date().toISOString().slice(0, 10);
  res.json(
    rows.map((row) => {
      const data = JSON.parse(row.puzzle_data);
      return {
        date: row.date,
        difficulty: row.difficulty,
        board: Array.isArray(data) ? data : data.board,
        seed: data.seed || row.date,
        completions: row.completions,
        locked: row.date <= today,
      };
    }),
  );
});
admin.post('/daily/preview', (req, res) => res.json(futurePuzzle(req.body)));
admin.put('/daily', (req, res) => {
  const puzzle = futurePuzzle(req.body);
  atomic(req, 'daily.schedule', puzzle.date, `${puzzle.difficulty} · seed: ${puzzle.seed}`, () =>
    db
      .prepare(
        'INSERT INTO daily_challenges VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET difficulty=excluded.difficulty,puzzle_data=excluded.puzzle_data',
      )
      .run(
        puzzle.date,
        puzzle.difficulty,
        JSON.stringify({ board: puzzle.board, solution: puzzle.solution, seed: puzzle.seed }),
      ),
  );
  res.json(puzzle);
});
admin.delete('/daily/:date', (req, res) => {
  const row = db
    .prepare('SELECT difficulty FROM daily_challenges WHERE date=?')
    .get(req.params.date);
  if (!row) fail('Scheduled puzzle not found.', 404);
  futurePuzzle({ date: req.params.date, difficulty: row.difficulty });
  atomic(req, 'daily.unschedule', req.params.date, 'Return to the automatic daily puzzle.', () =>
    db.prepare('DELETE FROM daily_challenges WHERE date=?').run(req.params.date),
  );
  res.json({ ok: true });
});
admin.get('/achievements', (req, res) =>
  res.json(
    achievements().map((a) => ({
      ...a,
      unlocked: db
        .prepare('SELECT COUNT(*) total FROM user_achievements WHERE achievement_id=?')
        .get(a.id).total,
    })),
  ),
);
admin.post('/achievements', (req, res) => {
  const name = text(req.body.name, 'Badge name', 3, 36),
    description = text(req.body.description, 'Description', 5, 160);
  const { metric, icon, goal } = req.body;
  if (
    !ACHIEVEMENT_METRICS.some((m) => m.id === metric) ||
    !['footprints', 'zap', 'target', 'flame', 'brain', 'calendar', 'trophy', 'crown'].includes(
      icon,
    ) ||
    !Number.isInteger(goal) ||
    goal < 1 ||
    goal > 10000
  )
    fail('Choose a valid requirement, badge icon, and target from 1–10,000.');
  if (db.prepare('SELECT id FROM achievements WHERE lower(name)=lower(?)').get(name))
    fail('An achievement with that name already exists.', 409);
  const id = randomUUID();
  atomic(req, 'achievement.create', id, name, () =>
    db
      .prepare(
        'INSERT INTO achievements(id,name,description,icon,requirement_value,requirement_type) VALUES(?,?,?,?,?,?)',
      )
      .run(id, name, description, icon, goal, metric),
  );
  res.status(201).json({ id, name, description, icon, goal, metric });
});
admin.get('/games', (req, res) => res.json(games()));
function gameInput(body) {
  const id = text(body.id, 'Game slug', 2, 40),
    name = text(body.name, 'Game name', 3, 36),
    description = text(body.description, 'Description', 5, 100),
    tag = text(body.tag, 'Category', 2, 14).toUpperCase();
  if (
    !/^[a-z][a-z0-9-]+$/.test(id) ||
    !['green', 'purple', 'orange', 'blue', 'pink', 'teal'].includes(body.color) ||
    typeof body.available !== 'boolean'
  )
    fail('Choose a valid slug, card color, and availability.');
  if (body.available && !GAME_ENGINES.includes(id))
    fail('This game has no playable engine yet. Keep its status as Coming Soon.');
  if (id === 'sliding' && !body.available)
    fail('Sliding Puzzle must remain available for daily challenges.');
  return { id, name, description, tag, color: body.color, available: body.available };
}
admin.post('/games', (req, res) => {
  const g = gameInput(req.body);
  if (db.prepare('SELECT slug FROM games WHERE slug=?').get(g.id))
    fail('That game slug is already in use.', 409);
  atomic(req, 'game.create', g.id, g.name, () =>
    db
      .prepare('INSERT INTO games(slug,name,description,status,category,color) VALUES(?,?,?,?,?,?)')
      .run(g.id, g.name, g.description, g.available ? 'available' : 'coming-soon', g.tag, g.color),
  );
  res.status(201).json(g);
});
admin.put('/games/:id', (req, res) => {
  const g = gameInput({ ...req.body, id: req.params.id });
  if (!db.prepare('SELECT slug FROM games WHERE slug=?').get(g.id)) fail('Game not found.', 404);
  atomic(req, 'game.update', g.id, g.name, () =>
    db
      .prepare('UPDATE games SET name=?,description=?,status=?,category=?,color=? WHERE slug=?')
      .run(g.name, g.description, g.available ? 'available' : 'coming-soon', g.tag, g.color, g.id),
  );
  res.json(g);
});
admin.get('/reports', (req, res) => {
  const status = req.query.status === 'resolved' ? 'resolved' : 'open';
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const total = db.prepare('SELECT COUNT(*) total FROM reports WHERE status=?').get(status).total;
  res.json({
    rows: db
      .prepare(
        'SELECT r.*,u.username FROM reports r LEFT JOIN users u ON u.id=r.user_id WHERE r.status=? ORDER BY r.created_at DESC LIMIT 20 OFFSET ?',
      )
      .all(status, (page - 1) * 20),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / 20)),
  });
});
admin.patch('/reports/:id', (req, res) => {
  if (!['open', 'resolved'].includes(req.body.status)) fail('Choose Open or Resolved.');
  const response = text(req.body.response, 'Response', 0, 1000);
  if (!db.prepare('SELECT id FROM reports WHERE id=?').get(req.params.id))
    fail('Report not found.', 404);
  atomic(req, 'report.update', req.params.id, req.body.status, () =>
    db
      .prepare('UPDATE reports SET status=?,response=?,updated_at=? WHERE id=?')
      .run(req.body.status, response, new Date().toISOString(), req.params.id),
  );
  res.json({ ok: true });
});
admin.get('/announcements', (req, res) =>
  res.json(db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()),
);
function announcementInput(body) {
  if (typeof body.published !== 'boolean') fail('Choose Draft or Published.');
  return {
    title: text(body.title, 'Title', 3, 80),
    body: text(body.body, 'Announcement', 5, 1000),
    published: Number(body.published),
  };
}
admin.post('/announcements', (req, res) => {
  const a = announcementInput(req.body),
    id = randomUUID(),
    now = new Date().toISOString();
  atomic(req, 'announcement.create', id, a.title, () =>
    db
      .prepare('INSERT INTO announcements VALUES(?,?,?,?,?,?)')
      .run(id, a.title, a.body, a.published, now, now),
  );
  res.status(201).json({ id, ...a });
});
admin.put('/announcements/:id', (req, res) => {
  const a = announcementInput(req.body);
  if (!db.prepare('SELECT id FROM announcements WHERE id=?').get(req.params.id))
    fail('Announcement not found.', 404);
  atomic(req, 'announcement.update', req.params.id, a.title, () =>
    db
      .prepare('UPDATE announcements SET title=?,body=?,published=?,updated_at=? WHERE id=?')
      .run(a.title, a.body, a.published, new Date().toISOString(), req.params.id),
  );
  res.json({ id: req.params.id, ...a });
});
admin.delete('/announcements/:id', (req, res) => {
  const a = db.prepare('SELECT title FROM announcements WHERE id=?').get(req.params.id);
  if (!a) fail('Announcement not found.', 404);
  atomic(req, 'announcement.delete', req.params.id, a.title, () =>
    db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id),
  );
  res.json({ ok: true });
});

export function registerCommunityRoutes(app, requireUser) {
  app.get('/api/announcements', (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT id,title,body,updated_at FROM announcements WHERE published=1 ORDER BY updated_at DESC LIMIT 10',
        )
        .all(),
    ),
  );
  app.get('/api/reports', requireUser, (req, res) =>
    res.json(
      db
        .prepare(
          'SELECT id,category,subject,body,status,response,created_at,updated_at FROM reports WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
        )
        .all(req.user.id),
    ),
  );
  app.post('/api/reports', requireUser, (req, res) => {
    const subject = text(req.body.subject, 'Subject', 3, 100),
      body = text(req.body.body, 'Report', 10, 2000),
      category = req.body.category;
    if (!['bug', 'feedback', 'player'].includes(category)) fail('Choose a report category.');
    if (
      db
        .prepare('SELECT COUNT(*) total FROM reports WHERE user_id=? AND created_at>?')
        .get(req.user.id, new Date(Date.now() - 3600000).toISOString()).total >= 5
    )
      fail('You can send up to five reports per hour. Please try again later.', 429);
    const id = randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      'INSERT INTO reports(id,user_id,category,subject,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    ).run(id, req.user.id, category, subject, body, now, now);
    res.status(201).json({
      id,
      subject,
      body,
      category,
      status: 'open',
      response: '',
      created_at: now,
      updated_at: now,
    });
  });
}
