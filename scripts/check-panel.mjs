import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR:' + e.message));
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });

// Set provider flag before the app queries hasApiKey. The mock reads
// window.MOCK_AI_PROVIDER at invoke time, so set it via init script.
await p.addInitScript(() => { window.MOCK_AI_PROVIDER = 'openai'; });

await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.getByText('First time? Read the welcome document').click();
await p.waitForTimeout(600);
await p.hover('[data-testid=hover-zone]');
await p.waitForTimeout(300);
await p.click("button:has-text('Edit')");
await p.waitForTimeout(1500);

const panel = await p.evaluate(() => {
  const els = Array.from(document.querySelectorAll('div'));
  const aiShell = els.find(d => /✨ AI/.test(d.textContent) && d.textContent.length < 30);
  const modeText = document.body.textContent;
  return {
    panelPresent: !!aiShell,
    documentMode: modeText.includes('Document mode'),
    hasPrompt: !!document.querySelector('textarea[placeholder*=Describe]') || !!document.querySelector('textarea[placeholder*=describe i]'),
  };
});
console.log('AI PANEL:', JSON.stringify(panel, null, 2));

// Generate a doc
if (panel.hasPrompt) {
  await p.fill('textarea', 'a doc about cats');
  await p.waitForTimeout(200);
  // The send button is the ↑ button at the bottom of the panel
  await p.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const send = btns.find(b => b.textContent.trim() === '↑');
    if (send) send.click();
  });
  await p.waitForTimeout(1000);
  const generated = await p.evaluate(() => document.body.textContent.includes('Replace'));
  console.log('Generated + shows Replace option:', generated);
  // Apply Replace
  if (generated) {
    await p.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const replace = btns.find(b => b.textContent.trim() === 'Replace');
      if (replace) replace.click();
    });
    await p.waitForTimeout(500);
    const calloutPresent = await p.evaluate(() => !!document.querySelector('.ProseMirror .node-component'));
    console.log('After Replace: generated Callout present:', calloutPresent);
  }
}

console.log('errors:', errs.slice(-3));
await b.close();
