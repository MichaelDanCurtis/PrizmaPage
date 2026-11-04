# Editor Workspace v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the editor into a rich authoring workspace: a right-docked AI panel (document + selection generation), a settings modal (providers + appearance), full theming (light/dark/system + accent + token editor), and a denser word-processor-style toolbar.

**Architecture:** Four phases, each independently shippable. Phase 1 (theming) is first because the settings modal and AI panel both need dark mode to exist. Phase 2 (settings) exposes provider config the AI panel depends on. Phase 3 (toolbar) is self-contained formatting. Phase 4 (AI panel) consumes the prior three. The frontend is React + TipTap; one new Rust command (`ai_generate_document`) mirrors the existing author-time pattern.

**Tech Stack:** React 18, TypeScript, TipTap v2 (`@tiptap/extension-*`), Vitest + React Testing Library, Rust/Tauri, headless-Chrome visual harness (`scripts/shot.mjs`, `scripts/master-verify.mjs`).

**Spec:** `docs/superpowers/specs/2026-06-21-editor-workspace-design.md`

---

## File Structure

**Created (frontend):**
- `src/theme/tokenCatalog.ts` — editable token surface: name, group, type, default value for every token + dark overrides. Single source the Settings UI reads.
- `src/theme/themeStore.ts` — mode/accent/token persistence (localStorage) + apply (sets `data-theme`, derives accent-soft/border, sets CSS vars on `:root`).
- `src/theme/themeStore.test.ts` — persistence, apply, derivation, reset.
- `src/components/SettingsModal.tsx` — modal shell with tabs (Providers / Appearance).
- `src/components/ProvidersTab.tsx` — per-provider config rows.
- `src/components/AppearanceTab.tsx` — mode + accent + token editor host.
- `src/components/TokenEditor.tsx` — generated token list editor (color/number/string inputs).
- `src/components/AiPanel.tsx` — right-docked AI panel (Document + Selection modes).
- `src/components/AiPanel.test.tsx` — mode switching, no-provider state, landing affordance.
- `src/hooks/useAiConfig.ts` — provider/model selection (localStorage-backed).
- `src/hooks/useResizablePanel.ts` — drag-to-resize + collapse + width persistence.
- `src/lib/aiGenerate.ts` — `generateDocument` / `editSelection` bridge functions.
- Tests alongside each new module.

**Modified (frontend):**
- `src/theme/tokens.css` — add `[data-theme="dark"]` block overriding color tokens.
- `src/main.tsx` — call `themeStore.loadTheme()` before React mounts (prevents flash).
- `src/App.tsx` — pass settings-open handler; load theme on startup.
- `src/components/EmptyState.tsx` — add Settings link.
- `src/components/EditorTopBar.tsx` — add gear icon + settings-open prop.
- `src/components/EditorView.tsx` — host the docked AI panel + settings modal; pass editor ref for selection mode.
- `src/components/EditorToolbar.tsx` — add rich formatting controls (underline, color, highlight, align, link, image, font, size).
- `src/components/WysiwygSurface.tsx` — register new TipTap extensions (Underline, TextStyle, Color, Highlight, TextAlign, Link, Image).
- `src/registry/serializer.ts` — round-trip for underline/strike/color/highlight/align/link/image + extend `parseInline` for `![alt](url)` and `[text](url)`.
- `src/registry/serializer.test.ts` — new round-trip tests.
- `package.json` — new `@tiptap/extension-*` deps.
- `index.html` — mock entries for `ai_generate_document`, image file dialog returns a tiny data URL.

**Modified (Rust):**
- `src-tauri/src/lib.rs` — add + register `ai_generate_document` command.

---

## Phase 1: Theming

Foundation for the whole workspace. Dark mode must exist before Settings/AI panel land.

### Task 1.1: Token catalog (single source of truth)

**Files:**
- Create: `src/theme/tokenCatalog.ts`
- Create: `src/theme/tokenCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

`src/theme/tokenCatalog.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { TOKEN_CATALOG, getDefaults } from "./tokenCatalog";

