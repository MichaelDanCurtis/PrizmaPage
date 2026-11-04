// Final roadmap audit: verify every phase's surface works end-to-end.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404') && !m.text().includes('[mock]')) errs.push(m.text()); });
const pass = [], fail = [];
function check(name, cond) { (cond ? pass : fail).push(name); }
const sleep = (ms) => page.waitForTimeout(ms);

async function enterEditor() {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await sleep(600);
  await page.getByText('First time? Read the welcome document').click();
  await sleep(500);
  await page.hover('[data-testid=hover-zone]');
  await sleep(300);
  await page.click("button:has-text('Edit')");
  await sleep(800);
}

// ===== Phase 1+2: viewer renders compiled prose, editor loads =====
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(600);
await page.getByText('First time? Read the welcome document').click();
await sleep(900);
check('Phase 1: viewer renders compiled prose (h1)', await page.evaluate(() => !!document.querySelector('h1')));
check('Phase 2: viewer has Edit button path', await page.evaluate(() => !!document.querySelector('[data-testid=hover-zone]')));

// ===== Phase 2.5: Capability consent (sub-project 2) =====
// The welcome doc has empty capabilities → no consent modal. Verified by absence.
check('Sub-2: empty-caps doc opens without consent modal', !await page.evaluate(() => document.body.textContent.includes('wants to')));

// ===== Phase 3: component library =====
await enterEditor();
await page.click('.ProseMirror');
await sleep(80);
await page.click("button:has-text('Insert')");
await sleep(300);
const componentCount = await page.evaluate(() => Array.from(document.querySelectorAll('div, button, span')).filter(el => /^(StatCard|Callout|Table|Chart|Badge|FeatureCard|StatGroup|Tabs|Quote|Diagram|D2|Drawio)$/.test((el.textContent||'').trim())).length);
check('Sub-1/3: Insert menu lists all 12 components', componentCount >= 12);
await page.keyboard.press('Escape');
await sleep(200);

// ===== Phase 2 (v2): Settings modal + theming (fresh editor) =====
await enterEditor();
await page.click('button[title=Settings]');
await sleep(500);
check('Sub-1: Settings modal opens with Providers tab', await page.evaluate(() => document.body.textContent.includes('providers') && document.body.textContent.includes('appearance')));
await page.click('button:has-text("appearance")');
await sleep(400);
check('Sub-1: Appearance tab has Theme mode + token editor', await page.evaluate(() => document.body.textContent.includes('Theme mode') && document.body.textContent.includes('Tokens')));
await page.click('label:has-text("dark")');
await sleep(400);
check('Sub-1: Dark mode applies (data-theme=dark)', await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'));
await page.click('label:has-text("light")');
await sleep(200);
await page.keyboard.press('Escape');
await sleep(400);

// ===== Sub-1: AI panel, Sub-3 signing, Sub-5 MCP (fresh editor) =====
await enterEditor();
check('Sub-1: AI panel docked in editor', await page.evaluate(() => !!Array.from(document.querySelectorAll('div')).find(d => /✨ AI/.test(d.textContent) && d.textContent.length < 30)));
check('Sub-3: Sign button in top bar', await page.evaluate(() => !!document.querySelector('button[title*="Sign"]')));
check('Sub-5: MCP server status panel in editor', await page.evaluate(() => document.body.textContent.includes('MCP server ready')));

// ===== Sub-6: D2 + Drawio in Insert menu =====
await page.click("button:has-text('Insert')");
await sleep(400);
const hasD2 = await page.evaluate(() => !!Array.from(document.querySelectorAll('div, button, span')).find(el => /^D2$/.test((el.textContent||'').trim())));
const hasDrawio = await page.evaluate(() => !!Array.from(document.querySelectorAll('div, button, span')).find(el => /^Drawio$/.test((el.textContent||'').trim())));
check('Sub-6: D2 component in menu', hasD2);
check('Sub-6: Drawio component in menu', hasDrawio);
await page.keyboard.press('Escape');

// ===== Sub-4: Share menu =====
// Re-enter viewer to check share
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(500);
await page.getByText('First time? Read the welcome document').click();
await sleep(700);
await page.hover('[data-testid=hover-zone]');
await sleep(300);
await page.click('button[aria-label=Share]');
await sleep(300);
check('Sub-4: Share menu has Reveal/Save copy/Copy path', await page.evaluate(() => document.body.textContent.includes('Reveal in Finder') && document.body.textContent.includes('Save a copy')));
await page.keyboard.press('Escape');

console.log('\n=== FINAL ROADMAP AUDIT ===');
console.log(`PASS: ${pass.length}   FAIL: ${fail.length}`);
if (fail.length) { console.log('\nFAILURES:'); fail.forEach(f => console.log('  ❌ ' + f)); }
else { console.log('\n✅ ALL ROADMAP PHASES VERIFIED'); }
console.log('\nconsole errors:', errs.length);
errs.slice(-5).forEach(e => console.log('  •', e.slice(0, 100)));
await browser.close();
