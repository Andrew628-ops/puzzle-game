import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173');
await page.getByRole('heading', { name: 'Hello, curious mind.' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  'desktop must not overflow',
);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(350);
await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  'mobile must not overflow',
);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(350);
const firstResponse = page.waitForResponse(
  (r) => r.url().endsWith('/api/games/session') && r.status() === 200,
);
await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
await firstResponse;
await page
  .getByRole('button', { name: /Move tile/ })
  .first()
  .waitFor();
await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
await page.screenshot({ path: 'test-results/play-desktop.png', fullPage: true });
const responsePromise = page.waitForResponse(
  (r) => r.url().endsWith('/api/games/session') && r.status() === 200,
);
await page.getByRole('button', { name: 'New game', exact: true }).click();
const session = await (await responsePromise).json();
await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
assert.equal(await page.locator('.game-metrics strong').nth(0).textContent(), '00');
const invalid = session.board.find(
  (tile, index) =>
    tile &&
    Math.abs(Math.floor(index / 3) - Math.floor(session.board.indexOf(0) / 3)) +
      Math.abs((index % 3) - (session.board.indexOf(0) % 3)) !==
      1,
);
await page.getByRole('button', { name: `Move tile ${invalid}`, exact: true }).click();
assert.equal(
  await page.locator('.game-metrics strong').nth(0).textContent(),
  '00',
  'invalid clicks do not increase moves',
);
await page.getByRole('button', { name: `Move tile ${session.solution[0]}`, exact: true }).click();
assert.equal(await page.locator('.game-metrics strong').nth(0).textContent(), '01');
const reverseDelta = session.board.indexOf(0) - session.board.indexOf(session.solution[0]);
await page.keyboard.press(
  { 3: 'ArrowUp', '-3': 'ArrowDown', 1: 'ArrowLeft', '-1': 'ArrowRight' }[reverseDelta],
);
assert.equal(
  await page.locator('.game-metrics strong').nth(0).textContent(),
  '02',
  'arrow keys work after clicking a tile',
);
await page.waitForTimeout(1100);
await page.getByRole('button', { name: 'Pause', exact: true }).click();
const pausedTime = await page.locator('.game-metrics strong').nth(1).textContent();
assert.equal(
  await page.locator('.puzzle-board').evaluate((el) => getComputedStyle(el).visibility),
  'hidden',
);
await page.waitForTimeout(1200);
assert.equal(
  await page.locator('.game-metrics strong').nth(1).textContent(),
  pausedTime,
  'pause stops timer',
);
await page.getByRole('button', { name: 'Let’s keep going' }).click();
await page.getByRole('button', { name: 'Restart', exact: true }).click();
assert.equal(await page.locator('.game-metrics strong').nth(0).textContent(), '00');
assert.equal(await page.locator('.game-metrics strong').nth(1).textContent(), '00:00');
const restored = await page
  .locator('.puzzle-board')
  .evaluate((el) => Array.from(el.children).map((child) => Number(child.textContent) || 0));
assert.deepEqual(restored, session.board, 'restart restores initial board');
await page.getByRole('button', { name: 'Hint 5' }).click();
assert.equal(await page.locator('.hinted').textContent(), String(session.solution[0]));
for (const tile of session.solution)
  await page.getByRole('button', { name: `Move tile ${tile}`, exact: true }).click();
await page.getByRole('heading', { name: 'Puzzle complete!' }).waitFor();
await page.screenshot({ path: 'test-results/win-desktop.png', fullPage: true });
await page.getByRole('button', { name: 'My dashboard', exact: true }).last().click();
await page.getByRole('heading', { name: 'Your recent games' }).waitFor();
assert.equal(await page.locator('tbody tr').count(), 1);
await page.reload();
await page.locator('tbody tr').first().waitFor();
assert.equal(await page.locator('tbody tr').count(), 1, 'guest history persists after reload');
await page.getByRole('button', { name: 'Log in', exact: true }).click();
await page.getByRole('button', { name: 'Create an account', exact: true }).click();
const email = `browser-${Date.now()}@example.com`;
await page.getByLabel('Username', { exact: true }).fill('Browser Tester');
await page.getByLabel('Email address', { exact: true }).fill(email);
await page.getByLabel('Password', { exact: true }).fill('PuzzleTest123!');
await page.getByLabel('Confirm password', { exact: true }).fill('PuzzleTest123!');
await page.getByRole('button', { name: 'Create my account' }).click();
await page.getByRole('heading', { name: 'Your little victories.' }).waitFor();
await page.waitForFunction(() => document.querySelector('.header-profile'));
await page.reload();
await page.locator('.header-profile').filter({ hasText: 'Browser Tester' }).waitFor();
await page.getByRole('button', { name: 'Play your first puzzle' }).click();
await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
const accountGameResponse = page.waitForResponse(
  (r) => r.url().endsWith('/api/games/session') && r.status() === 200,
);
await page.getByRole('button', { name: 'New game', exact: true }).click();
const accountGame = await (await accountGameResponse).json();
await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
for (const tile of accountGame.solution)
  await page.getByRole('button', { name: `Move tile ${tile}`, exact: true }).click();
await page.getByRole('heading', { name: 'Puzzle complete!' }).waitFor();
await page.getByRole('button', { name: 'My dashboard', exact: true }).last().click();
assert.equal(await page.locator('tbody tr').count(), 1);
await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
await page.locator('tr.your-row').waitFor();
assert.equal(
  await page.locator('tr.your-row').count(),
  1,
  'registered score appears on leaderboard',
);
for (const route of [
  'games',
  'daily',
  'achievements',
  'profile',
  'settings',
  'dashboard',
  'leaderboard',
]) {
  await page.goto(`http://localhost:5173/#${route}`);
  await page.waitForTimeout(250);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    `${route} mobile must not overflow`,
  );
  await page.screenshot({ path: `test-results/${route}-mobile.png`, fullPage: true });
}
await page.request.delete('http://localhost:5173/api/profile', {
  data: { password: 'PuzzleTest123!' },
});
assert.deepEqual(errors, [], 'no browser runtime errors');
await browser.close();
console.log(
  'Browser checks passed: responsive layouts, gameplay, pause, restart, hints, win, guest persistence, registration, secure session persistence, account results, and leaderboard.',
);
