import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './server-fixture.js';
import { isSolved, moveTile } from '../shared/game.js';

test(
  'administrator permissions, suspension, catalogs, reports, announcements, and daily scheduling',
  { timeout: 40000 },
  async () => {
    const fixture = await startServer();
    const { request } = fixture;
    try {
      assert.equal((await request('/api/admin/overview')).status, 401);
      const owner = await request('/api/auth/register', {
        method: 'POST',
        body: {
          username: 'Studio Owner',
          email: 'owner@example.com',
          password: 'TestingPassword123!',
          role: 'admin',
        },
      });
      assert.equal(owner.data.role, 'player', 'registration cannot grant privileges');
      assert.equal((await request('/api/admin/overview', { cookie: owner.cookie })).status, 403);
      fixture.grantAdmin('owner@example.com');
      assert.equal((await request('/api/auth/me', { cookie: owner.cookie })).data.role, 'admin');
      const admin = (path, method = 'GET', body) =>
        request(`/api/admin${path}`, { cookie: owner.cookie, method, body });
      const member = await request('/api/auth/register', {
        method: 'POST',
        body: {
          username: 'Curious Player',
          email: 'player@example.com',
          password: 'TestingPassword123!',
        },
      });
      const another = await request('/api/auth/register', {
        method: 'POST',
        body: {
          username: 'Other Player',
          email: 'other@example.com',
          password: 'TestingPassword123!',
        },
      });
      let playerCookie = member.cookie;
      const player = (path, method = 'GET', body) =>
        request(`/api${path}`, { cookie: playerCookie, method, body });
      for (const path of [
        '/users',
        '/daily',
        '/achievements',
        '/games',
        '/reports',
        '/announcements',
      ])
        assert.equal((await request(`/api/admin${path}`, { cookie: playerCookie })).status, 403);
      assert.equal(
        (
          await request('/api/admin/games', {
            cookie: owner.cookie,
            method: 'POST',
            headers: { Origin: 'https://untrusted.example' },
            body: {},
          })
        ).status,
        403,
      );
      const game = (await player('/games/session', 'POST', { difficulty: 'easy' })).data;
      await player('/games/session/complete', 'POST', {
        id: game.id,
        moves: game.solution,
        seconds: 0,
        hints: 0,
      });
      assert.equal((await request('/api/leaderboard')).data.length, 1);
      assert.equal(
        (
          await admin(`/users/${owner.data.id}`, 'PATCH', {
            suspended: true,
            reason: 'Cannot suspend admins',
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await admin(`/users/${member.data.id}`, 'PATCH', {
            suspended: true,
            reason: 'Policy violation test',
          })
        ).status,
        200,
      );
      assert.equal((await player('/profile')).status, 401, 'suspension revokes existing sessions');
      assert.equal(
        (await request('/api/leaderboard')).data.length,
        0,
        'suspended accounts leave public ranks',
      );
      assert.equal(
        (
          await request('/api/auth/login', {
            method: 'POST',
            body: { email: 'player@example.com', password: 'TestingPassword123!' },
          })
        ).status,
        403,
      );
      await admin(`/users/${member.data.id}`, 'PATCH', { suspended: false });
      const login = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'player@example.com', password: 'TestingPassword123!' },
      });
      playerCookie = login.cookie;
      assert.equal(login.data.history.length, 1, 'restoring an account preserves results');
      assert.equal((await request('/api/leaderboard')).data.length, 1);
      assert.equal((await admin('/users?q=curious')).data.total, 1);
      assert.equal((await admin('/users?q=' + encodeURIComponent("' OR 1=1 --"))).data.total, 0);

      const report = await player('/reports', 'POST', {
        category: 'bug',
        subject: 'A tile animation issue',
        body: 'The tile animation stutters when I resize the window.',
      });
      assert.equal(report.status, 201);
      assert.equal(
        (await request('/api/reports', { cookie: another.cookie })).data.length,
        0,
        'reports are private to their owners',
      );
      assert.equal(
        (
          await request(`/api/admin/reports/${report.data.id}`, {
            cookie: playerCookie,
            method: 'PATCH',
            body: { status: 'resolved', response: 'Forged reply' },
          })
        ).status,
        403,
      );
      assert.equal((await admin('/reports')).data.total, 1);
      await admin(`/reports/${report.data.id}`, 'PATCH', {
        status: 'resolved',
        response: 'Thanks for the detail. We have corrected the animation.',
      });
      const updated = (await player('/reports')).data[0];
      assert.equal(updated.status, 'resolved');
      assert.match(updated.response, /corrected/);
      assert.equal((await admin('/reports?status=resolved')).data.total, 1);
      await admin(`/reports/${report.data.id}`, 'PATCH', {
        status: 'open',
        response: 'Reopened for follow-up.',
      });
      assert.equal((await admin('/reports')).data.total, 1);

      const draft = await admin('/announcements', 'POST', {
        title: 'A new chapter',
        body: 'A fresh set of puzzles is on its way.',
        published: false,
      });
      assert.equal(draft.status, 201);
      assert.equal((await request('/api/announcements')).data.length, 0);
      await admin(`/announcements/${draft.data.id}`, 'PUT', {
        title: 'A new chapter',
        body: 'A fresh set of puzzles is on its way.',
        published: true,
      });
      assert.equal((await request('/api/announcements')).data[0].title, 'A new chapter');
      await admin(`/announcements/${draft.data.id}`, 'PUT', {
        title: 'A new chapter',
        body: 'Back in draft.',
        published: false,
      });
      assert.equal((await request('/api/announcements')).data.length, 0);
      await admin(`/announcements/${draft.data.id}`, 'DELETE');
      assert.equal((await admin('/announcements')).data.length, 0);

      const newGame = {
        id: 'color-maze',
        name: 'Color Maze',
        description: 'Find a colorful path through the maze.',
        tag: 'LOGIC',
        color: 'blue',
        available: true,
      };
      assert.equal(
        (await admin('/games', 'POST', newGame)).status,
        400,
        'a listing cannot pretend to be a playable engine',
      );
      newGame.available = false;
      assert.equal((await admin('/games', 'POST', newGame)).status, 201);
      assert.equal(
        (await request('/api/games')).data.find((g) => g.id === 'color-maze').available,
        false,
      );
      await admin('/games/color-maze', 'PUT', { ...newGame, name: 'Color Trails' });
      assert.equal(
        (await request('/api/games')).data.find((g) => g.id === 'color-maze').name,
        'Color Trails',
      );
      assert.equal(
        (await admin('/games/sliding', 'PUT', { ...newGame, id: 'sliding' })).status,
        400,
        'the daily game cannot be disabled',
      );
      const badge = await admin('/achievements', 'POST', {
        name: 'Keep it going',
        description: 'Complete two puzzles.',
        icon: 'flame',
        metric: 'first',
        goal: 2,
      });
      assert.equal(badge.status, 201);
      assert.equal(
        (await request('/api/achievements')).data.find((a) => a.id === badge.data.id).goal,
        2,
      );
      const nextGame = (await player('/games/session', 'POST', { difficulty: 'easy' })).data;
      const win = await player('/games/session/complete', 'POST', {
        id: nextGame.id,
        moves: nextGame.solution,
        seconds: 0,
        hints: 0,
      });
      assert.ok(
        win.data.player.achievements.some((a) => a.id === badge.data.id),
        'custom requirements unlock from actual results',
      );
      const retroactive = await admin('/achievements', 'POST', {
        name: 'Already on your way',
        description: 'Complete your first puzzle.',
        icon: 'footprints',
        metric: 'first',
        goal: 1,
      });
      assert.ok(
        (await player('/profile')).data.achievements.some((a) => a.id === retroactive.data.id),
        'existing progress counts on profile refresh',
      );

      const current = (await request('/api/daily-challenge')).data;
      assert.equal(
        (await admin('/daily', 'PUT', { date: current.date, difficulty: 'easy' })).status,
        409,
      );
      assert.equal((await admin(`/daily/${current.date}`, 'DELETE')).status, 409);
      assert.equal(
        (await admin('/daily/preview', 'POST', { date: '2099-02-30', difficulty: 'easy' })).status,
        400,
      );
      const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const input = { date, difficulty: 'hard', seed: 'a-new-chapter' };
      const preview = await admin('/daily/preview', 'POST', input);
      assert.equal(preview.status, 200);
      assert.equal(preview.data.board.length, 25);
      let board = preview.data.board;
      for (const tile of preview.data.solution) board = moveTile(board, tile);
      assert.ok(isSolved(board));
      const scheduled = await admin('/daily', 'PUT', input);
      assert.deepEqual(scheduled.data.board, preview.data.board);
      assert.equal((await admin('/daily')).data.find((row) => row.date === date).locked, false);
      assert.deepEqual(
        (await request('/api/daily-challenge')).data.board,
        current.board,
        'future scheduling does not change today',
      );
      // Move this fixture's scheduled row to today to model the UTC date rollover.
      const database = new DatabaseSync(join(fixture.directory, 'puzzlemind.sqlite'));
      database.prepare('DELETE FROM daily_challenges WHERE date=?').run(current.date);
      database.prepare('UPDATE daily_challenges SET date=? WHERE date=?').run(current.date, date);
      database.close();
      const published = (await request('/api/daily-challenge')).data;
      const dailySession = (await player('/games/session', 'POST', { daily: true })).data;
      assert.equal(published.difficulty, 'hard');
      assert.equal(dailySession.difficulty, 'hard');
      assert.deepEqual(dailySession.board, preview.data.board);
      assert.deepEqual(published.board, dailySession.board);
      assert.equal((await admin('/daily', 'PUT', { ...input, date: current.date })).status, 409);
      await admin('/daily', 'PUT', input);
      await admin(`/daily/${date}`, 'DELETE');
      assert.ok(!(await admin('/daily')).data.some((row) => row.date === date));
      const overview = (await admin('/overview')).data;
      assert.equal(overview.users.total, 3);
      assert.equal(overview.stats.completions, 2);
      assert.equal(overview.openReports, 1);
      assert.equal(overview.leaders[0].score, 1000);
      assert.ok(overview.activity.some((a) => a.action === 'player.suspend'));
      assert.ok(overview.activity.some((a) => a.action === 'announcement.delete'));
      assert.ok(overview.activity.some((a) => a.action === 'daily.schedule'));
    } finally {
      await fixture.stop();
    }
  },
);

