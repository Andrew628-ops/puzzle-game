import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIFFICULTIES,
  generatePuzzle,
  moveTile,
  isSolved,
  adjacent,
  calculateScore,
  levelInfo,
  getStreak,
  achievementProgress,
} from '../shared/game.js';

test('all difficulties generate non-solved permutations and can be solved by legal moves', () => {
  for (const [difficulty, config] of Object.entries(DIFFICULTIES))
    for (let i = 0; i < 100; i++) {
      const puzzle = generatePuzzle(difficulty, `test-${i}`);
      let board = puzzle.board;
      assert.equal(board.length, config.size ** 2);
      assert.equal(new Set(board).size, board.length);
      assert.equal(isSolved(board), false);
      for (const tile of puzzle.solution) {
        board = moveTile(board, tile);
        assert.ok(board, 'generated solution must only use legal moves');
      }
      assert.ok(isSolved(board));
    }
});
test('daily boards are deterministic for the same UTC date', () => {
  assert.deepEqual(generatePuzzle('medium', '2026-09-20'), generatePuzzle('medium', '2026-09-20'));
  assert.notDeepEqual(
    generatePuzzle('medium', '2026-09-20').board,
    generatePuzzle('medium', '2026-09-21').board,
  );
});
test('moves reject diagonals, row wrap, blank, and nonexistent tiles without mutating the board', () => {
  const board = [1, 2, 3, 4, 5, 0, 7, 8, 6];
  const original = [...board];
  for (const tile of [0, 1, 2, 4, 7, 8, 30]) assert.equal(moveTile(board, tile), null);
  assert.deepEqual(board, original);
  assert.deepEqual(moveTile(board, 6), [1, 2, 3, 4, 5, 6, 7, 8, 0]);
  assert.deepEqual(adjacent(0, 3), [3, 1]);
});
test('scores apply hint, time, and excess move penalties and never go below zero', () => {
  assert.equal(calculateScore('easy', 0, 22, 0), 500);
  assert.equal(calculateScore('easy', 30, 32, 1), 410);
  assert.equal(calculateScore('expert', 100000, 10000, 2), 0);
});
test('XP thresholds transition exactly at the correct levels', () => {
  for (const [xp, level] of [
    [0, 1],
    [99, 1],
    [100, 2],
    [249, 2],
    [250, 3],
    [500, 4],
    [900, 5],
    [1650, 6],
  ])
    assert.equal(levelInfo(xp).level, level);
  assert.equal(levelInfo(100).progress, 0);
  assert.ok(levelInfo(20000).level >= 10);
});
test('daily streak is based on distinct UTC dates and resets after a missed day', () => {
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
  assert.deepEqual(getStreak([]), { current: 0, longest: 0 });
  assert.deepEqual(getStreak([0, 0, 1, 2, 5, 6].map((n) => ({ date: day(n) }))), {
    current: 3,
    longest: 3,
  });
  assert.deepEqual(getStreak([1, 2, 3].map((n) => ({ date: day(n) }))), { current: 3, longest: 3 });
  assert.deepEqual(getStreak([2, 3, 4].map((n) => ({ date: day(n) }))), { current: 0, longest: 3 });
});
test('achievement counts use real completions and distinct daily challenges', () => {
  const history = [
    { difficulty: 'hard', seconds: 45, hints: 0, daily: '2026-09-20' },
    { difficulty: 'easy', seconds: 85, hints: 1, daily: '2026-09-20' },
  ];
  assert.equal(achievementProgress('first', history, 100), 2);
  assert.equal(achievementProgress('speed', history, 100), 1);
  assert.equal(achievementProgress('perfect', history, 100), 1);
  assert.equal(achievementProgress('daily', history, 100), 1);
});
