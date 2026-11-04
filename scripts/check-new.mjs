import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const invoked = [];
page.on('console', m => { if (typeof m.text() === 'string' && m.text().startsWith('[mock] invoke:')) invoked.push(m.text().replace('[mock] invoke: ', '').split(',')[0]); });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// Empty state shows the New button
const hasNew = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /new/i.test(b.textContent)));
console.log('1. New button present in empty state:', hasNew);

// Click New
await page.click('button:has-text("New")');
await page.waitForTimeout(1500);

// Should now be in the editor (not the viewer)
const inEditor = await page.evaluate(() => !!document.querySelector('.ProseMirror'));
const hasToolbar = await page.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /save/i.test(b.textContent)));
console.log('2. After New: editor surface present:', inEditor);
console.log('3. After New: save button present:', hasToolbar);

// Check the invoke sequence
console.log('4. Invoke sequence:', invoked.join(' → '));
console.log('   - new_document called:', invoked.includes('new_document'));
console.log('   - add_recent_document called:', invoked.includes('add_recent_document'));

console.log('errors:', errs.slice(-3));
await page.screenshot({ path: 'scripts/shots/09-new-doc.png' });
await browser.close();
