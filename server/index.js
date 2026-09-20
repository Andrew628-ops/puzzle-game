import { db } from './database.js';
import { achievements, games, dailyChallenge, unlockAchievements } from './catalog.js';
import { admin, registerCommunityRoutes } from './admin.js';
import express from 'express';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { ARCADE_GAMES, generateArcade, replayArcade, arcadeScore } from '../shared/arcade.js';
import {
  DIFFICULTIES,
  generatePuzzle,
  moveTile,
  isSolved,
  calculateScore,
  levelInfo,
  getStreak,
} from '../shared/game.js';

const app = express(),
  production = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
// Set only for a known reverse-proxy topology; leave unset for direct access.
if (process.env.TRUST_PROXY_HOPS) {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  if (!Number.isInteger(hops) || hops < 0 || hops > 10)
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
  app.set('trust proxy', hops);
}
app.get('/api/health', (req, res, next) => {
  try {
    db.prepare('SELECT 1').get();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    const trustedOrigins = [
      process.env.APP_URL,
      ...(!production ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ].filter(Boolean);
    let sameHost = false;
    try {
      sameHost = new URL(req.headers.origin).host === req.headers.host;
    } catch {
      /* Reject malformed origins. */
    }
    if (!sameHost && !trustedOrigins.includes(req.headers.origin))
      return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  const token = (req.headers.cookie || '')
    .split('; ')
    .find((c) => c.startsWith('pm_session='))
    ?.split('=')[1];
  req.user = token
    ? db
        .prepare(
          'SELECT users.* FROM users JOIN auth_sessions ON users.id=auth_sessions.user_id WHERE token=? AND expires>?',
        )
        .get(hash(token), Date.now())
    : null;
  if (req.user?.suspended) {
    res.clearCookie('pm_session', { path: '/' });
    return res
      .status(403)
      .json({ error: 'This account is suspended. Contact the site administrator.' });
  }
  next();
});
const hash = (value) => createHash('sha256').update(value).digest('hex');
function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
}
function session(res, user) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(
    hash(token),
    user.id,
    Date.now() + 30 * 86400000,
  );
  res.cookie('pm_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: production,
    maxAge: 30 * 86400000,
    path: '/',
  });
}
const requireUser = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Please sign in to continue.' });
const historyFor = (id) =>
  db.prepare('SELECT * FROM results WHERE user_id=? ORDER BY date DESC').all(id);
