import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { startServer } from './server-fixture.js';

const fixture = await startServer({ production: true });
let browser;
mkdirSync('test-results', { recursive: true });
try {
  const password = 'StudioBrowser123!';
  await fixture.request('/api/auth/register', {
    method: 'POST',
    body: { username: 'Studio Owner', email: 'studio@example.com', password },
  });
  fixture.grantAdmin('studio@example.com');
  const memberAccount = await fixture.request('/api/auth/register', {
    method: 'POST',
    body: { username: 'Curious Player', email: 'curious@example.com', password },
  });
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    memberContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await adminContext.newPage(),
    member = await memberContext.newPage();
  const errors = [];
  for (const current of [page, member])
    current.on('pageerror', (error) => errors.push(error.message));
  async function login(current, email) {
    await current.goto(fixture.base);
    await current.getByRole('button', { name: 'Log in', exact: true }).click();
    await current.getByLabel('Email address', { exact: true }).fill(email);
    await current.getByLabel('Password', { exact: true }).fill(password);
    await current.getByRole('dialog').getByRole('button', { name: 'Log in', exact: true }).click();
    await current.locator('.header-profile').waitFor();
  }
  await member.goto(`${fixture.base}/#admin`);
  await member
    .getByRole('heading', { name: 'A space for the people behind the puzzles.' })
    .waitFor();
  await login(member, 'curious@example.com');
  await member.goto(`${fixture.base}/#admin`);
  await member
    .getByRole('heading', { name: 'A space for the people behind the puzzles.' })
    .waitFor();
  assert.equal(await member.getByRole('button', { name: 'Admin studio', exact: true }).count(), 0);
  await member.goto(`${fixture.base}/#support`);
  await member.getByLabel('Subject', { exact: true }).fill('A tile animation issue');
  await member
    .getByLabel('Tell us a little more')
    .fill('The tile animation stutters when I resize the window.');
  await member.getByRole('button', { name: 'Send report', exact: true }).click();
  await member.getByRole('heading', { name: 'A tile animation issue' }).waitFor();
  await login(page, 'studio@example.com');
  await page.getByRole('button', { name: 'Admin studio', exact: true }).click();
  await page.getByRole('heading', { name: 'How your community plays' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'test-results/admin-overview-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: /A tile animation issue/ }).click();
  await page
    .getByLabel('Reply to the player')
    .fill('Thanks for reporting this. The animation has been corrected.');
  await page.getByLabel('Status', { exact: true }).selectOption('resolved');
  await page.getByRole('button', { name: 'Save report update' }).click();
  await page.getByRole('heading', { name: 'All caught up.' }).waitFor();
  await member.getByRole('button', { name: 'Refresh', exact: true }).click();
  await member
    .getByText('Thanks for reporting this. The animation has been corrected.', { exact: true })
    .waitFor();
  await member.screenshot({ path: 'test-results/support-mobile.png', fullPage: true });
  console.log('Player report and administrator reply verified.');

  await page.getByRole('tab', { name: 'Announcements', exact: true }).click();
  await page.getByRole('button', { name: 'Write announcement', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('A fresh chapter for curious minds');
  await page
    .getByLabel('Announcement', { exact: true })
    .fill(
      'Your feedback helps us make PuzzleMind a little better every day. Visit Help & feedback to start a conversation.',
    );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByRole('heading', { name: 'A fresh chapter for curious minds' }).waitFor();
  assert.equal((await fixture.request('/api/announcements')).data.length, 0);
  await page.getByRole('button', { name: 'Edit announcement', exact: true }).click();
  await page.getByLabel('Publish to the overview and notifications').check();
  await page.getByRole('button', { name: 'Publish announcement', exact: true }).click();
  await page
    .locator('.admin-announcement .admin-status')
    .filter({ hasText: 'Published' })
    .waitFor();
  await member.goto(fixture.base);
  await member
    .getByRole('button', { name: 'Read announcement A fresh chapter for curious minds' })
    .click();
  await member.getByRole('dialog', { name: 'Community announcement' }).waitFor();
  await member.getByRole('button', { name: 'Back to the good stuff' }).click();
  await member
    .getByRole('button', { name: 'Dismiss announcement A fresh chapter for curious minds' })
    .click();
  assert.equal(await member.locator('.community-news').count(), 0);
  await member.reload();
  await member.getByRole('heading', { name: /Good to see you/ }).waitFor();
  assert.equal(await member.locator('.community-news').count(), 0, 'dismissal survives refresh');
  console.log('Announcement drafts, publishing, reading, and dismissal verified.');

  await page.getByRole('tab', { name: 'Game library', exact: true }).click();
  await page.getByRole('button', { name: 'Add game mode', exact: true }).click();
  await page.getByLabel('Game name', { exact: true }).fill('Color Maze');
  await page.getByLabel('Game slug', { exact: true }).fill('color-maze');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Find a colorful path through the maze.');
  await page.getByLabel('Category', { exact: true }).fill('LOGIC');
  await page.getByRole('button', { name: 'Choose blue card' }).click();
  await page.getByRole('button', { name: 'Add Coming Soon game' }).click();
  await page
    .getByRole('cell', { name: 'Color Maze Find a colorful path through the maze.' })
    .waitFor();
  await member.goto(`${fixture.base}/#games`);
  await member.getByRole('heading', { name: 'Color Maze', exact: true }).waitFor();
  assert.equal(await member.locator('.game-card').count(), 7);
  assert.equal(
    await member
      .locator('.game-card')
      .filter({ hasText: 'Color Maze' })
      .getByRole('button')
      .count(),
    0,
  );

  await page.getByRole('tab', { name: 'Achievements', exact: true }).click();
  await page.getByRole('button', { name: 'Create achievement', exact: true }).click();
  await page.getByLabel('Badge name').fill('Getting into the groove');
  await page.getByLabel('Description', { exact: true }).fill('Complete 10 puzzles.');
  await page.getByRole('button', { name: 'Choose flame badge' }).click();
  await page.getByLabel('Target', { exact: true }).fill('10');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create achievement', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Getting into the groove' }).waitFor();
  await member.goto(`${fixture.base}/#achievements`);
  await member.getByRole('heading', { name: 'Getting into the groove' }).waitFor();

  await page.getByRole('tab', { name: 'Daily puzzles', exact: true }).click();
  await page.getByRole('button', { name: 'Schedule puzzle', exact: true }).click();
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel('UTC date', { exact: true }).fill(date);
  await page.getByLabel('Difficulty', { exact: true }).selectOption('hard');
  await page.getByLabel('Puzzle seed', { exact: false }).fill('tomorrows-aha');
  assert.equal(
    await page.getByRole('button', { name: 'Save schedule', exact: true }).isDisabled(),
    true,
  );
  await page.getByRole('button', { name: 'Preview puzzle', exact: true }).click();
  await page.locator('.admin-puzzle-preview').waitFor();
  assert.equal(await page.locator('.admin-puzzle-preview>div>span').count(), 25);
  await page.screenshot({ path: 'test-results/admin-puzzle-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await page.getByRole('button', { name: `Edit puzzle ${date}`, exact: true }).waitFor();
  await page.getByRole('button', { name: `Edit puzzle ${date}`, exact: true }).click();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('expert');
  await page.getByRole('button', { name: 'Preview puzzle', exact: true }).click();
  await page.locator('.admin-puzzle-preview').waitFor();
  assert.equal(await page.locator('.admin-puzzle-preview>div>span').count(), 36);
  await page.getByRole('button', { name: 'Save schedule', exact: true }).click();
  await page.getByRole('button', { name: `Remove schedule ${date}`, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
  await page.waitForFunction(
    (date) => !document.querySelector(`[aria-label="Edit puzzle ${date}"]`),
    date,
  );

  await page.getByRole('tab', { name: 'Players', exact: true }).click();
  await page.getByLabel('Search players').fill('curious@example.com');
  await page.getByRole('button', { name: 'Search player accounts' }).click();
  await page.getByRole('button', { name: 'Suspend account', exact: true }).click();
  await page
    .getByLabel('Reason', { exact: true })
    .fill('Temporary suspension for the browser verification.');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Suspend account', exact: true })
    .click();
  await page.getByRole('button', { name: 'Restore account', exact: true }).waitFor();
  assert.equal(
    (await fixture.request('/api/profile', { cookie: memberAccount.cookie })).status,
    401,
  );
  await member.goto(`${fixture.base}/#support`);
  await member
    .getByRole('heading', { name: 'Let’s keep the conversation in your corner.' })
    .waitFor();
  await page.getByRole('button', { name: 'Restore account', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Restore account', exact: true })
    .click();
  await page.getByRole('button', { name: 'Suspend account', exact: true }).waitFor();
  for (const [label, slug] of [
    ['Overview', 'overview'],
    ['Players', 'players'],
    ['Daily puzzles', 'daily'],
    ['Achievements', 'achievements'],
    ['Game library', 'games'],
    ['Reports', 'reports'],
    ['Announcements', 'announcements'],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.admin-loading'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${label} must fit mobile`,
    );
    await page.screenshot({ path: `test-results/admin-${slug}-mobile.png`, fullPage: true });
  }
  await page.goto(`${fixture.base}/#settings`);
  await page.getByRole('switch', { name: 'Dark mode', exact: true }).click();
  await page.goto(`${fixture.base}/#admin`);
  await page.getByRole('heading', { name: 'How your community plays' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.mode), 'light');
  await page.screenshot({ path: 'test-results/admin-light-mobile.png', fullPage: true });
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(
    'Admin browser checks passed: access guards, reports/replies, draft/publish/dismiss, live catalogs, badges, preview/schedule/edit/remove, suspend/restore, all mobile tabs, and light mode.',
  );
} catch (error) {
  if (browser)
    for (const [index, context] of browser.contexts().entries()) {
      const page = context.pages()[0];
      await page
        ?.screenshot({ path: `test-results/admin-failure-${index}.png`, fullPage: true })
        .catch(() => {});
    }
  throw error;
} finally {
  await browser?.close();
  await fixture.stop();
}