test('additive migrations preserve accounts and old daily puzzle data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'puzzlemind-migration-'));
  const path = join(directory, 'puzzlemind.sqlite');
  try {
    const old = new DatabaseSync(path);
    old.exec(
      'CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,email TEXT,password_hash TEXT,avatar TEXT,bio TEXT,created_at TEXT); CREATE TABLE daily_challenges(date TEXT PRIMARY KEY,difficulty TEXT,puzzle_data TEXT);',
    );
    old
      .prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)')
      .run(
        'original',
        'Existing Player',
        'existing@example.com',
        'hash',
        '🌱',
        'Keep this bio',
        '2026-01-01T00:00:00Z',
      );
    old
      .prepare('INSERT INTO daily_challenges VALUES(?,?,?)')
      .run('2026-09-19', 'medium', '[1,2,3]');
    old.close();
    execFileSync(
      process.execPath,
      ['--input-type=module', '-e', "import './server/database.js';"],
      { env: { ...process.env, DATA_DIR: directory }, stdio: 'pipe' },
    );
    const migrated = new DatabaseSync(path);
    const user = migrated.prepare('SELECT * FROM users').get();
    assert.equal(user.username, 'Existing Player');
    assert.equal(user.bio, 'Keep this bio');
    assert.equal(user.role, 'player');
    assert.equal(user.suspended, 0);
    assert.equal(
      migrated.prepare('SELECT puzzle_data FROM daily_challenges').get().puzzle_data,
      '[1,2,3]',
    );
    assert.equal(
      migrated.prepare("SELECT color FROM games WHERE slug='memory'").get().color,
      'purple',
    );
    assert.equal(migrated.prepare('SELECT COUNT(*) total FROM achievements').get().total, 8);
    migrated.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
