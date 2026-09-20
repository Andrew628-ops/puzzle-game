import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer } from './server-fixture.js';
import { solutionActions } from './arcade-helpers.js';

const fixture = await startServer({ production: true });
let browser;
mkdirSync('test-results', { recursive: true });
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(10000);
  const sessionResponse = () =>
    page.waitForResponse(
      (response) => response.url().endsWith('/api/games/session') && response.status() === 200,
    );
  const ready = () => page.waitForFunction(() => !document.querySelector('.loading-overlay'));
  async function openGame(name) {
    await page.goto(`${fixture.base}/#games`);
    const response = sessionResponse();
    await page.getByRole('button', { name: `Play ${name}`, exact: true }).click();
    const session = await (await response).json();
    await ready();
    return session;
  }
  const games = (await fixture.request('/api/games')).data;
  for (const game of games) {
    const session = await openGame(game.name);
    assert.equal(session.game, game.id);
    if (game.id !== 'sliding') assert.ok(page.url().endsWith(`game=${game.id}`));
    await page.screenshot({ path: `test-results/${game.id}-desktop.png`, fullPage: true });
    if (game.id === 'memory') {
      const wrong = session.puzzle.cards.findIndex((card) => card !== session.puzzle.cards[0]);
      await page.getByRole('button', { name: 'Flip card 1', exact: true }).click();
      await page.getByRole('button', { name: `Flip card ${wrong + 1}`, exact: true }).click();
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.equal(
        await page.locator('.arcade-board').evaluate((el) => getComputedStyle(el).visibility),
        'hidden',
      );
      const before = await page.locator('.game-metrics strong').nth(1).textContent();
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('.game-metrics strong').nth(1).textContent(), before);
      await page.getByRole('button', { name: 'Let’s keep going' }).click();
      await page.getByRole('button', { name: 'Flip card 1', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Restart', exact: true }).click();
      assert.equal(await page.locator('.game-metrics strong').first().textContent(), '00');
      assert.equal(await page.locator('.match-card.matched').count(), 0);
      for (const action of solutionActions(session.puzzle))
        await page.getByRole('button', { name: `Flip card ${action + 1}`, exact: true }).click();
    } else if (game.id === 'sudoku') {
      const empty = session.puzzle.board.indexOf(0);
      const wrong = session.puzzle.board
        .slice(Math.floor(empty / 9) * 9, Math.floor(empty / 9) * 9 + 9)
        .find(Boolean);
      await page.locator(`#sudoku-cell-${empty}`).click();
      await page.keyboard.press(String(wrong));
      assert.ok((await page.locator('.sudoku-cell.conflict').count()) >= 2);
      await page.getByRole('button', { name: 'Erase cell', exact: true }).click();
      assert.equal(await page.locator(`#sudoku-cell-${empty}`).textContent(), '');
      for (const action of solutionActions(session.puzzle)) {
        await page.locator(`#sudoku-cell-${Math.floor(action / 10)}`).click();
        await page.getByRole('button', { name: `Enter ${action % 10}`, exact: true }).click();
      }
    } else if (game.id === 'pattern') {
      const first = session.puzzle.rounds[0];
      await page
        .locator('.pattern-options button')
        .nth((first.answer + 1) % 4)
        .click();
      assert.match(await page.locator('.arcade-feedback').textContent(), /Not quite/);
      for (const round of session.puzzle.rounds)
        await page.locator('.pattern-options button').nth(round.answer).click();
    } else if (game.id === 'word') {
      await page.locator('.letter-rack button').first().click();
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.equal(await page.locator('.word-answer').textContent(), '');
      // A failed save keeps the completed board and offers a working retry.
      let fail = true;
      await page.route('**/api/games/session/complete', async (route) => {
        if (fail) {
          fail = false;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Please retry saving.' }),
          });
        } else await route.continue();
      });
      for (const action of solutionActions(session.puzzle)) {
        if (action === -2)
          await page.getByRole('button', { name: 'Check word', exact: true }).click();
        else await page.locator('.letter-rack button').nth(action).click();
      }
      await page.getByRole('alert').filter({ hasText: 'Please retry saving.' }).waitFor();
      await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.unroute('**/api/games/session/complete');
    } else {
      if (game.id === 'picture') {
        assert.match(
          await page
            .locator('.picture-tile')
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundImage),
          /picture-landscape.svg/,
        );
        assert.equal(
          await page
            .locator('.picture-reference')
            .evaluate((el) => el.complete && el.naturalWidth > 0),
          true,
        );
      }
      for (const tile of session.solution)
        await page.getByRole('button', { name: `Move tile ${tile}`, exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Puzzle complete!', exact: true }).waitFor();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'My dashboard', exact: true })
      .click();
    await page.locator('tbody tr').filter({ hasText: game.name }).waitFor();
  }
  await page.reload();
  await page.locator('tbody tr').nth(5).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 6, 'all guest results survive reload');
  assert.equal(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('pm-history')).reduce((sum, game) => sum + game.xp, 0),
    ),
    120,
  );

  for (const game of games.filter((game) => game.id !== 'sliding')) {
    await openGame(game.name);
    const response = sessionResponse();
    await page.getByRole('button', { name: /^Expert/ }).click();
    assert.equal((await (await response).json()).difficulty, 'expert');
    await ready();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(350);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${game.id} fits ${width}px`,
      );
    }
    await page.screenshot({ path: `test-results/${game.id}-mobile.png`, fullPage: true });
    const reloaded = sessionResponse();
    await page.reload();
    assert.equal((await (await reloaded).json()).game, game.id, 'direct URL preserves the game');
    await ready();
    await page.setViewportSize({ width: 1440, height: 1050 });
  }

  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('Library Player');
  await page.getByLabel('Email address', { exact: true }).fill('library@example.com');
  await page.getByLabel('Password', { exact: true }).fill('LibraryPass123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('LibraryPass123!');
  await page.getByRole('button', { name: 'Create my account', exact: true }).click();
  await page.locator('.header-profile').waitFor();
  const accountSession = await openGame('Pattern Puzzle');
  for (const round of accountSession.puzzle.rounds)
    await page.locator('.pattern-options button').nth(round.answer).click();
  await page.getByRole('heading', { name: 'Puzzle complete!', exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'My dashboard', exact: true }).click();
  await page.reload();
  await page.locator('tbody tr').filter({ hasText: 'Pattern Puzzle' }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1, 'account history is saved separately');
  await page.goto(`${fixture.base}/#leaderboard`);
  await page.locator('tr.your-row').waitFor();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(
    'All games browser checks passed: six completions, score retry, controls, guest/account persistence, direct URLs, difficulties, and mobile layouts.',
  );
} finally {
  await browser?.close();
  await fixture.stop();
}
