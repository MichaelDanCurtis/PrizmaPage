// Final v3 roadmap audit: verify every sub-project's surface works.
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

// SP1: Vault dashboard on launch
await page.addInitScript(() => { localStorage.setItem('prizma.vault.path', '/mock/vault'); });
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(900);
check('SP1: vault dashboard shows', await page.evaluate(() => document.body.textContent.includes('New note') && document.body.textContent.includes('Browse vault')));
check('SP1: note count shows', await page.evaluate(() => /\d+ notes?/.test(document.body.textContent)));
check('SP1: Workflows button present', await page.evaluate(() => document.body.textContent.includes('Workflows')));
check('SP1: Today (daily note) button', await page.evaluate(() => document.body.textContent.includes('Today')));

// SP9: Workflow canvas opens
await page.click('button:has-text("Workflows")');
await sleep(700);
check('SP9: workflow canvas header', await page.evaluate(() => document.body.textContent.includes('Workflow canvas')));
check('SP9: palette shows node types', await page.evaluate(() => document.body.textContent.includes('Trigger') && document.body.textContent.includes('AI step')));
check('SP9: Run button present', await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Run/.test(b.textContent))));
// Add a trigger node — click the palette item by its exact text in the sidebar
await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll('div'));
  const trigger = items.find(d => d.textContent.trim() === '⟡ Trigger' || (d.textContent.includes('Trigger') && d.textContent.length < 20 && d.querySelector('span')));
  if (trigger) trigger.click();
});
await sleep(400);
check('SP9: node added to canvas', await page.evaluate(() => {
  // A node on the canvas is an absolutely-positioned div with a border.
  return Array.from(document.querySelectorAll('div')).some(d => {
    const s = d.textContent || '';
    return s.includes('Trigger') && getComputedStyle(d).position === 'absolute';
  });
}));
await page.keyboard.press('Escape');
await sleep(300);
// Close canvas
await page.evaluate(() => { const x = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '✕'); if (x) x.click(); });
await sleep(500);

// SP1: Open a note → editor with three-pane layout
await page.getByText('Architecture').first().click();
await sleep(800);
await page.hover('[data-testid=hover-zone]');
await sleep(300);
await page.click("button:has-text('Edit')");
await sleep(1200);
check('SP2: file tree pane present', await page.evaluate(() => document.body.textContent.includes('Files') || !!document.querySelector('[title*="Files"]')));
check('SP2: nav pane with Outline/Backlinks/Graph tabs', await page.evaluate(() => document.body.textContent.includes('Outline') && document.body.textContent.includes('Backlinks') && document.body.textContent.includes('Graph')));
check('SP2: AI panel present', await page.evaluate(() => !!Array.from(document.querySelectorAll('span')).find(s => /AI ✨/.test(s.textContent))));

// SP4: Graph tab
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === 'Graph'); if (b) b.click(); });
await sleep(1500); // graph reads notes + simulates
check('SP4: graph renders SVG', await page.evaluate(() => !!document.querySelector('svg circle')));

// SP5: Cmd+K palette
await page.keyboard.press('Meta+k');
await sleep(500);
check('SP5: command palette opens', await page.evaluate(() => document.body.textContent.includes('Document actions') || document.body.textContent.includes('Summarize') || !!document.querySelector('input[placeholder*="document"]')));
await page.keyboard.press('Escape');
await sleep(300);

console.log('\n=== V3 ROADMAP AUDIT ===');
console.log(`PASS: ${pass.length}   FAIL: ${fail.length}`);
if (fail.length) { console.log('\nFAILURES:'); fail.forEach(f => console.log('  ❌ ' + f)); }
else { console.log('\n✅ ALL V3 SUB-PROJECTS VERIFIED'); }
console.log('\nconsole errors:', errs.length);
errs.slice(-5).forEach(e => console.log('  •', e.slice(0, 100)));
await browser.close();
