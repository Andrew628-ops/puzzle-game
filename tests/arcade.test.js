import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCADE_GAMES,
  generateArcade,
  initialArcadeState,
  arcadeAction,
  replayArcade,
  countSudokuSolutions,
  sudokuConflicts,
} from '../shared/arcade.js';
import { solutionActions, solveSudoku } from './arcade-helpers.js';
import { startServer } from './server-fixture.js';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

for (const game of ARCADE_GAMES) {
  test(`${game}: every difficulty generates deterministic, playable games`, () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      for (let seed = 0; seed < 8; seed++) {
        const puzzle = generateArcade(game, difficulty, String(seed));
        assert.deepEqual(puzzle, generateArcade(game, difficulty, String(seed)));
        assert.equal(initialArcadeState(puzzle).complete, false);
        const actions = solutionActions(puzzle);
        assert.equal(replayArcade(puzzle, actions).complete, true);
        assert.equal(replayArcade(puzzle, actions.slice(0, -1)).complete, false);
        assert.equal(replayArcade(puzzle, [...actions, 0]), null, 'cannot play after completion');
        assert.equal(replayArcade(puzzle, [9999]), null);
        if (game === 'sudoku') {
          assert.equal(countSudokuSolutions(puzzle.board), 1);
          const answer = solveSudoku(puzzle.board);
          for (let i = 0; i < 9; i++) {
            assert.equal(new Set(answer.slice(i * 9, i * 9 + 9)).size, 9);
            assert.equal(new Set(answer.filter((_, j) => j % 9 === i)).size, 9);
            const box = answer.filter(
              (_, j) => Math.floor(j / 27) * 3 + Math.floor((j % 9) / 3) === i,
            );
            assert.equal(new Set(box).size, 9);
          }
        }
      }
    }
  });
}

test('memory rejects repeated selections and waits for mismatches to close', () => {
  const puzzle = { kind: 'memory', cards: [0, 1, 0, 1] };
  const first = arcadeAction(puzzle, initialArcadeState(puzzle), 0);
  assert.equal(arcadeAction(puzzle, first, 0), null);
  const mismatch = arcadeAction(puzzle, first, 1);
  assert.equal(mismatch.mistakes, 1);
  assert.equal(arcadeAction(puzzle, mismatch, 2), null);
  assert.deepEqual(arcadeAction(puzzle, mismatch, -1).selected, []);
  const matched = replayArcade(puzzle, [0, 2]);
  assert.equal(arcadeAction(puzzle, matched, 0), null);
  assert.equal(replayArcade(puzzle, [0, 1, -1, 0, 2, 1, 3]).complete, true);
});

test('Sudoku protects clues and supports correcting and erasing entries', () => {
  const puzzle = generateArcade('sudoku', 'easy', 'edits');
  const state = initialArcadeState(puzzle),
    empty = puzzle.board.indexOf(0);
  const given = puzzle.board.findIndex(Boolean);
  assert.equal(arcadeAction(puzzle, state, given * 10), null);
  const row = Math.floor(empty / 9);
  const wrong = puzzle.board.slice(row * 9, row * 9 + 9).find(Boolean);
  const conflict = arcadeAction(puzzle, state, empty * 10 + wrong);
  assert.ok(sudokuConflicts(conflict.board).includes(empty));
  assert.equal(conflict.mistakes, 1);
  assert.equal(arcadeAction(puzzle, conflict, empty * 10).board[empty], 0);
});

test('word tiles are used once and incorrect answers can be rearranged', () => {
  const puzzle = {
    kind: 'word',
    rounds: [{ word: 'MOON', clue: 'Satellite', letters: ['O', 'M', 'N', 'O'] }],
  };
  const one = replayArcade(puzzle, [0]);
  assert.equal(arcadeAction(puzzle, one, 0), null);
  assert.equal(arcadeAction(puzzle, one, -2), null);
  assert.deepEqual(arcadeAction(puzzle, one, -1).selected, []);
  const wrong = replayArcade(puzzle, [0, 1, 2, 3, -2]);
  assert.equal(wrong.complete, false);
  assert.equal(wrong.mistakes, 1);
  assert.equal(replayArcade(puzzle, [0, 1, 2, 3, -2, -3, 1, 0, 3, 2, -2]).complete, true);
});

