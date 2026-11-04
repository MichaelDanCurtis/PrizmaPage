// Headless screenshot helper for browser-only visual dev.
// Usage: node scripts/shot.mjs [name] [url]
// Env vars:
//   SHOT_CLICK=sel1,sel2     CSS selectors to click in order
//   SHOT_TEXT=a|b|c          visible-text labels to click in order (split by |)
//   SHOT_HOVER=sel           CSS selector to hover (pointer enter) before clicks
//   SHOT_WAIT_MS=n           settle delay (default 600)
//   SHOT_TYPE=sel:text       focus selector and type text
//   SHOT_KEY=key             press a keyboard key after clicks (e.g. "Slash")
//   SHOT_FULL=0              set to 0 for viewport-only (not fullPage)
import { chromium } from 'playwright-core';

const name = process.argv[2] || 'snapshot';
const url = process.argv[3] || 'http://localhost:5173';
const clicks = (process.env.SHOT_CLICK || '').split(',').map(s => s.trim()).filter(Boolean);
const texts = (process.env.SHOT_TEXT || '').split('|').map(s => s.trim()).filter(Boolean);
const hover = process.env.SHOT_HOVER || '';
const waits = process.env.SHOT_WAIT_MS || '600';
const typeSel = (process.env.SHOT_TYPE || '').split(':').slice(0,-1).join(':');
const typeText = (process.env.SHOT_TYPE || '').split(':').slice(-1)[0];
const key = process.env.SHOT_KEY || '';
const full = process.env.SHOT_FULL === '0' ? false : true;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waits));

// Order: text clicks (navigate/open), then hover, then css clicks, then type/key
for (const label of texts) {
  try { await page.getByText(label, { exact: false }).first().click({ timeout: 2000 }); } catch (e) { console.log('text-click fail', label, e.message); }
  await page.waitForTimeout(500);
}
if (hover) {
  try { await page.hover(hover, { timeout: 2000 }); await page.waitForTimeout(300); }
  catch (e) { console.log('hover fail', hover, e.message); }
}
for (const sel of clicks) {
  try { await page.click(sel, { timeout: 2000 }); } catch (e) { console.log('click fail', sel, e.message); }
  await page.waitForTimeout(300);
}
if (typeSel && typeText) {
  try { await page.click(typeSel, { timeout: 2000 }); await page.type(typeSel, typeText, { delay: 20 }); }
  catch (e) { console.log('type fail', typeSel, e.message); }
  await page.waitForTimeout(300);
}
if (key) {
  try { await page.keyboard.press(key); } catch (e) { console.log('key fail', key, e.message); }
  await page.waitForTimeout(400);
}

const out = `scripts/shots/${name}.png`;
await page.screenshot({ path: out, fullPage: full });
console.log('SHOT', out);

// DOM ground-truth for debugging
const dom = await page.evaluate(() => document.getElementById('root').innerHTML);
console.log('--- DOM (first 5000 chars) ---');
console.log(dom.slice(0, 5000));
const vis = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#root *').forEach(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && s.visibility !== 'hidden') {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0,40) : '';
      out.push(`${tag}.${cls} ${Math.round(r.width)}x${Math.round(r.height)} bg=${s.backgroundColor} color=${s.color} font=${s.fontSize}`);
    }
  });
  return out.slice(0, 80);
});
console.log('--- VISIBLE ELS (first 80) ---');
vis.forEach(v => console.log(v));
if (consoleErrors.length) { console.log('--- console errors ---'); consoleErrors.forEach(e => console.log(' •', e)); }
await browser.close();
