import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(600);
// Pre-set the provider flag BEFORE entering editor
await page.evaluate(() => { window.MOCK_AI_PROVIDER = 'openai'; });
await sleep(100);
await page.getByText('First time? Read the welcome document').click();
await sleep(500);
await page.hover('[data-testid=hover-zone]');
await sleep(300);
await page.click("button:has-text('Edit')");
await sleep(800);
await page.click("button:has-text('Insert')");
await sleep(300);
await page.evaluate(() => { const c = Array.from(document.querySelectorAll('div, button, span')).find(el => /^AI component…$/.test((el.textContent||'').trim())); if (c) c.click(); });
await sleep(700);
await page.fill('textarea', 'a friendly info callout about backups');
await sleep(200);
await page.click('button:has-text("Generate")');
await sleep(1000);
await page.screenshot({ path: 'scripts/shots/08-ai-result.png' });
console.log('done');
await browser.close();