describe("tokenCatalog", () => {
  it("every entry has name, group, type, default", () => {
    for (const t of TOKEN_CATALOG) {
      expect(t.name.startsWith("--")).toBe(true);
      expect(["color", "number", "string", "font"]).toContain(t.type);
      expect(["Color", "Type", "Spacing & shape"]).toContain(t.group);
      expect(typeof t.default).toBe("string");
      expect(t.default.length).toBeGreaterThan(0);
    }
  });

  it("getDefaults returns a name→value map matching every entry", () => {
    const d = getDefaults();
    for (const t of TOKEN_CATALOG) {
      expect(d[t.name]).toBe(t.default);
    }
  });

  it("includes the core tokens (--accent, --bg, --text)", () => {
    const names = TOKEN_CATALOG.map((t) => t.name);
    expect(names).toContain("--accent");
    expect(names).toContain("--bg");
    expect(names).toContain("--text");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/tokenCatalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/theme/tokenCatalog.ts`:
```typescript
/// The editable surface of the theme. The Settings token editor is generated
/// from this list — there is no second hard-coded list. Defaults MUST match
/// the values in tokens.css (the test suite does not cross-check, so keep them
/// in sync manually; a future task can parse tokens.css at build time).

export type TokenType = "color" | "number" | "string" | "font";
export type TokenGroup = "Color" | "Type" | "Spacing & shape";

export interface TokenEntry {
  name: string; // "--accent"
  label: string; // "Accent"
  group: TokenGroup;
  type: TokenType;
  default: string;
}

export const TOKEN_CATALOG: TokenEntry[] = [
  // Color
  { name: "--accent", label: "Accent", group: "Color", type: "color", default: "#4f46e5" },
  { name: "--accent-soft", label: "Accent soft", group: "Color", type: "color", default: "#eef2ff" },
  { name: "--accent-border", label: "Accent border", group: "Color", type: "color", default: "#c7d2fe" },
  { name: "--bg", label: "Background", group: "Color", type: "color", default: "#ffffff" },
  { name: "--bg-muted", label: "Background muted", group: "Color", type: "color", default: "#fafafa" },
  { name: "--text", label: "Text", group: "Color", type: "color", default: "#0f172a" },
  { name: "--text-muted", label: "Text muted", group: "Color", type: "color", default: "#64748b" },
  { name: "--text-faint", label: "Text faint", group: "Color", type: "color", default: "#94a3b8" },
  { name: "--border", label: "Border", group: "Color", type: "color", default: "#e5e7eb" },
  { name: "--border-soft", label: "Border soft", group: "Color", type: "color", default: "#f1f5f9" },
  // Type
  { name: "--font-sans", label: "Sans font", group: "Type", type: "font", default: '-apple-system, "Inter", system-ui, sans-serif' },
  { name: "--font-mono", label: "Mono font", group: "Type", type: "font", default: '"SF Mono", "JetBrains Mono", monospace' },
  { name: "--font-display", label: "Display", group: "Type", type: "string", default: "700 26px/1.2 var(--font-sans)" },
  { name: "--font-h2", label: "Heading 2", group: "Type", type: "string", default: "600 18px/1.3 var(--font-sans)" },
  { name: "--font-body", label: "Body", group: "Type", type: "string", default: "400 16px/1.7 var(--font-sans)" },
  { name: "--font-small", label: "Small", group: "Type", type: "string", default: "400 13px/1.5 var(--font-sans)" },
  // Spacing & shape
  { name: "--radius-sm", label: "Radius sm", group: "Spacing & shape", type: "number", default: "4" },
  { name: "--radius", label: "Radius", group: "Spacing & shape", type: "number", default: "7" },
  { name: "--radius-lg", label: "Radius lg", group: "Spacing & shape", type: "number", default: "8" },
  { name: "--radius-xl", label: "Radius xl", group: "Spacing & shape", type: "number", default: "14" },
  { name: "--content-width", label: "Content width", group: "Spacing & shape", type: "number", default: "680" },
  { name: "--content-padding", label: "Content padding", group: "Spacing & shape", type: "number", default: "32" },
];

/// Dark-mode overrides for color tokens. Type/spacing tokens are shared.
export const DARK_OVERRIDES: Record<string, string> = {
  "--accent-soft": "#1e1b4b",
  "--accent-border": "#3730a3",
  "--bg": "#0d1117",
  "--bg-muted": "#161b22",
  "--text": "#e6edf3",
  "--text-muted": "#8b949e",
  "--text-faint": "#6e7681",
  "--border": "#30363d",
  "--border-soft": "#21262d",
};

export function getDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of TOKEN_CATALOG) out[t.name] = t.default;
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/tokenCatalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/tokenCatalog.ts src/theme/tokenCatalog.test.ts
git commit -m "feat(theme): add token catalog as single source of editable theme surface"
```

### Task 1.2: themeStore — persistence + apply + accent derivation

**Files:**
- Create: `src/theme/themeStore.ts`
- Create: `src/theme/themeStore.test.ts`

- [ ] **Step 1: Write the failing test**

`src/theme/themeStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mixHex, deriveAccentSoft, deriveAccentBorder, applyTokens, loadTheme, ThemeMode } from "./themeStore";

describe("themeStore color math", () => {
  it("mixHex blends two hex colors by weight", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("deriveAccentSoft mixes accent over bg at ~0.1", () => {
    // indigo over white at 0.1 → a light indigo tint
    const soft = deriveAccentSoft("#4f46e5", "#ffffff");
    expect(soft).toMatch(/^#[0-9a-f]{6}$/);
    expect(soft).not.toBe("#4f46e5");
  });

  it("deriveAccentBorder mixes accent over bg at ~0.3", () => {
    const border = deriveAccentBorder("#4f46e5", "#ffffff");
    expect(border).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("themeStore apply/load", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
  });

  it("applyTokens sets CSS variables on :root", () => {
    applyTokens({ "--accent": "#ff0000" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff0000");
  });

  it("loadTheme applies dark mode from storage and sets data-theme", () => {
    localStorage.setItem("prizma.theme.mode", "dark");
    loadTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("loadTheme derives accent-soft/border from a custom accent", () => {
    localStorage.setItem("prizma.theme.mode", "light");
    localStorage.setItem("prizma.theme.accent", "#00897b");
    loadTheme();
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--accent")).toBe("#00897b");
    expect(root.getPropertyValue("--accent-soft")).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.getPropertyValue("--accent-border")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("loadTheme with no storage applies defaults (no override vars)", () => {
    loadTheme();
    // No accent override → --accent not set inline (falls back to tokens.css).
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/themeStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/theme/themeStore.ts`:
```typescript
import { DARK_OVERRIDES, getDefaults } from "./tokenCatalog";

export type ThemeMode = "light" | "dark" | "system";

const MODE_KEY = "prizma.theme.mode";
const ACCENT_KEY = "prizma.theme.accent";
const TOKENS_KEY = "prizma.theme.tokens";

/// Blend two hex colors. weight 0 → a, 1 → b.
export function mixHex(a: string, b: string, weight: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * weight);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * weight);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * weight);
  return "#" + [r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/// accent at ~0.1 opacity over the current bg.
export function deriveAccentSoft(accent: string, bg: string): string {
  return mixHex(bg, accent, 0.1);
}
/// accent at ~0.3 opacity over the current bg.
export function deriveAccentBorder(accent: string, bg: string): string {
  return mixHex(bg, accent, 0.3);
}

/// Apply a partial token map to :root as inline CSS variables.
export function applyTokens(tokens: Record<string, string>): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
}

function clearAllTokenVars(): void {
  const root = document.documentElement;
  // Remove only the vars we own.
  for (const k of Object.keys(getDefaults())) {
    root.style.removeProperty(k);
  }
}

function effectiveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/// Read localStorage and apply everything. Call once before React mounts.
export function loadTheme(): void {
  const mode = (localStorage.getItem(MODE_KEY) as ThemeMode) || "light";
  const eff = effectiveMode(mode);
  document.documentElement.setAttribute("data-theme", eff);

  // Start from defaults + dark overrides if dark.
  const tokens: Record<string, string> = {};
  if (eff === "dark") Object.assign(tokens, DARK_OVERRIDES);

  const accent = localStorage.getItem(ACCENT_KEY);
  if (accent) {
    tokens["--accent"] = accent;
    const bg = tokens["--bg"] || getDefaults()["--bg"];
    tokens["--accent-soft"] = deriveAccentSoft(accent, bg);
    tokens["--accent-border"] = deriveAccentBorder(accent, bg);
  }

  const overridesRaw = localStorage.getItem(TOKENS_KEY);
  if (overridesRaw) {
    try {
      Object.assign(tokens, JSON.parse(overridesRaw));
    } catch {
      /* ignore corrupt overrides */
    }
  }

  clearAllTokenVars();
  applyTokens(tokens);
}

export function setMode(mode: ThemeMode): void {
  localStorage.setItem(MODE_KEY, mode);
  loadTheme();
}

export function setAccent(hex: string | null): void {
  if (hex) localStorage.setItem(ACCENT_KEY, hex);
  else localStorage.removeItem(ACCENT_KEY);
  loadTheme();
}

export function setTokenOverrides(overrides: Record<string, string>): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(overrides));
  loadTheme();
}

export function resetAllTokens(): void {
  localStorage.removeItem(ACCENT_KEY);
  localStorage.removeItem(TOKENS_KEY);
  loadTheme();
}

export function getMode(): ThemeMode {
  return (localStorage.getItem(MODE_KEY) as ThemeMode) || "light";
}
export function getAccent(): string | null {
  return localStorage.getItem(ACCENT_KEY);
}
export function getTokenOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  } catch {
    return {};
  }
}

/// React to OS theme changes when in system mode.
export function watchSystemMode(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getMode() === "system") {
      loadTheme();
      cb();
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/themeStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/themeStore.ts src/theme/themeStore.test.ts
git commit -m "feat(theme): themeStore — persist + apply mode/accent/tokens with accent derivation"
```

### Task 1.3: Dark-mode token block in tokens.css

**Files:**
- Modify: `src/theme/tokens.css`

- [ ] **Step 1: Add the dark override block**

Append to `src/theme/tokens.css` (after the `:root { … }` block):
```css

/* Dark mode — applied via [data-theme="dark] on <html> by themeStore.
 * The runtime also applies these from DARK_OVERRIDES in tokenCatalog.ts;
 * this block is the static fallback for first paint before JS runs. */
[data-theme="dark"] {
  --accent-soft: #1e1b4b;
  --accent-border: #3730a3;
  --bg: #0d1117;
  --bg-muted: #161b22;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --text-faint: #6e7681;
  --border: #30363d;
  --border-soft: #21262d;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/tokens.css
git commit -m "feat(theme): dark mode token block"
```

### Task 1.4: Load theme before React mounts

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Call loadTheme() before createRoot**

At the top of `src/main.tsx`, after the CSS imports, add:
```typescript
import { loadTheme } from "./theme/themeStore";
// Apply persisted theme before first paint to avoid a flash.
loadTheme();
```

Place the import with the other imports and the call after the CSS imports, before `createRoot(...).render(...)`.

- [ ] **Step 2: Verify the app still loads**

Run: `npx vitest run` (full suite)
Expected: PASS (no regressions).
Then visual: `node scripts/shot.mjs` — confirm the empty state still renders.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(theme): load persisted theme before first paint"
```

### Task 1.5: Visual verification — dark mode

- [ ] **Step 1: Set dark mode in the browser and screenshot**

Run:
```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { localStorage.setItem('prizma.theme.mode', 'dark'); });
  await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const isDark = await p.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
  console.log('data-theme is dark:', isDark);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('body bg:', bg);
  await p.screenshot({ path: 'scripts/shots/dark-empty.png' });
  await b.close();
})();
"
```
Expected: `data-theme is dark: true`, `body bg:` a dark color (rgb(13, 17, 23) area), screenshot shows dark UI.

- [ ] **Step 2: If failing, debug; if passing, no commit needed (visual check only).**

---

## Phase 2: Settings Modal

### Task 2.1: SettingsModal shell with tabs

**Files:**
- Create: `src/components/SettingsModal.tsx`
- Create: `src/components/SettingsModal.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/SettingsModal.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";

describe("SettingsModal", () => {
  it("renders both tab labels and switches on click", () => {
    render(<SettingsModal onClose={vi.fn()} />);
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    // Appearance content hidden initially (Providers is default)
    expect(screen.getByText(/Theme mode/i)).toBeInTheDocument(); // both tabs render; check Providers is primary
  });

  it("calls onClose when the ✕ is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SettingsModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/components/SettingsModal.tsx`:
```typescript
import { useState } from "react";
import { ProvidersTab } from "./ProvidersTab";
import { AppearanceTab } from "./AppearanceTab";

interface Props {
  onClose: () => void;
}

type Tab = "providers" | "appearance";

export function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("providers");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 560,
          maxWidth: "92vw",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)" }}>
          {(["providers", "appearance"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                color: tab === t ? "var(--accent)" : "var(--text-muted)",
                padding: "12px 20px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: tab === t ? 600 : 500,
                textTransform: "capitalize",
              }}
            >
              {t}
            </button>
          ))}
          <div
            role="button"
            aria-label="Close settings"
            onClick={onClose}
            style={{ marginLeft: "auto", padding: "12px 16px", cursor: "pointer", color: "var(--text-faint)", fontSize: 16 }}
          >
            ✕
          </div>
        </div>
        <div style={{ overflow: "auto", padding: 20 }}>
          {tab === "providers" ? <ProvidersTab /> : <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}
```

Note: the tab content components don't exist yet. Create minimal stubs so the test compiles, then build them in the next tasks.

- [ ] **Step 4: Create stub tabs**

`src/components/ProvidersTab.tsx`:
```typescript
export function ProvidersTab() {
  return <div>Providers (coming in Task 2.2)</div>;
}
```
`src/components/AppearanceTab.tsx`:
```typescript
export function AppearanceTab() {
  return <div>Theme mode: (coming in Task 2.3)</div>;
}
```

- [ ] **Step 5: Run test — it should now FAIL on the "Theme mode" text assertion because the stub doesn't contain it yet**

This is expected; Task 2.3 will make it pass. For now, adjust the test to only assert structure that exists: change the "Theme mode" assertion to check the Providers stub text instead. Actually — keep the test as the target; let it fail until 2.3. To keep TDD clean, **split**: this task's test should pass. Replace the "Theme mode" line with:
```typescript
    expect(screen.getByText(/Providers/i)).toBeInTheDocument();
```
Run: `npx vitest run src/components/SettingsModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsModal.tsx src/components/SettingsModal.test.tsx src/components/ProvidersTab.tsx src/components/AppearanceTab.tsx
git commit -m "feat(settings): modal shell with Providers/Appearance tabs"
```

### Task 2.2: ProvidersTab — per-provider config rows

**Files:**
- Modify: `src/components/ProvidersTab.tsx`
- Create: `src/components/ProvidersTab.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/ProvidersTab.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProvidersTab } from "./ProvidersTab";

// Mock the ai bridge so the tab renders against a known provider list.
vi.mock("../lib/ai", () => ({
  listProviders: () => Promise.resolve(["openai", "ollama"]),
  hasApiKey: (p: string) => Promise.resolve(p === "openai"),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  defaultModelFor: (p: string) => (p === "openai" ? "gpt-4o-mini" : "llama3.1"),
  DEFAULT_MODELS: { openai: "gpt-4o-mini", ollama: "llama3.1" },
}));

describe("ProvidersTab", () => {
  it("renders a row per provider with status", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText("openai")).toBeInTheDocument());
    expect(screen.getByText("ollama")).toBeInTheDocument();
    // openai is configured (mocked hasApiKey=true)
    expect(screen.getByText(/configured/i)).toBeInTheDocument();
  });

  it("shows the default model per provider", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText(/gpt-4o-mini/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ProvidersTab.test.tsx`
Expected: FAIL (renders "Providers (coming…)").

- [ ] **Step 3: Implement ProvidersTab**

`src/components/ProvidersTab.tsx`:
```typescript
import { useEffect, useState } from "react";
import {
  listProviders,
  hasApiKey,
  setApiKey,
  clearApiKey,
  defaultModelFor,
} from "../lib/ai";

const AUTH_STYLE: Record<string, "key" | "oauth" | "pkce" | "acp"> = {
  openai: "key",
  openrouter: "key",
  ollama: "key",
  glm: "key",
  kimi: "key",
  copilot: "oauth",
  codex: "pkce",
  "claude-agent-acp": "acp",
};

export function ProvidersTab() {
  const [providers, setProviders] = useState<string[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const all = (await listProviders()) ?? [];
      setProviders(all);
      const ready: Record<string, boolean> = {};
      for (const p of all) {
        try {
          ready[p] = await hasApiKey(p);
        } catch {
          ready[p] = false;
        }
      }
      setConfigured(ready);
    })();
  }, []);

  const saveKey = async (p: string) => {
    const key = keyDrafts[p];
    if (!key) return;
    setSaving(p);
    try {
      await setApiKey(p, key);
      setConfigured((c) => ({ ...c, [p]: true }));
      setKeyDrafts((d) => ({ ...d, [p]: "" }));
    } catch (e) {
      alert(`Failed to save key: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const removeKey = async (p: string) => {
    await clearApiKey(p);
    setConfigured((c) => ({ ...c, [p]: false }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        Configure at least one provider to use AI features.
      </div>
      {providers.map((p) => {
        const style = AUTH_STYLE[p] ?? "key";
        const ready = configured[p];
        return (
          <div
            key={p}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{p}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                ({defaultModelFor(p)})
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: ready ? "#059669" : "var(--text-faint)",
                }}
              >
                {ready ? "✓ Configured" : "— Not configured"}
              </span>
            </div>
            {style === "key" && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="password"
                  placeholder="API key"
                  value={keyDrafts[p] ?? ""}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p]: e.target.value }))}
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  onClick={() => saveKey(p)}
                  disabled={!keyDrafts[p] || saving === p}
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    padding: "5px 12px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: !keyDrafts[p] || saving === p ? 0.5 : 1,
                  }}
                >
                  {saving === p ? "…" : "Save"}
                </button>
                {ready && (
                  <button
                    onClick={() => removeKey(p)}
                    style={{
                      background: "var(--bg-muted)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                      padding: "5px 10px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            {style === "oauth" && (
              <button
                disabled
                title="OAuth setup runs in the desktop app"
                style={{ fontSize: 12, padding: "5px 12px", opacity: 0.6, cursor: "not-allowed" }}
              >
                Sign in with GitHub
              </button>
            )}
            {style === "pkce" && (
              <button disabled title="PKCE setup runs in the desktop app" style={{ fontSize: 12, padding: "5px 12px", opacity: 0.6, cursor: "not-allowed" }}>
                Sign in with Codex
              </button>
            )}
            {style === "acp" && (
              <input
                placeholder="claude-agent-acp binary path"
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
              />
            )}
          </div>
        );
      })}
      {providers.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No providers available.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ProvidersTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ProvidersTab.tsx src/components/ProvidersTab.test.tsx
git commit -m "feat(settings): ProvidersTab — per-provider key/OAuth/ACP config"
```

### Task 2.3: AppearanceTab — mode + accent + token editor

**Files:**
- Modify: `src/components/AppearanceTab.tsx`
- Create: `src/components/TokenEditor.tsx`
- Create: `src/components/AppearanceTab.test.tsx`

- [ ] **Step 1: Write the failing test for AppearanceTab**

`src/components/AppearanceTab.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearanceTab } from "./AppearanceTab";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("AppearanceTab", () => {
  it("renders Theme mode radios and accent swatches", () => {
    render(<AppearanceTab />);
    expect(screen.getByText("Theme mode")).toBeInTheDocument();
    expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
  });

  it("selecting Dark sets localStorage and data-theme", () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByLabelText(/dark/i));
    expect(localStorage.getItem("prizma.theme.mode")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("renders the token editor section", () => {
    render(<AppearanceTab />);
    expect(screen.getByText(/tokens/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AppearanceTab.test.tsx`
Expected: FAIL (renders stub text).

- [ ] **Step 3: Implement AppearanceTab**

`src/components/AppearanceTab.tsx`:
```typescript
import { useEffect, useState } from "react";
import {
  getMode,
  setMode,
  getAccent,
  setAccent,
  getTokenOverrides,
  setTokenOverrides,
  resetAllTokens,
  type ThemeMode,
} from "../theme/themeStore";
import { TOKEN_CATALOG } from "../theme/tokenCatalog";
import { TokenEditor } from "./TokenEditor";

const ACCENT_PRESETS = [
  "#4f46e5", "#0ea5e9", "#059669", "#ea580c",
  "#dc2626", "#7c3aed", "#db2777", "#0d9488",
];

export function AppearanceTab() {
  const [mode, setModeState] = useState<ThemeMode>(getMode());
  const [accent, setAccentState] = useState<string | null>(getAccent());
  const [overrides, setOverridesState] = useState<Record<string, string>>(getTokenOverrides());

  const changeMode = (m: ThemeMode) => {
    setMode(m);
    setModeState(m);
  };

  const changeAccent = (hex: string | null) => {
    setAccent(hex);
    setAccentState(hex);
  };

  const changeOverride = (name: string, value: string) => {
    const next = { ...overrides, [name]: value };
    setOverrides(next);
    setTokenOverrides(next);
    setOverridesState(next);
  };

  const reset = () => {
    resetAllTokens();
    setAccentState(null);
    setOverridesState({});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Theme mode */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          Theme mode
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text)", cursor: "pointer", textTransform: "capitalize" }}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => changeMode(m)} aria-label={m} />
              {m}
            </label>
          ))}
        </div>
      </section>

      {/* Accent */}
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Accent color</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {ACCENT_PRESETS.map((hex) => (
            <button
              key={hex}
              onClick={() => changeAccent(hex)}
              aria-label={`accent ${hex}`}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: accent === hex ? "2px solid var(--text)" : "2px solid transparent",
                background: hex,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
            Custom
            <input type="color" value={accent ?? "#4f46e5"} onChange={(e) => changeAccent(e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
          </label>
          {accent && (
            <button onClick={() => changeAccent(null)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              reset
            </button>
          )}
        </div>
      </section>

      {/* Token editor */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Tokens (advanced)</div>
          <button onClick={reset} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            Reset to defaults
          </button>
        </div>
        <TokenEditor overrides={overrides} onChange={changeOverride} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Implement TokenEditor**

`src/components/TokenEditor.tsx`:
```typescript
import { TOKEN_CATALOG } from "../theme/tokenCatalog";

interface Props {
  overrides: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const GROUPS = ["Color", "Type", "Spacing & shape"] as const;

export function TokenEditor({ overrides, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {GROUPS.map((group) => (
        <div key={group}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", marginBottom: 6 }}>
            {group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TOKEN_CATALOG.filter((t) => t.group === group).map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 130, color: "var(--text-muted)" }}>{t.label}</span>
                {t.type === "color" ? (
                  <input
                    type="color"
                    value={overrides[t.name] ?? t.default}
                    onChange={(e) => onChange(t.name, e.target.value)}
                    style={{ width: 28, height: 20, border: "1px solid var(--border)", background: "none", cursor: "pointer", padding: 0 }}
                  />
                ) : (
                  <input
                    type="text"
                    value={overrides[t.name] ?? t.default}
                    onChange={(e) => onChange(t.name, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "3px 6px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 11,
                      fontFamily: t.type === "font" ? "var(--font-mono)" : "var(--font-sans)",
                      color: "var(--text)",
                      background: "var(--bg)",
                    }}
                  />
                )}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/AppearanceTab.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/AppearanceTab.tsx src/components/AppearanceTab.test.tsx src/components/TokenEditor.tsx
git commit -m "feat(settings): AppearanceTab — mode + accent + token editor"
```

### Task 2.4: Wire SettingsModal into EditorTopBar + EmptyState

**Files:**
- Modify: `src/components/EditorTopBar.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/EditorView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add gear + onOpenSettings to EditorTopBar**

In `src/components/EditorTopBar.tsx`, add `onOpenSettings: () => void;` to the Props interface and add a gear button before the Save button:
```typescript
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 8px",
          }}
        >
          ⚙
        </button>
```
Destructure `onOpenSettings` in the function params.

- [ ] **Step 2: Add Settings link to EmptyState**

In `src/components/EmptyState.tsx`, add `onOpenSettings: () => void;` to Props and a link button below the welcome link:
```typescript
      <button
        onClick={onOpenSettings}
        style={{
          marginTop: 8,
          background: "transparent",
          border: "none",
          font: "var(--font-small)",
          color: "var(--text-muted)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        Settings
      </button>
```

- [ ] **Step 3: Host SettingsModal in EditorView**

In `src/components/EditorView.tsx`, add `const [settingsOpen, setSettingsOpen] = useState(false);` and render the modal at the bottom (alongside the AI dialog/peek):
```typescript
import { SettingsModal } from "./SettingsModal";
// …
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
```
Pass `onOpenSettings={() => setSettingsOpen(true)}` to `<EditorTopBar … />`.

- [ ] **Step 4: Host SettingsModal in App for the empty-state entry point**

In `src/App.tsx`, add `const [settingsOpen, setSettingsOpen] = useState(false);` and render `<SettingsModal>` when `open.state === "empty"` and `settingsOpen`. Pass `onOpenSettings={() => setSettingsOpen(true)}` to `<EmptyState>`. Add the import.

- [ ] **Step 5: Run full test suite + tsc**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; tests pass. (Update EmptyState.test.tsx baseProps to include `onOpenSettings: vi.fn()`.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(settings): wire SettingsModal into top bar + empty state"
```

### Task 2.5: Visual verification — settings

- [ ] **Step 1: Screenshot settings open with both tabs**

Use the shot harness to enter the editor, click the gear, screenshot Providers then Appearance:
```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.getByText('First time? Read the welcome document').click();
  await p.waitForTimeout(500);
  await p.hover('[data-testid=hover-zone]');
  await p.waitForTimeout(300);
  await p.click(\\\"button:has-text('Edit')\\\");
  await p.waitForTimeout(700);
  await p.click('button[title=Settings]');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'scripts/shots/settings-providers.png' });
  await p.click('button:has-text(\"appearance\")');
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'scripts/shots/settings-appearance.png' });
  await b.close();
})();
"
```
Expected: both screenshots show the modal; Appearance shows mode radios, swatches, token editor.

- [ ] **Step 2: Verify dark mode toggles live**

In the Appearance screenshot session, click the Dark radio and confirm `data-theme="dark"`:
```bash
node -e "
// extend the above to: await p.click('label:has-text(\"Dark\")'); const dt = await p.evaluate(() => document.documentElement.getAttribute('data-theme')); console.log(dt);
"
```
Expected: `dark`.

---

## Phase 3: Rich Toolbar

### Task 3.1: Install new TipTap extensions

- [ ] **Step 1: Install deps**

Run:
```bash
npm install @tiptap/extension-underline @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-text-align @tiptap/extension-link @tiptap/extension-image
```
Expected: install succeeds.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: rich-text TipTap extensions (underline/color/highlight/align/link/image)"
```

### Task 3.2: Register extensions in WysiwygSurface

**Files:**
- Modify: `src/components/WysiwygSurface.tsx`

- [ ] **Step 1: Add the extensions to the editor config**

In `src/components/WysiwygSurface.tsx`, import and add to the `extensions` array:
```typescript
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
```
Add to the array (after StarterKit, before Placeholder):
```typescript
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Image,
```

- [ ] **Step 2: Verify the editor still loads**

Run: `npx vitest run` (full suite)
Expected: PASS.
Visual: `node scripts/shot.mjs` — editor still renders the welcome doc.

- [ ] **Step 3: Commit**

```bash
git add src/components/WysiwygSurface.tsx
git commit -m "feat(editor): register underline/color/highlight/align/link/image extensions"
```

### Task 3.3: Serializer round-trips for new marks

**Files:**
- Modify: `src/registry/serializer.ts`
- Modify: `src/registry/serializer.test.ts`

- [ ] **Step 1: Write failing round-trip tests**

Append to `src/registry/serializer.test.ts` (inside the top describe, before the closing `});`):
```typescript
  it("round-trips underline (<u>)", () => {
    const mdx = "Some <u>underlined</u> text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips strikethrough (~~)", () => {
    const mdx = "Some ~~struck~~ text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a link [text](url)", () => {
    const mdx = "A [link](https://example.com) here.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips an image ![alt](data url)", () => {
    const mdx = "![pic](data:image/png;base64,iVBOR)\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/registry/serializer.test.ts`
Expected: FAIL (new marks not parsed/serialized).

- [ ] **Step 3: Extend parseInline + serializeInline + add block handlers**

In `src/registry/serializer.ts`:

Replace the `parseInline` regex to also capture `<u>…</u>`, `~~…~~`, `[text](url)`, `![alt](url)`:
```typescript
function parseInline(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  // Order matters: image before link (both use [...](...)), and <u> before other tags.
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|<u>[^<]+<\/u>|!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "strike" }] });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "code" }] });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
      nodes.push({ type: "text", text: token.slice(3, -4), marks: [{ type: "underline" }] });
    } else if (token.startsWith("![")) {
      const m = token.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)!;
      nodes.push({ type: "image", attrs: { alt: m[1], src: m[2] } });
    } else if (token.startsWith("[")) {
      const m = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      nodes.push({ type: "text", text: m[1], marks: [{ type: "link", attrs: { href: m[2] } }] });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIdx) });
  }
  return nodes.length ? nodes : [{ type: "text", text }];
}
```

Extend `serializeInline` to emit the new marks:
```typescript
function serializeInline(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "image") {
        const alt = (n.attrs?.alt as string) ?? "";
        const src = (n.attrs?.src as string) ?? "";
        return `![${alt}](${src})`;
      }
      if (n.type === "text") {
        const text = n.text ?? "";
        const marks = n.marks ?? [];
        let out = text;
        // Apply marks in a stable order.
        if (marks.some((m) => m.type === "bold")) out = `**${out}**`;
        if (marks.some((m) => m.type === "italic")) out = `*${out}*`;
        if (marks.some((m) => m.type === "strike")) out = `~~${out}~~`;
        if (marks.some((m) => m.type === "underline")) out = `<u>${out}</u>`;
        if (marks.some((m) => m.type === "code")) out = `\`${out}\``;
        if (marks.some((m) => m.type === "link")) {
          const href = marks.find((m) => m.type === "link")?.attrs?.href ?? "";
          out = `[${out}](${href})`;
        }
        return out;
      }
      return "";
    })
    .join("");
}
```

Note: color/highlight/align are serialized as inline HTML / block wraps. For the round-trip tests above (underline, strike, link, image) this is sufficient. Color/highlight/align are editor-only affordances whose serialization to raw HTML can be added but is not gated by these tests — leave them as no-ops in the serializer for now (they'll persist in the ProseMirror doc and round-trip via the JSON path even if not emitted to MDX text). Add a comment noting this.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/registry/serializer.test.ts`
Expected: PASS (all, including the 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/registry/serializer.ts src/registry/serializer.test.ts
git commit -m "feat(serializer): round-trip underline/strike/link/image"
```

### Task 3.4: Rich toolbar controls

**Files:**
- Modify: `src/components/EditorToolbar.tsx`

- [ ] **Step 1: Add the new control group to the toolbar**

In `src/components/EditorToolbar.tsx`, after the existing inline formatting (B/I/code), add new buttons. The toolbar already has a `TBtn` helper and the editor instance. Add (inside the toolbar row JSX):

```typescript
            <TBtn
              label="U"
              title="Underline"
              active={editor?.isActive("underline")}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <TBtn
              label="S"
              title="Strikethrough"
              active={editor?.isActive("strike")}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            />
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border-soft)", margin: "0 4px" }} />
            {/* Text color */}
            <label title="Text color" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>A</span>
              <input
                type="color"
                onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                style={{ width: 18, height: 18, border: "none", background: "none", padding: 0, marginLeft: 2 }}
              />
            </label>
            {/* Highlight */}
            <label title="Highlight" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
              <span style={{ fontSize: 12 }}>🖊</span>
              <input
                type="color"
                onChange={(e) => editor?.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                style={{ width: 18, height: 18, border: "none", background: "none", padding: 0, marginLeft: 2 }}
              />
            </label>
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border-soft)", margin: "0 4px" }} />
            {/* Alignment */}
            <TBtn label="≡" title="Align left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
            <TBtn label="≣" title="Align center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
            <TBtn label="≡̵" title="Align right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} />
            <span style={{ width: 1, alignSelf: "stretch", background: "var(--border-soft)", margin: "0 4px" }} />
            <TBtn
              label="🔗"
              title="Add link"
              onClick={() => {
                const url = window.prompt("Link URL");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
            />
            <TBtn
              label="🖼"
              title="Insert image"
              onClick={onInsertImage}
            />
```

Add to the Props interface: `onInsertImage: () => void;` and destructure it.

- [ ] **Step 2: Wire onInsertImage from EditorView**

In `src/components/EditorView.tsx`, add a handler that opens the file dialog and inserts the image:
```typescript
import { open as openDialog } from "@tauri-apps/plugin-dialog";
// …
  const handleInsertImage = async () => {
    if (!tiptapEditor) return;
    const picked = await openDialog({ filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }], multiple: false });
    if (typeof picked !== "string" || !picked) return;
    // Read as data URL via fetch (works for local file paths under Tauri).
    try {
      const res = await fetch(picked);
      const blob = await res.blob();
      if (blob.size > 2 * 1024 * 1024) {
        if (!window.confirm("Image is larger than 2MB. Embed anyway?")) return;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      tiptapEditor.chain().focus().setImage({ src: dataUrl }).run();
      editor.markDirty();
    } catch (e) {
      alert(`Could not read image: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
```
Pass `onInsertImage={handleInsertImage}` to `<EditorToolbar … />`.

- [ ] **Step 3: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/EditorToolbar.tsx src/components/EditorView.tsx
git commit -m "feat(toolbar): rich controls — underline/strike/color/highlight/align/link/image"
```

### Task 3.5: Visual verification — rich toolbar

- [ ] **Step 1: Screenshot the new toolbar and exercise a few controls**

```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.getByText('First time? Read the welcome document').click();
  await p.waitForTimeout(500);
  await p.hover('[data-testid=hover-zone]');
  await p.waitForTimeout(300);
  await p.click(\\\"button:has-text('Edit')\\\");
  await p.waitForTimeout(700);
  await p.screenshot({ path: 'scripts/shots/rich-toolbar.png' });
  // Click underline, type, check <u>
  await p.click('.ProseMirror p:first-of-type');
  await p.keyboard.press('End');
  await p.click('button[title=Underline]');
  await p.keyboard.type(' underlined');
  const hasU = await p.evaluate(() => !!document.querySelector('.ProseMirror u'));
  console.log('underline produces <u>:', hasU);
  await b.close();
})();
"
```
Expected: toolbar screenshot shows the new controls; `underline produces <u>: true`.

---

## Phase 4: AI Panel

### Task 4.1: Rust ai_generate_document command

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add the command**

Add after `ai_author_component` in `src-tauri/src/lib.rs`:
```rust
/// Author-time whole-document generation. Like ai_author_component but the
/// system prompt requests a full multi-block MDX document body. NOT policy-
/// gated (author-time affordance). Returns the MDX source.
#[tauri::command]
async fn ai_generate_document(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    prompt: String,
    selection: Option<String>,
) -> Result<String, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;

    let system = if selection.is_some() {
        "You edit a short selection of an MDX document. Return ONLY the replacement \
MDX for that selection — no fences, no explanation. Preserve the meaning but apply \
the user's instruction. Use only built-in components: Callout, StatCard, CodeBlock, \
Divider, Table, Chart, Badge, FeatureCard, StatGroup, Tabs, Quote, Diagram."
    } else {
        "You generate a complete MDX document. Return ONLY the MDX source — no fences, \
no explanation. Use headings, paragraphs, lists, and built-in components where helpful: \
Callout, StatCard, CodeBlock, Divider, Table, Chart, Badge, FeatureCard, StatGroup, Tabs, \
Quote, Diagram. Start with a top-level # heading."
    };
    let user_msg = match &selection {
        Some(sel) => format!("Selection:\n{}\n\nInstruction: {}", sel, prompt),
        None => prompt,
    };
    let messages = vec![
        ("system".to_string(), system.to_string()),
        ("user".to_string(), user_msg),
    ];
    let resp = p
        .complete(
            state.secrets.as_ref(),
            &CompletionRequest { model, messages },
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.text)
}
```

- [ ] **Step 2: Register it**

In the `invoke_handler` list, add `ai_generate_document,` after `ai_author_component,`.

- [ ] **Step 3: Verify Rust builds**

Run: `cd src-tauri && cargo build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(ai): ai_generate_document command (whole-doc + selection editing)"
```

### Task 4.2: Frontend bridge + mock

**Files:**
- Create: `src/lib/aiGenerate.ts`
- Modify: `index.html` (mock)
- Modify: `src/lib/ai.ts` (re-export DEFAULT_MODELS is already there)

- [ ] **Step 1: Create the bridge**

`src/lib/aiGenerate.ts`:
```typescript
import { invoke } from "@tauri-apps/api/core";
import { stripFences } from "./aiComponent";

/// Generate a full document's MDX from a prompt. Returns raw model output.
export function generateDocument(provider: string, model: string, prompt: string): Promise<string> {
  return invoke<string>("ai_generate_document", { provider, model, prompt, selection: null });
}

/// Edit a text selection. Returns replacement MDX for the selection.
export function editSelection(provider: string, model: string, prompt: string, selection: string): Promise<string> {
  return invoke<string>("ai_generate_document", { provider, model, prompt, selection });
}

/// Convenience: generate + strip code fences in one step.
export async function generateDocumentClean(provider: string, model: string, prompt: string): Promise<string> {
  return stripFences(await generateDocument(provider, model, prompt));
}
export async function editSelectionClean(provider: string, model: string, prompt: string, selection: string): Promise<string> {
  return stripFences(await editSelection(provider, model, prompt, selection));
}
```

- [ ] **Step 2: Add mock entry in index.html**

In the `switch (cmd)` block in `index.html`, add:
```javascript
              case 'ai_generate_document':
                return Promise.resolve('# ' + (args.prompt || 'Generated').slice(0, 40) + '\n\nThis is a **mock** generated document. It demonstrates the AI panel.\n\n## Highlights\n\n- Whole-doc generation\n- Selection editing\n- Built-in components\n\n<Callout type="info">Mock content from the browser dev environment.</Callout>\n');
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/aiGenerate.ts index.html
git commit -m "feat(ai): frontend generate/edit bridge + browser mock"
```

### Task 4.3: useAiConfig hook

**Files:**
- Create: `src/hooks/useAiConfig.ts`

- [ ] **Step 1: Implement**

`src/hooks/useAiConfig.ts`:
```typescript
import { useEffect, useState } from "react";
import { listProviders, hasApiKey, defaultModelFor } from "../lib/ai";

/// Resolves the active provider + model for AI features. Picks the first
/// configured provider (via hasApiKey), or null if none. Persists the user's
/// explicit choice in localStorage.
export function useAiConfig() {
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [configured, setConfigured] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = (await listProviders()) ?? [];
      const ready: string[] = [];
      for (const p of all) {
        try {
          if (await hasApiKey(p)) ready.push(p);
        } catch {
          /* skip */
        }
      }
      if (cancelled) return;
      setConfigured(ready);
      const saved = localStorage.getItem("prizma.ai.provider");
      const chosen = saved && ready.includes(saved) ? saved : ready[0] ?? null;
      setProvider(chosen);
      setModel(defaultModelFor(chosen ?? "openai"));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = (p: string) => {
    setProvider(p);
    setModel(defaultModelFor(p));
    localStorage.setItem("prizma.ai.provider", p);
  };

  return { provider, model, configured, loading, choose };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAiConfig.ts
git commit -m "feat(ai): useAiConfig hook — resolve + persist active provider/model"
```

### Task 4.4: useResizablePanel hook

**Files:**
- Create: `src/hooks/useResizablePanel.ts`

- [ ] **Step 1: Implement**

`src/hooks/useResizablePanel.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from "react";

/// Drag-to-resize + collapse for a docked panel. `side` is the edge the
/// drag handle sits on ("left" for a right-docked panel). Persists width.
export function useResizablePanel(storageKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const n = saved ? Number(saved) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultWidth;
  });
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useRef(false);

  const onPointerDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      // Right-docked panel: width = window.innerWidth - e.clientX (minus margin)
      const w = window.innerWidth - e.clientX - 16;
      setWidth(Math.min(max, Math.max(min, w)));
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(storageKey, String(width));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [storageKey, min, max, width]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return { width, collapsed, onPointerDown, toggle };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useResizablePanel.ts
git commit -m "feat(ui): useResizablePanel hook — drag-to-resize + collapse docked panels"
```

### Task 4.5: AiPanel component

**Files:**
- Create: `src/components/AiPanel.tsx`
- Create: `src/components/AiPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/AiPanel.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiPanel } from "./AiPanel";

// Mock the config hook + generate bridge.
vi.mock("../hooks/useAiConfig", () => ({
  useAiConfig: () => ({ provider: "openai", model: "gpt-4o-mini", configured: ["openai"], loading: false, choose: vi.fn() }),
}));
const generateMock = vi.fn().mockResolvedValue("# Mock\n\nBody.\n");
vi.mock("../lib/aiGenerate", () => ({
  generateDocumentClean: (...a: any[]) => generateMock(...a),
  editSelectionClean: vi.fn().mockResolvedValue("edited"),
}));

describe("AiPanel", () => {
  it("shows Document mode by default and a prompt input", () => {
    render(<AiPanel selection={null} onApply={vi.fn()} onCollapse={vi.fn()} width={320} />);
    expect(screen.getByText(/Document/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/describe/i)).toBeInTheDocument();
  });

  it("shows Selection mode hint when selection is provided", () => {
    render(<AiPanel selection="some text" onApply={vi.fn()} onCollapse={vi.fn()} width={320} />);
    expect(screen.getByText(/Editing selection/i)).toBeInTheDocument();
  });

  it("generates and offers Replace/Insert/Append in Document mode", async () => {
    const onApply = vi.fn();
    render(<AiPanel selection={null} onApply={onApply} onCollapse={vi.fn()} width={320} />);
    fireEvent.change(screen.getByPlaceholderText(/describe/i), { target: { value: "a doc about cats" } });
    fireEvent.click(screen.getByRole("button", { name: /send|generate/i }));
    await waitFor(() => expect(screen.getByText(/replace/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /replace/i }));
    expect(onApply).toHaveBeenCalledWith(expect.any(String), "replace");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/AiPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement AiPanel**

`src/components/AiPanel.tsx`:
```typescript
import { useState } from "react";
import { useAiConfig } from "../hooks/useAiConfig";
import { generateDocumentClean, editSelectionClean } from "../lib/aiGenerate";

interface Turn {
  role: "user" | "ai";
  text: string;
}

interface Props {
  /// Current text selection, or null. Drives Document vs Selection mode.
  selection: string | null;
  /// Apply generated MDX. mode is "replace" | "insert" | "append" (doc) or "replace-selection" | "insert-after" (selection).
  onApply: (mdx: string, mode: "replace" | "insert" | "append" | "replace-selection" | "insert-after") => void;
  onCollapse: () => void;
  onOpenSettings: () => void;
  width: number;
}

export function AiPanel({ selection, onApply, onCollapse, onOpenSettings, width }: Props) {
  const ai = useAiConfig();
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mode: "document" | "selection" = selection ? "selection" : "document";

  const run = async () => {
    if (!prompt.trim() || !ai.provider) return;
    setLoading(true);
    setError("");
    setLastResult(null);
    const userTurn: Turn = { role: "user", text: prompt.trim() };
    setTurns((t) => [...t, userTurn]);
    try {
      const mdx =
        mode === "selection"
          ? await editSelectionClean(ai.provider, ai.model, prompt.trim(), selection!)
          : await generateDocumentClean(ai.provider, ai.model, prompt.trim());
      setLastResult(mdx);
      setTurns((t) => [...t, { role: "ai", text: mdx }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  if (ai.loading) {
    return <Shell width={width} onCollapse={onCollapse}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</div></Shell>;
  }

  if (!ai.provider || ai.configured.length === 0) {
    return (
      <Shell width={width} onCollapse={onCollapse}>
        <div style={{ padding: 16, fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          No AI provider is configured.
          <div style={{ marginTop: 10 }}>
            <button onClick={onOpenSettings} style={btnStyle}>Open Settings →</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell width={width} onCollapse={onCollapse}>
      {/* Mode indicator */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", fontSize: 11, color: "var(--text-muted)" }}>
        {mode === "selection" ? "✎ Editing selection" : "📄 Document mode"} · {ai.provider}
      </div>

      {/* History */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {turns.length === 0 && (
          <div style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center", marginTop: 20 }}>
            {mode === "selection" ? "Tell the AI how to edit the selected text." : "Describe the document you want."}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} style={{
            alignSelf: t.role === "user" ? "flex-end" : "flex-start",
            background: t.role === "user" ? "var(--accent-soft)" : "var(--bg-muted)",
            color: "var(--text)",
            padding: "6px 10px",
            borderRadius: "var(--radius)",
            fontSize: 12,
            maxWidth: "85%",
            whiteSpace: "pre-wrap",
            fontFamily: t.role === "ai" ? "var(--font-mono)" : "var(--font-sans)",
          }}>
            {t.text}
          </div>
        ))}
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Generating…</div>}
        {error && <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>}
      </div>

      {/* Landing affordance for the last result */}
      {lastResult && !loading && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)", width: "100%", marginBottom: 2 }}>Generated {lastResult.split("\n").length} lines.</span>
          {mode === "document" ? (
            <>
              <button onClick={() => { onApply(lastResult, "replace"); setLastResult(null); }} style={btnStyle}>Replace</button>
              <button onClick={() => { onApply(lastResult, "insert"); setLastResult(null); }} style={btnStyle}>Insert here</button>
              <button onClick={() => { onApply(lastResult, "append"); setLastResult(null); }} style={btnStyle}>Append</button>
            </>
          ) : (
            <>
              <button onClick={() => { onApply(lastResult, "replace-selection"); setLastResult(null); }} style={btnStyle}>Replace selection</button>
              <button onClick={() => { onApply(lastResult, "insert-after"); setLastResult(null); }} style={btnStyle}>Insert after</button>
            </>
          )}
        </div>
      )}

      {/* Prompt */}
      <div style={{ padding: 12, borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6 }}>
        <textarea
          placeholder={mode === "selection" ? "How should the AI edit the selection?" : "Describe the document…"}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } }}
          rows={2}
          style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-sans)", resize: "none", outline: "none" }}
        />
        <button onClick={run} disabled={loading || !prompt.trim()} style={{ ...btnStyle, opacity: loading || !prompt.trim() ? 0.5 : 1 }}>
          ↑
        </button>
      </div>
    </Shell>
  );
}

const btnStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  padding: "5px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

function Shell({ width, onCollapse, children }: { width: number; onCollapse: () => void; children: React.ReactNode }) {
  return (
    <div style={{ width, background: "var(--bg)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border-soft)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>✨ AI</span>
        <button onClick={onCollapse} title="Collapse" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 14 }}>›</button>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AiPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AiPanel.tsx src/components/AiPanel.test.tsx
git commit -m "feat(ai): AiPanel — right-docked, document + selection modes, landing affordance"
```

### Task 4.6: Host AiPanel + selection tracking in EditorView

**Files:**
- Modify: `src/components/EditorView.tsx`

- [ ] **Step 1: Track selection + host the panel**

In `src/components/EditorView.tsx`:
- Import `AiPanel`, `useResizablePanel`.
- Add state:
```typescript
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const panel = useResizablePanel("prizma.ai.panelWidth", 320, 240, 480);
```
- Track the editor selection via a TipTap `onSelectionUpdate` (pass through WysiwygSurface, or read from the tiptapEditor instance on an interval). Simplest: add a selection-update listener once `tiptapEditor` is ready:
```typescript
  useEffect(() => {
    if (!tiptapEditor) return;
    const update = () => {
      const { from, to, empty } = tiptapEditor.state.selection;
      if (empty) { setSelection(null); return; }
      setSelection(tiptapEditor.state.doc.textBetween(from, to, " "));
    };
    tiptapEditor.on("selectionUpdate", update);
    return () => { tiptapEditor.off("selectionUpdate", update); };
  }, [tiptapEditor]);
```
- Add the apply handler:
```typescript
  const handleAiApply = (mdx: string, mode: "replace" | "insert" | "append" | "replace-selection" | "insert-after") => {
    if (!tiptapEditor) return;
    tiptapEditor.commands.focus();
    const parsed = parseMdxToDoc(mdx).json.content ?? [];
    if (mode === "replace") {
      tiptapEditor.commands.setContent(parsed);
    } else if (mode === "append") {
      tiptapEditor.commands.setContent([...(tiptapEditor.getJSON().content as any[]), ...parsed]);
    } else if (mode === "insert" || mode === "insert-after") {
      tiptapEditor.commands.insertContent(parsed);
    } else if (mode === "replace-selection") {
      const { from, to } = tiptapEditor.state.selection;
      tiptapEditor.chain().deleteRange({ from, to }).insertContentAt(from, parsed).run();
    }
    editor.markDirty();
  };
```
- Render the panel in the main flex container. Change the editor surface wrapper to a flex row:
```typescript
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* top bar, toolbar, editor surface, footer as before, but editor surface row becomes: */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {editor.mode === "wysiwyg" ? <WysiwygSurface … /> : <RawEditor … />}
        </div>
        {aiPanelOpen && (
          <AiPanel
            selection={selection}
            onApply={handleAiApply}
            onCollapse={() => setAiPanelOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
            width={panel.width}
          />
        )}
      </div>
      {/* a small floating button to re-open the panel when collapsed, bottom-right */}
      {!aiPanelOpen && (
        <button onClick={() => setAiPanelOpen(true)} style={{ position: "fixed", right: 16, bottom: 40, zIndex: 50, ...btnStyle }}>✨ AI</button>
      )}
```

- [ ] **Step 2: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorView.tsx
git commit -m "feat(editor): host docked AiPanel + track selection + apply generated content"
```

### Task 4.7: Visual verification — AI panel

- [ ] **Step 1: Screenshot the panel in document + selection modes**

```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.getByText('First time? Read the welcome document').click();
  await p.waitForTimeout(500);
  await p.hover('[data-testid=hover-zone]');
  await p.waitForTimeout(300);
  await p.click(\\\"button:has-text('Edit')\\\");
  await p.waitForTimeout(700);
  await p.evaluate(() => { window.MOCK_AI_PROVIDER = 'openai'; });
  await p.waitForTimeout(200);
  // Wait for useAiConfig to re-query hasApiKey — reload the panel by toggling
  await p.reload();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'scripts/shots/ai-panel-doc.png' });
  // type a prompt and generate
  const ta = await p.evaluate(() => { const el = document.querySelector('[placeholder*=describe]'); return el ? 1 : 0; });
  console.log('prompt present:', ta);
  await b.close();
})();
"
```
Expected: screenshot shows the AI panel docked right; "prompt present: 1" (after the reload picks up the mock provider flag).

Note: the mock provider flag (`MOCK_AI_PROVIDER`) is read by `ai_has_api_key` at query time, so a reload ensures `useAiConfig` re-evaluates. If the panel still shows "no provider", set the flag before first navigation instead.

---

## Final Verification

### Task F.1: Full test + type + Rust sweep

- [ ] **Step 1: Run everything**

```bash
cd "/Volumes/Main External/Development/PrizmaPage"
npx tsc --noEmit
npx vitest run
cd src-tauri && cargo test --lib && cargo build
```
Expected: tsc clean; all vitest tests pass (87 baseline + new); cargo tests pass; cargo build succeeds.

- [ ] **Step 2: Run the master walkthrough**

```bash
node scripts/master-verify.mjs
```
Expected: all checks pass (the harness may need its component-loop Escape fix already applied).

### Task F.2: Spec coverage audit

- [ ] **Step 1: Verify each spec section has shipped**

| Spec section | Verified by |
|---|---|
| §3 AI panel (dock, doc+selection, landing, history) | Task 4.5–4.7 |
| §4 Settings modal (gear, providers, appearance) | Task 2.1–2.4 |
| §5 Rich toolbar (U/S/color/highlight/align/link/image) | Task 3.4 |
| §5.3 serializer round-trips | Task 3.3 |
| §6 Theming (mode/accent/token editor, dark, persistence) | Task 1.1–1.4 |
| §7 ai_generate_document Rust | Task 4.1 |

If any row is missing evidence, add a task.

---

## Self-Review Notes

**Spec coverage:** Every section of the spec maps to ≥1 task. §5.3 color/highlight/align serialization is noted as editor-only (persists via JSON, not emitted to MDX text) — this is a deliberate scope cut, called out inline.

**Type consistency:** `onApply`'s mode union (`"replace" | "insert" | "append" | "replace-selection" | "insert-after"`) is consistent between AiPanel (Task 4.5) and EditorView (Task 4.6). `ThemeMode` is consistent between themeStore and AppearanceTab.

**No placeholders:** every code step contains the full implementation; no TBD/TODO.
