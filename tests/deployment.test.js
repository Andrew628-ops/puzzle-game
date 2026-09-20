import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './server-fixture.js';

test('production health, cookies, and independent client limits behind a proxy', async () => {
  const app = await startServer({ production: true, trustProxyHops: '1' });
  try {
    const health = await fetch(`${app.base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.equal(health.headers.get('cache-control'), 'no-store');
    for (let i = 0; i < 40; i++) {
      const attempt = await app.request('/api/auth/login', {
        method: 'POST',
        body: {},
        headers: { 'X-Forwarded-For': '192.0.2.1' },
      });
      assert.equal(attempt.status, 400);
    }
    assert.equal(
      (
        await app.request('/api/auth/login', {
          method: 'POST',
          body: {},
          headers: { 'X-Forwarded-For': '192.0.2.1' },
        })
      ).status,
      429,
    );
    // One user's failed logins must not block everyone behind the hosting proxy.
    const registration = await fetch(`${app.base}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.0.2.2',
        Origin: app.base,
      },
      body: JSON.stringify({
        username: 'Hosted player',
        email: 'hosted@example.com',
        password: 'TestPassword123!',
      }),
    });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get('set-cookie');
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; SameSite=Strict/);
    assert.equal(
      (await app.request('/api/auth/me', { cookie: cookie.split(';')[0] })).data.username,
      'Hosted player',
    );
    assert.equal(
      (
        await app.request('/api/auth/logout', {
          method: 'POST',
          headers: { Origin: 'https://untrusted.example' },
        })
      ).status,
      403,
    );
  } finally {
    await app.stop();
  }
});

test('direct hosting ignores spoofed forwarded IPs by default', async () => {
  const app = await startServer();
  try {
    for (let i = 0; i < 41; i++) {
      const result = await app.request('/api/auth/login', {
        method: 'POST',
        body: {},
        headers: { 'X-Forwarded-For': `192.0.2.${i + 1}` },
      });
      assert.equal(result.status, i < 40 ? 400 : 429);
    }
  } finally {
    await app.stop();
  }
});

test('backup captures committed WAL data and refuses to overwrite a snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'puzzlemind-backup-'));
  const db = new DatabaseSync(join(directory, 'puzzlemind.sqlite'));
  try {
    db.exec(
      'PRAGMA journal_mode=WAL; CREATE TABLE progress (score INTEGER); INSERT INTO progress VALUES (500)',
    );
    const destination = join(directory, 'backups', 'snapshot.sqlite');
    const run = () =>
      spawnSync(process.execPath, ['server/backup-cli.js', destination], {
        env: { ...process.env, DATA_DIR: directory },
        encoding: 'utf8',
      });
    const backup = run();
    assert.equal(backup.status, 0, backup.stderr);
    assert.equal(statSync(destination).mode & 0o777, 0o600);
    db.exec('INSERT INTO progress VALUES (1000)');
    const snapshot = new DatabaseSync(destination, { readOnly: true });
    try {
      assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
      assert.deepEqual(
        snapshot
          .prepare('SELECT score FROM progress')
          .all()
          .map((row) => row.score),
        [500],
      );
      const duplicate = run();
      assert.equal(duplicate.status, 1);
      assert.match(duplicate.stderr, /Destination already exists/);
      assert.equal(snapshot.prepare('SELECT COUNT(*) AS count FROM progress').get().count, 1);
    } finally {
      snapshot.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
