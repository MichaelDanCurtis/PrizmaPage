import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const sleep = (ms) => page.waitForTimeout(ms);

// --- Editor (default welcome doc) ---
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(600);
await page.getByText('First time? Read the welcome document').click();
await sleep(500);
await page.hover('[data-testid=hover-zone]');
await sleep(300);
await page.click("button:has-text('Edit')");
await sleep(800);
await page.screenshot({ path: 'scripts/shots/03-editor.png' });

// --- Insert dropdown open ---
await page.click("button:has-text('Insert')");
await sleep(400);
await page.screenshot({ path: 'scripts/shots/04-insert-menu.png' });
await page.keyboard.press('Escape');
await sleep(200);

// --- A document with several components rendered ---
// Insert a curated set: StatCard, Chart, Callout, Table, Badge
const inserts = ['StatCard', 'Chart', 'Callout', 'Table', 'Badge', 'Diagram'];
for (const name of inserts) {
  await page.click('.ProseMirror');
  await sleep(60);
  await page.keyboard.press('End');
  await sleep(60);
  await page.click("button:has-text('Insert')");
  await sleep(250);
  await page.evaluate((n) => {
    const c = Array.from(document.querySelectorAll('div, button, span')).find(el => new RegExp('^' + n + '$').test((el.textContent||'').trim()));
    if (c) c.click();
  }, name);
  await sleep(name === 'Diagram' ? 2600 : 500);
  await page.keyboard.press('Escape');
  await sleep(150);
}
await sleep(500);
await page.screenshot({ path: 'scripts/shots/05-components.png', fullPage: true });

// --- CodePeek with syntax highlighting ---
await page.dblclick('.ProseMirror .node-component');
await sleep(800);
await page.screenshot({ path: 'scripts/shots/06-codepeek.png' });
// close peek
await page.evaluate(() => { const x = Array.from(document.querySelectorAll('div')).find(d => d.textContent.trim() === '✕' && getComputedStyle(d).cursor === 'pointer'); if (x) x.click(); });
await sleep(300);

// --- AI dialog ---
await page.click("button:has-text('Insert')");
await sleep(250);
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('div, button, span')).find(el => /^AI component…$/.test((el.textContent||'').trim())); if (c) c.click(); });
await sleep(700);
await page.screenshot({ path: 'scripts/shots/07-ai-dialog.png' });

// --- AI dialog WITH a configured provider (prompt UI) ---
await page.evaluate(() => { window.MOCK_AI_PROVIDER = 'openai'; });
await sleep(200);
// reopen
await page.keyboard.press('Escape');
await sleep(300);
await page.click("button:has-text('Insert')");
await sleep(250);
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('div, button, span')).find(el => /^AI component…$/.test((el.textContent||'').trim())); if (c) c.click(); });
await sleep(800);
await page.screenshot({ path: 'scripts/shots/08-ai-prompt.png' });

console.log('gallery done');
await browser.close();
