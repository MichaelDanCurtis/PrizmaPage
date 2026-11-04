// Master end-to-end verification across all layers.
// Each section is isolated: we re-enter the editor fresh so state from one
// test can't break the next. Failures are reported, not fatal.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

const pass = [], fail = [];
function check(name, cond) { (cond ? pass : fail).push(name); }
const sleep = (ms) => page.waitForTimeout(ms);

/// Enter the editor from a fresh page load. Returns once the WYSIWYG is ready.
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

/// Insert one component by name and report whether it rendered.
async function tryInsert(name) {
  try {
    await page.click('.ProseMirror', { timeout: 2000 });
    await sleep(60);
    await page.keyboard.press('End');
    await sleep(60);
    await page.click("button:has-text('Insert')", { timeout: 2000 });
    await sleep(250);
    const clicked = await page.evaluate((n) => {
      const c = Array.from(document.querySelectorAll('div, button, span')).find(el => new RegExp('^' + n + '$').test((el.textContent||'').trim()));
      if (c) { c.click(); return true; } return false;
    }, name);
    await sleep(name === 'Diagram' ? 2600 : 600);
    return clicked && await page.evaluate(() => !!document.querySelector('.ProseMirror .node-component'));
  } catch (e) {
    console.log('  insert error for', name, ':', e.message.slice(0, 60));
    return false;
  }
}

// ===== LAYER 1: viewer =====
await enterEditor();
check('Empty→viewer→editor flow works', await page.evaluate(() => !!document.querySelector('.ProseMirror')));
check('Editor loaded document content (>0 blocks)',
  await page.evaluate(() => document.querySelectorAll('.ProseMirror > *').length > 0));

// Re-load to check the viewer (compiled prose) specifically.
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(600);
await page.getByText('First time? Read the welcome document').click();
await sleep(900);
check('Viewer renders compiled prose (h1 present)', await page.evaluate(() => !!document.querySelector('h1')));
check('Viewer shows trust footer', await page.evaluate(() => /prizmapage\.app/.test(document.body.textContent)));

// ===== LAYER 2a: slash menu + save =====
await enterEditor();
await page.click('.ProseMirror');
await sleep(100);
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await sleep(100);
await page.keyboard.press('/');
await sleep(400);
check('Slash menu opens on /', await page.evaluate(() => {
  const t = document.body.textContent;
  return t.includes('Heading') || t.includes('Callout') || t.includes('Diagram');
}));
await page.keyboard.press('Escape');
await sleep(200);
await page.keyboard.press('Backspace');

// ===== LAYER 2b: all components insert =====
for (const name of ['StatCard','Callout','Table','Chart','Badge','FeatureCard','Tabs','Quote','Diagram']) {
  // Fresh editor each iteration to avoid state accumulation.
  await enterEditor();
  check(`Insert ${name} renders a component node`, await tryInsert(name));
}

// ===== LAYER 2b: CodePeek syntax highlighting =====
await enterEditor();
await tryInsert('StatCard');
await sleep(300);
await page.dblclick('.ProseMirror .node-component', { timeout: 2000 });
await sleep(700);
check('CodePeek opens with syntax-highlighted tokens',
  await page.evaluate(() => document.querySelectorAll('.token').length > 0));

// ===== LAYER 4: Diagram renders SVG =====
await enterEditor();
await tryInsert('Diagram');
check('Diagram renders an SVG',
  await page.evaluate(() => !!document.querySelector('.ProseMirror .node-component svg')));

// ===== LAYER 7: polish =====
await enterEditor();
check('Spellcheck enabled on editor',
  await page.evaluate(() => document.querySelector('.ProseMirror')?.getAttribute('spellcheck') === 'true'));

// ===== LAYER 3: AI dialog =====
await enterEditor();
await page.click("button:has-text('Insert')");
await sleep(250);
await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll('div, button, span')).find(el => /^AI component…$/.test((el.textContent||'').trim()));
  if (c) c.click();
});
await sleep(600);
check('AI dialog opens', await page.evaluate(() => document.body.textContent.includes('Generate a component')));
check('AI dialog shows provider status',
  await page.evaluate(() => document.body.textContent.includes('No AI provider') || document.body.textContent.includes('configured')));

console.log('\n=== MASTER VERIFICATION SUMMARY ===');
console.log(`PASS: ${pass.length}   FAIL: ${fail.length}`);
if (fail.length) { console.log('\nFAILURES:'); fail.forEach(f => console.log('  ❌ ' + f)); }
else { console.log('\n✅ ALL CHECKS PASSED'); }
console.log('\nconsole errors:', errs.filter(e => !e.includes('[mock]')).length);
errs.filter(e => !e.includes('[mock]')).slice(-5).forEach(e => console.log('  •', e.slice(0, 100)));
await browser.close();
