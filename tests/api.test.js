import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('account, game, daily challenge, and password lifecycle', { timeout: 30000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'puzzlemind-test-'));
  const port = 3300 + Math.floor(Math.random() * 1000),
    base = `http://127.0.0.1:${port}`;
  let output = '';
  const server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: directory, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (data) => (output += data.toString()));
  server.stderr.on('data', (data) => (output += data.toString()));
  let cookie = '';
  async function request(path, method = 'GET', body, headers = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  try {
    for (let i = 0; i < 100; i++) {
      if (output.includes('API is running')) break;
      if (server.exitCode !== null) throw new Error(output);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal((await request('/api/auth/me')).data, null);
    assert.equal((await request('/api/profile')).status, 401);
    assert.equal(
      (await request('/api/auth/register', 'POST', { username: 'T', email: 'bad', password: 'x' }))
        .status,
      400,
    );
    const registration = await request('/api/auth/register', 'POST', {
      username: 'Test Player',
      email: 'player@example.com',
      password: 'SecurePassword123!',
    });
    assert.equal(registration.status, 201);
    assert.ok(registration.headers.get('set-cookie').includes('HttpOnly'));
    assert.ok(registration.headers.get('set-cookie').includes('SameSite=Strict'));
    cookie = registration.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/auth/me')).data.username, 'Test Player');
    assert.equal(
      (await request('/api/games/session', 'POST', { difficulty: 'impossible' })).status,
      400,
    );
    assert.equal(
      (
        await request(
          '/api/games/session',
          'POST',
          { difficulty: 'easy' },
          { Origin: 'https://untrusted.example' },
        )
      ).status,
      403,
    );
    const session = (await request('/api/games/session', 'POST', { difficulty: 'easy' })).data;
    assert.equal(
      (
        await request('/api/games/session/complete', 'POST', {
          id: session.id,
          moves: [99],
          seconds: 0,
          hints: 0,
        })
      ).status,
      400,
    );
    const completion = await request('/api/games/session/complete', 'POST', {
      id: session.id,
      moves: session.solution,
      seconds: 0,
      hints: 0,
      score: 999999,
    });
    assert.equal(completion.status, 200);
    assert.equal(completion.data.result.score, 500);
    assert.equal(completion.data.player.xp, 20);
    assert.equal(completion.data.player.history.length, 1);
    assert.equal(completion.data.player.achievements.length, 3);
    assert.equal(
      (
        await request('/api/games/session/complete', 'POST', {
          id: session.id,
          moves: session.solution,
          seconds: 0,
          hints: 0,
        })
      ).status,
      400,
      'a result cannot be replayed for XP',
    );
    assert.equal((await request('/api/leaderboard')).data[0].score, 500);
    const daily = (await request('/api/daily-challenge')).data;
    const firstDaily = (await request('/api/games/session', 'POST', { daily: true })).data;
    assert.deepEqual(daily.board, firstDaily.board);
    await request('/api/games/session/complete', 'POST', {
      id: firstDaily.id,
      moves: firstDaily.solution,
      seconds: 0,
      hints: 0,
    });
    const secondDaily = (await request('/api/games/session', 'POST', { daily: true })).data;
    const duplicate = (
      await request('/api/games/session/complete', 'POST', {
        id: secondDaily.id,
        moves: secondDaily.solution,
        seconds: 0,
        hints: 0,
      })
    ).data;
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.player.history.length, 2);
    assert.equal(duplicate.player.xp, 60);
    const edited = await request('/api/profile', 'PUT', {
      username: 'New Name',
      bio: 'A puzzle a day.',
      avatar: '🦊',
    });
    assert.equal(edited.data.avatar, '🦊');
    assert.equal(edited.data.bio, 'A puzzle a day.');
    await request('/api/auth/logout', 'POST');
    assert.equal((await request('/api/auth/me')).data, null);
    assert.equal(
      (
        await request('/api/auth/login', 'POST', {
          email: 'player@example.com',
          password: 'WrongPassword123!',
        })
      ).status,
      401,
    );
    const login = await request('/api/auth/login', 'POST', {
      email: 'PLAYER@example.com',
      password: 'SecurePassword123!',
    });
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal(login.data.history.length, 2);
    await request('/api/auth/forgot-password', 'POST', { email: 'player@example.com' });
    for (let i = 0; i < 20 && !output.includes('token='); i++)
      await new Promise((resolve) => setTimeout(resolve, 25));
    const token = output.match(/token=([a-f0-9]+)/)?.[1];
    assert.ok(token);
    assert.equal(
      (
        await request('/api/auth/reset-password', 'POST', {
          token,
          password: 'ChangedPassword123!',
        })
      ).status,
      200,
    );
    assert.equal(
      (await request('/api/auth/me')).data,
      null,
      'password resets revoke active sessions',
    );
    assert.equal(
      (
        await request('/api/auth/reset-password', 'POST', {
          token,
          password: 'AnotherPassword123!',
        })
      ).status,
      400,
      'reset token is single use',
    );
    const relogin = await request('/api/auth/login', 'POST', {
      email: 'player@example.com',
      password: 'ChangedPassword123!',
    });
    cookie = relogin.headers.get('set-cookie').split(';')[0];
    assert.equal(
      (await request('/api/profile', 'DELETE', { password: 'WrongPassword123!' })).status,
      400,
    );
    assert.equal(
      (await request('/api/profile', 'DELETE', { password: 'ChangedPassword123!' })).status,
      200,
    );
    assert.equal((await request('/api/auth/me')).data, null);
    assert.equal((await request('/api/leaderboard')).data.length, 0);
  } finally {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