test(
  'all catalog games validate results, save their identity, and award account XP',
  { timeout: 30000 },
  async () => {
    const fixture = await startServer();
    try {
      const { request } = fixture;
      const registration = await request('/api/auth/register', {
        method: 'POST',
        body: { username: 'All Games', email: 'games@example.com', password: 'AllGames123!' },
      });
      const cookie = registration.cookie;
      const post = (path, body, auth = cookie) =>
        request(path, { method: 'POST', body, cookie: auth });
      const catalog = (await request('/api/games')).data;
      assert.equal(catalog.filter((game) => game.available).length, 6);
      for (const game of ['missing', '__proto__'])
        assert.equal((await post('/api/games/session', { game, difficulty: 'easy' })).status, 400);
      assert.equal(
        (await post('/api/games/session', { game: 'memory', difficulty: 'easy', daily: true }))
          .status,
        400,
      );
      let completed = 0;
      for (const game of catalog) {
        const sessionResponse = await post('/api/games/session', {
          game: game.id,
          difficulty: 'easy',
        });
        assert.equal(sessionResponse.status, 200);
        const session = sessionResponse.data;
        const moves = session.puzzle ? solutionActions(session.puzzle) : session.solution;
        const payload = {
          id: session.id,
          moves,
          seconds: 0,
          hints: 0,
          score: 999999,
          game: 'fake',
        };
        assert.equal(
          (await post('/api/games/session/complete', payload, '')).status,
          400,
          'another player cannot complete the session',
        );
        assert.equal(
          (await post('/api/games/session/complete', { ...payload, moves: [9999] })).status,
          400,
        );
        assert.equal(
          (await post('/api/games/session/complete', { ...payload, moves: moves.slice(0, -1) }))
            .status,
          400,
        );
        const saved = await post('/api/games/session/complete', payload);
        assert.equal(saved.status, 200, JSON.stringify(saved.data));
        assert.equal(saved.data.result.game, game.id);
        assert.equal(saved.data.result.score, 500);
        assert.equal(saved.data.player.history.length, ++completed);
        assert.equal(saved.data.player.xp, completed * 20);
        assert.equal((await post('/api/games/session/complete', payload)).status, 400);
      }
      const history = (await request('/api/profile/history', { cookie })).data;
      assert.deepEqual(
        new Set(history.map((item) => item.game)),
        new Set(catalog.map((game) => game.id)),
      );
      assert.equal((await request('/api/leaderboard')).data[0].score, 3000);
      const guest = (await post('/api/games/session', { game: 'pattern', difficulty: 'easy' }, ''))
        .data;
      const wrong = (guest.puzzle.rounds[0].answer + 1) % 4;
      const guestResult = await post(
        '/api/games/session/complete',
        { id: guest.id, moves: [wrong, ...solutionActions(guest.puzzle)], seconds: 0, hints: 0 },
        '',
      );
      assert.equal(guestResult.data.result.score, 465, 'mistakes are counted by the server');
      assert.equal(guestResult.data.player, null);
      assert.equal(
        (await request('/api/leaderboard')).data[0].score,
        3000,
        'guest results stay off rankings',
      );

      // Simulate an existing install, then verify the one-time upgrade and later admin choices.
      const db = new DatabaseSync(join(fixture.directory, 'puzzlemind.sqlite'));
      db.exec(
        "DELETE FROM schema_migrations WHERE name='playable-library'; UPDATE games SET status='coming-soon' WHERE slug='memory'",
      );
      execFileSync(
        process.execPath,
        ['--input-type=module', '-e', "import './server/database.js';"],
        { env: fixture.env, stdio: 'pipe' },
      );
      assert.equal(
        db.prepare("SELECT status FROM games WHERE slug='memory'").get().status,
        'available',
      );
      db.exec("UPDATE games SET status='coming-soon' WHERE slug='memory'");
      execFileSync(
        process.execPath,
        ['--input-type=module', '-e', "import './server/database.js';"],
        { env: fixture.env, stdio: 'pipe' },
      );
      assert.equal(
        db.prepare("SELECT status FROM games WHERE slug='memory'").get().status,
        'coming-soon',
      );
      assert.equal(
        (await post('/api/games/session', { game: 'memory', difficulty: 'easy' })).status,
        400,
      );
      assert.equal(db.prepare('SELECT COUNT(*) count FROM results').get().count, 6);
      db.close();
    } finally {
      await fixture.stop();
    }
  },
);
