// Comprehensive audit: walk every user-facing surface, log what's actually
// broken (errors, missing pieces, dead controls). Not assertions — findings.
import { chromium } from 'playwright-core';

const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
const warnings = [];
p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
p.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('404') && !t.includes('[mock]') && !t.includes('favicon')) errs.push('CONSOLE: ' + t);
  if (m.type() === 'warning' && !t.includes('[mock]')) warnings.push('WARN: ' + t);
});

const findings = [];
const check = (label, cond, detail = '') => {
  const status = cond ? 'OK' : 'FAIL';
  findings.push(`[${status}] ${label}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => p.waitForTimeout(ms);

// ===== EMPTY STATE (no vault) =====
await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(800);
check('Empty state renders', await p.evaluate(() => document.body.textContent.includes('PrizmaPage')));
check('Empty state has New button', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /New/.test(b.textContent))));
check('Empty state has Open button', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Open/.test(b.textContent))));
check('Empty state has Settings link', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Settings/.test(b.textContent))));
check('Empty state has Choose vault button', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Choose a vault/.test(b.textContent))));

// ===== SETTINGS: PROVIDERS =====
await p.click('button:has-text("Settings")');
await sleep(600);
check('Settings modal opens', await p.evaluate(() => document.body.textContent.includes('providers') && document.body.textContent.includes('appearance')));

const providers = ['openai','openrouter','ollama','glm','kimi','copilot','codex','claude'];
for (const prov of providers) {
  const present = await p.evaluate((name) => document.body.textContent.includes(name), prov);
  check(`Provider "${prov}" shown`, present);
}

// OAuth buttons clickable
const ghDisabled = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Sign in with GitHub/.test(x.textContent)); return b ? b.disabled : 'missing'; });
check('Copilot GitHub button enabled', ghDisabled === false, `disabled=${ghDisabled}`);
const codexDisabled = await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /Sign in with Codex/.test(x.textContent)); return b ? b.disabled : 'missing'; });
check('Codex button enabled', codexDisabled === false, `disabled=${codexDisabled}`);

// ollama shows local message, not a key field
check('Ollama shows local/no-key message', await p.evaluate(() => document.body.textContent.includes('localhost:11434')));

// ===== SETTINGS: APPEARANCE =====
await p.click('button:has-text("appearance")');
await sleep(400);
check('Appearance tab shows Theme mode', await p.evaluate(() => document.body.textContent.includes('Theme mode')));
check('Appearance has Light/Dark/System radios', await p.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent.trim().toLowerCase());
  return labels.includes('light') && labels.includes('dark') && labels.includes('system');
}));
check('Appearance has token editor', await p.evaluate(() => document.body.textContent.includes('Tokens')));
// Switch to dark
await p.evaluate(() => { const l = Array.from(document.querySelectorAll('label')).find(x => /dark/i.test(x.textContent)); if (l) l.click(); });
await sleep(300);
check('Dark mode applies', await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark'));
await p.evaluate(() => { const l = Array.from(document.querySelectorAll('label')).find(x => /light/i.test(x.textContent)); if (l) l.click(); });
await sleep(200);
// Close settings
await p.keyboard.press('Escape');
await sleep(400);

// ===== VAULT DASHBOARD =====
await p.evaluate(() => localStorage.setItem('prizma.vault.path', '/mock/vault'));
await p.reload();
await sleep(1000);
check('Vault dashboard shows', await p.evaluate(() => document.body.textContent.includes('New note') && document.body.textContent.includes('Browse vault')));
check('Dashboard note count', await p.evaluate(() => /\d+ notes?/.test(document.body.textContent)));
check('Dashboard has Today (daily note)', await p.evaluate(() => document.body.textContent.includes('Today')));
check('Dashboard has Workflows button', await p.evaluate(() => document.body.textContent.includes('Workflows')));

// ===== OPEN A NOTE → VIEWER =====
await p.getByText('Architecture').first().click();
await sleep(900);
check('Viewer renders compiled prose (h1)', await p.evaluate(() => !!document.querySelector('h1')));
check('Viewer has hover zone', await p.evaluate(() => !!document.querySelector('[data-testid=hover-zone]')));

// ===== VIEWER: SHARE MENU =====
await p.hover('[data-testid=hover-zone]');
await sleep(300);
await p.click('button[aria-label=Share]');
await sleep(300);
check('Share menu has Reveal in Finder', await p.evaluate(() => document.body.textContent.includes('Reveal in Finder')));
check('Share menu has File in vault', await p.evaluate(() => document.body.textContent.includes('File in vault')));
check('Share menu has Save a copy', await p.evaluate(() => document.body.textContent.includes('Save a copy')));
await p.keyboard.press('Escape');
await sleep(300);

// ===== EDITOR (three-pane) =====
await p.hover('[data-testid=hover-zone]');
await sleep(300);
await p.click("button:has-text('Edit')");
await sleep(1200);
check('Editor loads doc', await p.evaluate(() => !!document.querySelector('.ProseMirror')));
check('Editor toolbar present', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Save/.test(b.textContent))));
check('File tree pane present', await p.evaluate(() => document.body.textContent.includes('Architecture') || document.body.textContent.includes('Roadmap')));
check('Nav pane Outline tab', await p.evaluate(() => document.body.textContent.includes('Outline')));
check('Nav pane Backlinks tab', await p.evaluate(() => document.body.textContent.includes('Backlinks')));
check('Nav pane Graph tab', await p.evaluate(() => document.body.textContent.includes('Graph')));
check('AI panel present', await p.evaluate(() => !!Array.from(document.querySelectorAll('span')).find(s => /AI/.test(s.textContent) && s.textContent.length < 10)));
check('MCP server status present', await p.evaluate(() => document.body.textContent.includes('MCP server')));

// ===== TOC: click a heading in outline =====
// (outline shows live headings if the doc has them)
const outlineHasItems = await p.evaluate(() => {
  // The outline tab is default; check it has clickable items
  return document.querySelectorAll('[style*="cursor: pointer"]').length > 5;
});
check('Outline has navigable items', outlineHasItems);

// ===== GRAPH tab =====
await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim()==='Graph'); if (b) b.click(); });
await sleep(2000); // graph reads notes + simulates
check('Graph renders SVG nodes', await p.evaluate(() => !!document.querySelector('svg circle')));

// ===== Backlinks tab =====
await p.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim()==='Backlinks'); if (b) b.click(); });
await sleep(1500);
check('Backlinks panel renders (even if empty)', await p.evaluate(() => document.body.textContent.includes('backlink') || document.body.textContent.includes('Backlink') || document.body.textContent.includes('Scanning') || document.body.textContent.includes('No backlink')));

// ===== Cmd+K palette =====
await p.keyboard.press('Meta+k');
await sleep(500);
check('Cmd+K palette opens', await p.evaluate(() => {
  const t = document.body.textContent;
  return t.includes('Summarize') || t.includes('Document actions') || t.includes('Ask AI');
}));
await p.keyboard.press('Escape');
await sleep(300);

// ===== Cmd+Shift+F search =====
await p.keyboard.press('Meta+Shift+f');
await sleep(500);
check('Search modal opens', await p.evaluate(() => !!document.querySelector('input[placeholder*="Search vault"]')));
await p.keyboard.press('Escape');
await sleep(300);

// ===== Workflow canvas =====
await p.evaluate(() => open.closeEditor?.()); // noop in editor
await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await sleep(600);
await p.evaluate(() => localStorage.setItem('prizma.vault.path', '/mock/vault'));
await p.reload();
await sleep(800);
await p.click('button:has-text("Workflows")');
await sleep(700);
check('Workflow canvas opens', await p.evaluate(() => document.body.textContent.includes('Workflow canvas')));
check('Workflow palette has Trigger', await p.evaluate(() => document.body.textContent.includes('Trigger')));
check('Workflow palette has AI step', await p.evaluate(() => document.body.textContent.includes('AI step')));
check('Workflow Run button present', await p.evaluate(() => !!Array.from(document.querySelectorAll('button')).find(b => /Run/.test(b.textContent))));

console.log('\n=========================');
console.log('  FULL APP AUDIT RESULTS');
console.log('=========================\n');
const passes = findings.filter(f => f.startsWith('[OK]'));
const fails = findings.filter(f => f.startsWith('[FAIL]'));
console.log(`PASS: ${passes.length}   FAIL: ${fails.length}\n`);
if (fails.length) {
  console.log('--- FAILURES ---');
  fails.forEach(f => console.log(f));
  console.log('');
}
console.log('--- Console Errors ---');
errs.slice(-15).forEach(e => console.log('  •', e.slice(0,140)));
console.log(`\n(${errs.length} total errors, ${warnings.length} warnings)`);
await b.close();