function player(user) {
  const history = historyFor(user.id),
    xp = history.reduce((sum, g) => sum + g.xp, 0);
  unlockAchievements(user.id, history);
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    created_at: user.created_at,
    xp,
    ...levelInfo(xp),
    ...getStreak(history),
    history,
    achievements: db
      .prepare(
        'SELECT achievement_id AS id, unlocked_at AS date FROM user_achievements WHERE user_id=?',
      )
      .all(user.id),
  };
}
const limits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip,
    now = Date.now(),
    entry = limits.get(key);
  if (!entry || now - entry.start > 600000) {
    limits.set(key, { start: now, count: 1 });
    return next();
  }
  if (++entry.count > 40)
    return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
  next();
}
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;
app.post('/api/auth/register', rateLimit, (req, res) => {
  const { username, email, password } = req.body;
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9_ -]{2,24}$/.test(username.trim()) ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !validPassword(password)
  )
    return res.status(400).json({
      error: 'Use a 2–24 character username, a valid email, and a password of 8–128 characters.',
    });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim()))
    return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = {
    id: randomUUID(),
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password_hash: passwordHash(password),
    created_at: new Date().toISOString(),
  };
  db.prepare('INSERT INTO users(id,username,email,password_hash,created_at) VALUES(?,?,?,?,?)').run(
    user.id,
    user.username,
    user.email,
    user.password_hash,
    user.created_at,
  );
  session(res, user);
  res.status(201).json(player(db.prepare('SELECT * FROM users WHERE id=?').get(user.id)));
});
app.post('/api/auth/login', rateLimit, (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || !validPassword(password))
    return res.status(400).json({ error: 'Enter your email and password.' });
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  if (user.suspended)
    return res
      .status(403)
      .json({ error: 'This account is suspended. Contact the site administrator.' });
  session(res, user);
  res.json(player(user));
});
app.get('/api/auth/me', (req, res) => res.json(req.user ? player(req.user) : null));
app.post('/api/auth/logout', (req, res) => {
  const token = (req.headers.cookie || '')
    .split('; ')
    .find((c) => c.startsWith('pm_session='))
    ?.split('=')[1];
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token=?').run(hash(token));
  res.clearCookie('pm_session', { path: '/' }).json({ ok: true });
});
app.post('/api/auth/forgot-password', rateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (production && !process.env.SMTP_URL)
      return res
        .status(503)
        .json({ error: 'Password reset email is not configured. Contact the site administrator.' });
    if (user) {
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);
      db.prepare('INSERT INTO password_resets VALUES(?,?,?)').run(
        hash(token),
        user.id,
        Date.now() + 3600000,
      );
      const url = `${process.env.APP_URL || 'http://localhost:5173'}/#reset-password?token=${token}`;
      if (process.env.SMTP_URL)
        await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
          from: process.env.MAIL_FROM || 'PuzzleMind <hello@puzzlemind.app>',
          to: user.email,
          subject: 'Reset your PuzzleMind password',
          text: `Reset your password within one hour: ${url}`,
        });
      else console.info('[Local development password reset]', url);
    }
    res.json({
      message:
        'If an account exists, a reset link has been sent. In local development, the link appears in the server console.',
    });
  } catch (error) {
    next(error);
  }
});
app.post('/api/auth/reset-password', rateLimit, (req, res) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !validPassword(password))
    return res.status(400).json({ error: 'Choose a password of 8–128 characters.' });
  const reset = db
    .prepare('SELECT * FROM password_resets WHERE token=? AND expires>?')
    .get(hash(token), Date.now());
  if (!reset) return res.status(400).json({ error: 'This reset link is invalid or expired.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
    passwordHash(password),
    reset.user_id,
  );
  db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(reset.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id=?').run(reset.user_id);
  res.json({ ok: true });
});
app.get('/api/profile', requireUser, (req, res) => res.json(player(req.user)));
app.put('/api/profile', requireUser, (req, res) => {
  const { username, bio, avatar } = req.body;
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9_ -]{2,24}$/.test(username.trim()) ||
    typeof bio !== 'string' ||
    bio.length > 240 ||
    !['🌱', '🧠', '🦊', '🐼', '🚀', '🪴', '😎', '🐱'].includes(avatar)
  )
    return res
      .status(400)
      .json({ error: 'Check your username, avatar, and bio (240 characters maximum).' });
  db.prepare('UPDATE users SET username=?,bio=?,avatar=? WHERE id=?').run(
    username.trim(),
    bio,
    avatar,
    req.user.id,
  );
  res.json(player(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)));
});
app.post('/api/profile/password', requireUser, rateLimit, (req, res) => {
  if (
    !validPassword(req.body.password) ||
    typeof req.body.currentPassword !== 'string' ||
    req.body.currentPassword.length > 128 ||
    !verifyPassword(req.body.currentPassword, req.user.password_hash)
  )
    return res.status(400).json({
      error: 'Check your current password. Your new password must have at least 8 characters.',
    });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(
    passwordHash(req.body.password),
    req.user.id,
  );
  db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(req.user.id);
  session(res, req.user);
  res.json({ ok: true });
});
app.delete('/api/profile', requireUser, (req, res) => {
  if (
    typeof req.body.password !== 'string' ||
    req.body.password.length > 128 ||
    !verifyPassword(req.body.password, req.user.password_hash)
  )
    return res.status(400).json({ error: 'Enter your current password to delete your account.' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
  res.clearCookie('pm_session', { path: '/' }).json({ ok: true });
});
app.get('/api/games', (req, res) => res.json(games()));
app.get('/api/profile/history', requireUser, (req, res) => res.json(historyFor(req.user.id)));
app.get('/api/achievements', (req, res) => res.json(achievements()));
app.get('/api/daily-challenge', (req, res) => res.json(dailyChallenge()));
app.post('/api/games/session', (req, res) => {
  const game = req.body.game ?? 'sliding';
  if (!games().some((item) => item.id === game && item.available))
    return res.status(400).json({ error: 'Choose an available game.' });
  if (req.body.daily && game !== 'sliding')
    return res.status(400).json({ error: 'The daily challenge uses Sliding Puzzle.' });
  const daily = req.body.daily ? new Date().toISOString().slice(0, 10) : null;
  const dailyPuzzle = daily ? dailyChallenge(daily) : null;
  const difficulty = dailyPuzzle?.difficulty || req.body.difficulty;
  if (!Object.hasOwn(DIFFICULTIES, difficulty))
    return res.status(400).json({ error: 'Choose a valid difficulty.' });
  const arcade = ARCADE_GAMES.includes(game);
  const puzzle =
      dailyPuzzle ||
      (arcade
        ? generateArcade(game, difficulty, randomUUID())
        : generatePuzzle(difficulty, randomUUID())),
    id = randomUUID();
  db.prepare(
    'INSERT INTO game_sessions(id,user_id,difficulty,board,daily,created,game) VALUES(?,?,?,?,?,?,?)',
  ).run(
    id,
    req.user?.id || null,
    difficulty,
    JSON.stringify(arcade ? puzzle : puzzle.board),
    daily,
    Date.now(),
    game,
  );
  res.json({ id, difficulty, daily, game, ...(arcade ? { puzzle } : puzzle) });
});
app.post('/api/games/session/complete', (req, res) => {
  const { id, moves, seconds, hints } = req.body;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid game session.' });
  const game = db.prepare('SELECT * FROM game_sessions WHERE id=? AND completed=0').get(id);
  if (!game || game.user_id !== (req.user?.id || null))
    return res.status(400).json({ error: 'This game session is no longer available.' });
  if (
    !Array.isArray(moves) ||
    moves.length > 10000 ||
    !moves.length ||
    !moves.every(Number.isInteger) ||
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > Math.ceil((Date.now() - game.created) / 1000) + 2 ||
    !Number.isInteger(hints) ||
    hints < 0 ||
    hints > DIFFICULTIES[game.difficulty].hints
  )
    return res.status(400).json({ error: 'Invalid game result.' });
  let moveCount = moves.length,
    score;
  if (ARCADE_GAMES.includes(game.game)) {
    if (hints !== 0) return res.status(400).json({ error: 'Hints are not used in this game.' });
    const state = replayArcade(JSON.parse(game.board), moves);
    if (!state) return res.status(400).json({ error: 'Invalid move history.' });
    if (!state.complete) return res.status(400).json({ error: 'The puzzle is not solved yet.' });
    moveCount = state.moves;
    score = arcadeScore(game.difficulty, seconds, state.mistakes);
  } else {
    let board = JSON.parse(game.board);
    for (const tile of moves) {
      board = moveTile(board, tile);
      if (!board) return res.status(400).json({ error: 'Invalid move history.' });
    }
    if (!isSolved(board)) return res.status(400).json({ error: 'The puzzle is not solved yet.' });
    score = calculateScore(game.difficulty, seconds, moves.length, hints);
  }
  const result = {
    id,
    game: game.game,
    difficulty: game.difficulty,
    seconds,
    moves: moveCount,
    hints,
    score,
    xp: DIFFICULTIES[game.difficulty].xp,
    daily: game.daily,
    date: new Date().toISOString(),
  };
  db.prepare('UPDATE game_sessions SET completed=1 WHERE id=?').run(id);
  const duplicate =
    game.daily &&
    req.user &&
    db.prepare('SELECT id FROM results WHERE user_id=? AND daily=?').get(req.user.id, game.daily);
  if (req.user && !duplicate) {
    db.prepare(
      'INSERT INTO results(id,user_id,difficulty,seconds,moves,hints,score,xp,daily,date,game) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      req.user.id,
      result.difficulty,
      seconds,
      result.moves,
      hints,
      result.score,
      result.xp,
      result.daily,
      result.date,
      result.game,
    );
    unlockAchievements(req.user.id, historyFor(req.user.id));
  }
  res.json({ result, player: req.user ? player(req.user) : null, duplicate: !!duplicate });
});
app.get('/api/leaderboard', (req, res) => {
  const category = req.query.category || 'score';
  let rows = db
    .prepare(
      `SELECT u.id,u.username,u.avatar,COUNT(r.id) AS solved,COALESCE(SUM(r.score),0) AS score,COALESCE(SUM(r.xp),0) AS xp,MIN(r.seconds) AS fastest,MIN(r.moves) AS fewest FROM users u JOIN results r ON r.user_id=u.id WHERE u.suspended=0 ${category === 'daily' ? 'AND r.daily=?' : ''} GROUP BY u.id`,
    )
    .all(...(category === 'daily' ? [new Date().toISOString().slice(0, 10)] : []));
  rows = rows.map((r) => ({ ...r, level: levelInfo(r.xp).level }));
  const key = { time: 'fastest', moves: 'fewest', level: 'level' }[category] || 'score';
  rows.sort((a, b) => (['fastest', 'fewest'].includes(key) ? a[key] - b[key] : b[key] - a[key]));
  res.json(rows.slice(0, 100).map((r, i) => ({ ...r, rank: i + 1 })));
});
registerCommunityRoutes(app, requireUser);
app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
if (production) {
  app.use(express.static(resolve('dist')));
  app.get('*', (req, res) => res.sendFile(resolve('dist/index.html')));
}
app.use((err, req, res, next) => {
  const status =
    Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error:
      status >= 500
        ? 'Something went wrong. Please try again.'
        : err.type === 'entity.parse.failed'
          ? 'Send a valid JSON request.'
          : err.message,
  });
});
db.prepare('DELETE FROM auth_sessions WHERE expires<?').run(Date.now());
db.prepare('DELETE FROM game_sessions WHERE created<? AND completed=0').run(
  Date.now() - 7 * 86400000,
);
const server = app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log(`PuzzleMind API is running on port ${process.env.PORT || 3001}`),
);
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Allow in-flight requests to finish before closing SQLite during a redeploy.
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  server.close(() => {
    db.close();
    clearTimeout(deadline);
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
