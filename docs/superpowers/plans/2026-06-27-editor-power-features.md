# Editor Power Features (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five Phase-7 polish features for word-document-class authoring: PDF/print export, spellcheck surface, find & replace, document statistics, and templates. All reuse existing Tauri commands (no Rust changes).

**Architecture:** Five independent features, each frontend-only, each TDD (test-first). Ordered by dependency: stats (1) and spellcheck (2) are leaf libraries with no integration deps; find/replace (3) needs the editor instance; templates (4) needs the save pipeline; print (5) needs `.no-print` marking on everything. Each task ends green + committed.

**Tech Stack:** React 18, TypeScript, TipTap v2, Vitest + React Testing Library, headless-Chrome visual harness (`scripts/shot.mjs`).

**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-design.md`

**Baseline (verified before start):** `npx tsc --noEmit` clean; `npm test` 145 pass; `cargo build` green; non-live Rust tests pass. The 3 unhandled-rejection errors in `SettingsModal.test.tsx` (missing `listProviders` mock) are pre-existing and unrelated — leave them unless a task touches that file.

---

## File Structure

**Created (frontend):**
- `src/lib/docStats.ts` + `src/lib/docStats.test.ts` — `computeStats(text)`.
- `src/components/DocStatsBar.tsx` + `src/components/DocStatsBar.test.tsx` — status strip.
- `src/hooks/useSpellcheck.ts` + `src/hooks/useSpellcheck.test.ts` — toggle + persist + apply.
- `src/lib/findReplace.ts` + `src/lib/findReplace.test.ts` — `findAll`, `replaceRanges`, navigation.
- `src/components/FindReplaceBar.tsx` + `src/components/FindReplaceBar.test.tsx` — docked bar.
- `src/lib/templates.ts` + `src/lib/templates.test.ts` — `TEMPLATES` + `seedDocumentFromTemplate`.
- `src/components/TemplatePicker.tsx` + `src/components/TemplatePicker.test.tsx` — picker.
- `src/lib/print.ts` + `src/lib/print.test.ts` — `printDocument()` + `PRINT_STYLES`.
- `src/theme/print.css` — print stylesheet.

**Modified (frontend):**
- `src/components/EditorView.tsx` — host DocStatsBar, FindReplaceBar, TemplatePicker; wire Cmd+F/G/H; print handler; template-seed handlers; `.no-print` classes.
- `src/components/EditorTopBar.tsx` — 🖨 Export button + prop.
- `src/components/EditorToolbar.tsx` — spellcheck toggle + Find/Replace/Templates buttons.
- `src/components/WysiwygSurface.tsx` — apply spellcheck attr; `.no-print` class.
- `src/components/VaultDashboard.tsx` + `src/components/EmptyState.tsx` — template picker entry.
- `src/components/DocumentView.tsx` + `src/components/HoverControls.tsx` — viewer print option + `.no-print`.
- `src/main.tsx` — import `print.css`.

---

## Phase 1: Document Statistics

### Task 1.1: computeStats — words / chars / reading time

**Files:**
- Create: `src/lib/docStats.ts`
- Create: `src/lib/docStats.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/docStats.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeStats } from "./docStats";

describe("computeStats", () => {
  it("counts words and characters", () => {
    const s = computeStats("hello world foo");
    expect(s.words).toBe(3);
    expect(s.characters).toBe(15);
  });

  it("returns zeros for empty/whitespace text", () => {
    expect(computeStats("")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
    expect(computeStats("   \n  ")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
  });

  it("collapses runs of whitespace when counting words", () => {
    expect(computeStats("a\t\n b\n\n  c").words).toBe(3);
  });

  it("computes reading time at 200 wpm, min 1 when nonzero", () => {
    expect(computeStats("one two").readingMinutes).toBe(1);
    expect(computeStats(Array(201).fill("word").join(" ")).readingMinutes).toBe(2);
  });

  it("counts characters including spaces", () => {
    expect(computeStats("a b").characters).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/docStats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/docStats.ts`:
```typescript
export interface DocStats {
  words: number;
  characters: number;
  readingMinutes: number;
}

const WPM = 200;

/// Whole-document statistics. `text` is the document's plain text
/// (e.g. ProseMirror's `textBetween(0, size, " ")`).
export function computeStats(text: string): DocStats {
  const characters = text.length;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.round(words / WPM));
  return { words, characters, readingMinutes };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/docStats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/docStats.ts src/lib/docStats.test.ts
git commit -m "feat(stats): computeStats — words/chars/reading time"
```

### Task 1.2: DocStatsBar component

**Files:**
- Create: `src/components/DocStatsBar.tsx`
- Create: `src/components/DocStatsBar.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/DocStatsBar.test.tsx`:
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocStatsBar } from "./DocStatsBar";

describe("DocStatsBar", () => {
  it("renders words, characters, and reading time", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={null} />);
    expect(screen.getByText(/42\s*words/i)).toBeInTheDocument();
    expect(screen.getByText(/250\s*characters/i)).toBeInTheDocument();
    expect(screen.getByText(/1\s*min read/i)).toBeInTheDocument();
  });

  it("renders selection stats when provided", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={{ words: 5, characters: 30, readingMinutes: 0 }} />);
    expect(screen.getByText(/selected:\s*5\s*words/i)).toBeInTheDocument();
  });

  it("hides selection stats when null", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={null} />);
    expect(screen.queryByText(/selected:/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocStatsBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/components/DocStatsBar.tsx`:
```typescript
import type { DocStats } from "../lib/docStats";

interface Props {
  stats: DocStats;
  selectionStats: DocStats | null;
}

export function DocStatsBar({ stats, selectionStats }: Props) {
  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        gap: 16,
        padding: "4px 14px",
        fontSize: 11,
        color: "var(--text-faint)",
        background: "var(--bg)",
        borderTop: "1px solid var(--border-soft)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span>{stats.words} words</span>
      <span>{stats.characters} characters</span>
      <span>{stats.readingMinutes === 0 ? "<1" : stats.readingMinutes} min read</span>
      {selectionStats && (
        <span style={{ marginLeft: "auto", color: "var(--text-muted)" }}>
          selected: {selectionStats.words} words
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocStatsBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DocStatsBar.tsx src/components/DocStatsBar.test.tsx
git commit -m "feat(stats): DocStatsBar — status strip with selection count"
```

### Task 1.3: Wire DocStatsBar into EditorView

**Files:**
- Modify: `src/components/EditorView.tsx`

- [ ] **Step 1: Add stats computation + render the bar**

In `src/components/EditorView.tsx`:
- Add imports:
```typescript
import { computeStats } from "../lib/docStats";
import { DocStatsBar } from "./DocStatsBar";
```
- Add state (near the other `useState` calls):
```typescript
const [stats, setStats] = useState(() => computeStats(serializeDoc(doc)));
```
- Add an effect that recomputes stats (debounced 150ms) whenever `doc` or `tiptapEditor` updates:
```typescript
useEffect(() => {
  if (!tiptapEditor) return;
  const recompute = () => {
    const text = tiptapEditor.state.doc.textBetween(0, tiptapEditor.state.doc.content.size, " ");
    setStats(computeStats(text));
  };
  const t = window.setTimeout(recompute, 0); // initial
  tiptapEditor.on("update", recompute);
  return () => { window.clearTimeout(t); tiptapEditor.off("update", recompute); };
}, [tiptapEditor]);
```
- Compute selection stats from the existing `selection` state:
```typescript
const selectionStats = selection ? computeStats(selection) : null;
```
- Render the bar just above the `TrustFooter` (inside the outermost column flex). Find the `TrustFooter` render and place `<DocStatsBar stats={stats} selectionStats={selectionStats} />` immediately before it.

- [ ] **Step 2: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorView.tsx
git commit -m "feat(stats): wire DocStatsBar into the editor (live word/char/time)"
```

---

## Phase 2: Spellcheck Surface

### Task 2.1: useSpellcheck hook

**Files:**
- Create: `src/hooks/useSpellcheck.ts`
- Create: `src/hooks/useSpellcheck.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hooks/useSpellcheck.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpellcheck } from "./useSpellcheck";

beforeEach(() => localStorage.clear());

describe("useSpellcheck", () => {
  it("defaults to enabled", () => {
    const { result } = renderHook(() => useSpellcheck());
    expect(result.current.enabled).toBe(true);
  });

  it("toggles and persists to localStorage", () => {
    const { result } = renderHook(() => useSpellcheck());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem("prizma.editor.spellcheck")).toBe("0");
  });

  it("reads the persisted value on mount", () => {
    localStorage.setItem("prizma.editor.spellcheck", "0");
    const { result } = renderHook(() => useSpellcheck());
    expect(result.current.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useSpellcheck.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/hooks/useSpellcheck.ts`:
```typescript
import { useCallback, useState } from "react";

const KEY = "prizma.editor.spellcheck";

/// Toggle + persist the editor's native spellcheck. The boolean is read
/// on mount and reflected onto the ProseMirror element's `spellcheck` attr
/// by WysiwygSurface.
export function useSpellcheck() {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(KEY) !== "0");
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  return { enabled, toggle };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useSpellcheck.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSpellcheck.ts src/hooks/useSpellcheck.test.ts
git commit -m "feat(spellcheck): useSpellcheck hook — toggle + persist"
```

### Task 2.2: Apply spellcheck in WysiwygSurface + toolbar toggle

**Files:**
- Modify: `src/components/WysiwygSurface.tsx`
- Modify: `src/components/EditorToolbar.tsx`

- [ ] **Step 1: Read WysiwygSurface to find the spellcheck attr**

Run: `grep -n "spellcheck" src/components/WysiwygSurface.tsx`
Confirm the `EditorContent`/editor props carry `spellcheck: "true"` (around line 51-54 per the earlier audit).

- [ ] **Step 2: Make the attribute reactive**

In `src/components/WysiwygSurface.tsx`, lift spellcheck state up by accepting a prop `spellcheck: boolean` on the component and using it in the editor props instead of the hardcoded `"true"`. (The `useSpellcheck` hook lives in `EditorView` and the value is passed down — keeps the hook single-source.) Replace the hardcoded `spellcheck: "true"` with `spellcheck: spellcheck ? "true" : "false"`. Add `spellcheck: boolean;` to the Props interface.

- [ ] **Step 3: Add the toggle to EditorToolbar**

In `src/components/EditorToolbar.tsx`, accept a new prop `spellcheck: boolean` and `onToggleSpellcheck: () => void` on the Props interface and destructure them. Add a toggle button in the toolbar (after the inline-format group, before the alignment group, or grouped with text-formatting):
```typescript
<TBtn
  label="✓ABC"
  title="Toggle spellcheck"
  active={spellcheck}
  onClick={onToggleSpellcheck}
/>
```

- [ ] **Step 4: Wire from EditorView**

In `src/components/EditorView.tsx`:
- `import { useSpellcheck } from "../hooks/useSpellcheck";`
- `const spell = useSpellcheck();`
- Pass `spellcheck={spell.enabled}` to `<WysiwygSurface … />`.
- Pass `spellcheck={spell.enabled}` and `onToggleSpellcheck={spell.toggle}` to `<EditorToolbar … />`.

- [ ] **Step 5: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Then visual (verify the toggle flips the attribute):
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
  await p.waitForTimeout(400);
  await p.hover('[data-testid=hover-zone]');
  await p.waitForTimeout(200);
  await p.click(\"button:has-text('Edit')\");
  await p.waitForTimeout(700);
  const before = await p.\$eval('.ProseMirror', el => el.getAttribute('spellcheck'));
  await p.click('button[title=\"Toggle spellcheck\"]');
  await p.waitForTimeout(150);
  const after = await p.\$eval('.ProseMirror', el => el.getAttribute('spellcheck'));
  console.log('before:', before, 'after:', after);
  await b.close();
})();
"
```
Expected: `before: true after: false`.

- [ ] **Step 6: Commit**

```bash
git add src/components/WysiwygSurface.tsx src/components/EditorToolbar.tsx src/components/EditorView.tsx
git commit -m "feat(spellcheck): reactive toggle on the WYSIWYG surface + toolbar button"
```

---

## Phase 3: Find & Replace

### Task 3.1: findReplace logic library

**Files:**
- Create: `src/lib/findReplace.ts`
- Create: `src/lib/findReplace.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/findReplace.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { findAll } from "./findReplace";

describe("findAll", () => {
  it("finds all non-overlapping substring matches", () => {
    expect(findAll("foo bar foo", "foo", {})).toEqual([{ from: 0, to: 3 }, { from: 8, to: 11 }]);
  });

  it("returns empty for no matches", () => {
    expect(findAll("hello", "xyz", {})).toEqual([]);
  });

  it("is case-insensitive by default", () => {
    expect(findAll("Foo foo FOO", "foo", {}).length).toBe(3);
  });

  it("respects caseSensitive option", () => {
    expect(findAll("Foo foo FOO", "foo", { caseSensitive: true })).toEqual([{ from: 4, to: 7 }]);
  });

  it("respects wholeWord option", () => {
    expect(findAll("foo foobar foo", "foo", { wholeWord: true })).toEqual([{ from: 0, to: 3 }, { from: 11, to: 14 }]);
  });

  it("returns empty for empty query", () => {
    expect(findAll("anything", "", {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/findReplace.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/findReplace.ts`:
```typescript
export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface Range {
  from: number;
  to: number;
}

/// All non-overlapping substring matches of `query` in `text`. Returns `[]`
/// for an empty query. Operates on a plain-text view of the document
/// (positions are offsets into that same text), used by FindReplaceBar.
export function findAll(text: string, query: string, opts: FindOptions): Range[] {
  if (!query) return [];
  const flags = opts.caseSensitive ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = opts.wholeWord ? `\\b${escaped}\\b` : escaped;
  const re = new RegExp(pattern, flags);
  const out: Range[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ from: m.index, to: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++; // avoid zero-width loop
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/findReplace.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/findReplace.ts src/lib/findReplace.test.ts
git commit -m "feat(find): findAll — substring search with case/whole-word options"
```

### Task 3.2: FindReplaceBar component

**Files:**
- Create: `src/components/FindReplaceBar.tsx`
- Create: `src/components/FindReplaceBar.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/FindReplaceBar.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FindReplaceBar } from "./FindReplaceBar";

const baseProps = {
  findText: "foo",
  replaceText: "",
  onFindChange: vi.fn(),
  onReplaceChange: vi.fn(),
  matchCount: 3,
  matchIndex: 1,
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onReplaceOne: vi.fn(),
  onReplaceAll: vi.fn(),
  onClose: vi.fn(),
};

describe("FindReplaceBar", () => {
  it("renders match count and index", () => {
    render(<FindReplaceBar {...baseProps} />);
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument(); // matchIndex 0-based shown 1-based
  });

  it("calls onNext/Prev", () => {
    const onNext = vi.fn(), onPrev = vi.fn();
    render(<FindReplaceBar {...baseProps} onNext={onNext} onPrev={onPrev} />);
    fireEvent.click(screen.getByTitle(/next/i));
    fireEvent.click(screen.getByTitle(/previous/i));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("shows the replace row + buttons", () => {
    render(<FindReplaceBar {...baseProps} />);
    expect(screen.getByTitle(/replace/i)).toBeInTheDocument();
    expect(screen.getByTitle(/replace all/i)).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<FindReplaceBar {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/FindReplaceBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/components/FindReplaceBar.tsx`:
```typescript
import { useEffect, useRef } from "react";

interface Props {
  findText: string;
  replaceText: string;
  onFindChange: (v: string) => void;
  onReplaceChange: (v: string) => void;
  matchCount: number;
  matchIndex: number; // 0-based current match
  onNext: () => void;
  onPrev: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: "3px 6px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  width: 180,
};

const btn = (active = false): React.CSSProperties => ({
  background: active ? "var(--accent)" : "transparent",
  color: active ? "white" : "var(--text-muted)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "3px 8px",
  fontSize: 11,
  cursor: "pointer",
});

export function FindReplaceBar({ findText, replaceText, onFindChange, onReplaceChange, matchCount, matchIndex, onNext, onPrev, onReplaceOne, onReplaceAll, onClose }: Props) {
  const findRef = useRef<HTMLInputElement>(null);
  useEffect(() => { findRef.current?.focus(); findRef.current?.select(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = matchCount === 0 ? "0 results" : `${matchIndex + 1} / ${matchCount}`;

  return (
    <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 12px", borderBottom: "1px solid var(--border-soft)", background: "var(--bg-muted)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input ref={findRef} value={findText} placeholder="Find" onChange={(e) => onFindChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? onPrev() : onNext(); } }} style={inputStyle} />
        <span style={{ fontSize: 11, color: "var(--text-faint)", minWidth: 70 }}>{shown}</span>
        <button title="Previous" onClick={onPrev} style={btn()}>↑</button>
        <button title="Next" onClick={onNext} style={btn()}>↓</button>
        <button title="Close" onClick={onClose} style={{ ...btn(), marginLeft: "auto" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input value={replaceText} placeholder="Replace" onChange={(e) => onReplaceChange(e.target.value)} style={inputStyle} />
        <button title="Replace" onClick={onReplaceOne} style={btn()}>Replace</button>
        <button title="Replace all" onClick={onReplaceAll} style={btn()}>All</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/FindReplaceBar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FindReplaceBar.tsx src/components/FindReplaceBar.test.tsx
git commit -m "feat(find): FindReplaceBar — docked find/replace with match nav"
```

### Task 3.3: Wire find/replace into EditorView

**Files:**
- Modify: `src/components/EditorView.tsx`

- [ ] **Step 1: Add state + matching + keybindings + rendering**

In `src/components/EditorView.tsx`:
- Add imports:
```typescript
import { findAll, type Range } from "../lib/findReplace";
import { FindReplaceBar } from "./FindReplaceBar";
```
- Add state:
```typescript
const [findOpen, setFindOpen] = useState(false);
const [findReplaceMode, setFindReplaceMode] = useState(false); // shows the replace row
const [findText, setFindText] = useState("");
const [replaceText, setReplaceText] = useState("");
const [caseSensitive, setCaseSensitive] = useState(false);
const [wholeWord, setWholeWord] = useState(false);
const [matchIndex, setMatchIndex] = useState(0);
```
- Derive matches from the editor's current text:
```typescript
const docText = tiptapEditor?.state.doc.textBetween(0, tiptapEditor?.state.doc.content.size ?? 0, " ") ?? "";
const matches: Range[] = findOpen && findText ? findAll(docText, findText, { caseSensitive, wholeWord }) : [];
```
- Add navigation that jumps the ProseMirror selection to the match and scrolls it into view:
```typescript
const jumpTo = (i: number) => {
  if (!tiptapEditor || matches.length === 0) return;
  const idx = ((i % matches.length) + matches.length) % matches.length;
  const { from, to } = matches[idx];
  tiptapEditor.commands.setTextSelection({ from: from + 1, to: to + 1 }); // +1 for ProseMirror text offset convention
  const view = tiptapEditor.view;
  view.dispatch(view.state.tr.scrollIntoView());
  setMatchIndex(idx);
};
const next = () => jumpTo(matchIndex + 1);
const prev = () => jumpTo(matchIndex - 1);
```
- Add replace handlers. Replace-one swaps the current match's text; replace-all iterates back-to-front:
```typescript
const replaceOne = () => {
  if (!tiptapEditor || matches.length === 0) return;
  const { from, to } = matches[matchIndex];
  tiptapEditor.chain().focus().deleteRange({ from: from + 1, to: to + 1 }).insertContentAt(from + 1, replaceText).run();
  editor.markDirty();
};
const replaceAll = () => {
  if (!tiptapEditor || matches.length === 0) return;
  // Back-to-front to keep earlier offsets valid.
  const view = tiptapEditor.view;
  let tr = view.state.tr;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { from, to } = matches[i];
    tr = tr.delete(from + 1, to + 1).insertText(replaceText, from + 1);
  }
  view.dispatch(tr);
  editor.markDirty();
};
```
- Add keybindings in the existing keydown effect (Cmd+F, Cmd+G, Cmd+H):
```typescript
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
  e.preventDefault();
  setFindOpen(true);
  setFindReplaceMode(false);
  // seed find with current selection
  if (tiptapEditor && !tiptapEditor.state.selection.empty) {
    setFindText(tiptapEditor.state.doc.textBetween(tiptapEditor.state.selection.from, tiptapEditor.state.selection.to, " "));
  }
  return;
}
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
  e.preventDefault();
  setFindOpen(true);
  setFindReplaceMode(true);
  return;
}
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
  if (findOpen) { e.preventDefault(); e.shiftKey ? prev() : next(); return; }
}
```
- Render the bar above the editor surface (and only in WYSIWYG mode). Inside the `editor.mode === "wysiwyg"` toolbar conditional block, or just below `EditorTopBar`:
```typescript
{findOpen && editor.mode === "wysiwyg" && (
  <FindReplaceBar
    findText={findText}
    replaceText={replaceText}
    onFindChange={(v) => { setFindText(v); setMatchIndex(0); }}
    onReplaceChange={setReplaceText}
    matchCount={matches.length}
    matchIndex={matches.length === 0 ? -1 : Math.min(matchIndex, matches.length - 1)}
    onNext={next}
    onPrev={prev}
    onReplaceOne={findReplaceMode ? replaceOne : undefined as any}
    onReplaceAll={findReplaceMode ? replaceAll : undefined as any}
    onClose={() => setFindOpen(false)}
  />
)}
```
  (The replace row's buttons still render but are inert when not in replace mode; for v1 simplicity keep them always visible. If `findReplaceMode` is false, hide the replace row via the `replaceText` field being present — simplest is to always show it. Adjust the test if needed, but the test already asserts both rows present.)

- [ ] **Step 2: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorView.tsx
git commit -m "feat(find): wire find/replace into the editor (Cmd+F/G/H, nav, replace)"
```

---

## Phase 4: Templates

### Task 4.1: templates library

**Files:**
- Create: `src/lib/templates.ts`
- Create: `src/lib/templates.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/templates.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { TEMPLATES, getTemplate } from "./templates";

describe("templates", () => {
  it("includes a Blank template with minimal body", () => {
    const blank = getTemplate("blank");
    expect(blank).toBeDefined();
    expect(blank!.body.trim()).toMatch(/^#\s/);
  });

  it("every template has an id, title, and non-empty body starting with a heading", () => {
    for (const t of TEMPLATES) {
      expect(t.id.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.trim().length).toBeGreaterThan(0);
      expect(t.body.trim()).toMatch(/^#\s/);
    }
  });

  it("meeting-notes template contains Agenda and uses bullets (not - [ ] tasks)", () => {
    const m = getTemplate("meeting-notes");
    expect(m!.body).toMatch(/agenda/i);
    expect(m!.body).not.toContain("- [ ]");
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/templates.ts`:
```typescript
export interface Template {
  id: string;
  title: string;
  body: string; // MDX source
}

/// Bundled local templates. Each starts with a top-level heading so the
/// serializer/parser treat it as a normal document. Action items use plain
/// bullets (the serializer supports bulletList today; task-list `- [ ]`
/// round-trip is a future addition).
export const TEMPLATES: Template[] = [
  {
    id: "blank",
    title: "Blank",
    body: "# Untitled\n\n",
  },
  {
    id: "meeting-notes",
    title: "Meeting notes",
    body: `# Meeting — {Date}

<Callout type="info">Attendees: add names here.</Callout>

## Agenda

- Topic one
- Topic two
- Topic three

## Notes

- 

## Action items

- Owner — action — due date
`,
  },
  {
    id: "blog-post",
    title: "Blog post",
    body: `# {Title}

Intro paragraph that hooks the reader.

## The point

First argument.

## Why it matters

<Quote>A pull quote that frames the takeaway.</Quote>

## Wrapping up

Closing thought.
`,
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    body: `# Week of {Date}

<StatGroup stats="[{&quot;label&quot;:&quot;Wins&quot;,&quot;value&quot;:&quot;3&quot;},{&quot;label&quot;:&quot;Learned&quot;,&quot;value&quot;:&quot;5&quot;}]" />

## Wins

- 

## Learned

- 

## Next week

- 
`,
  },
  {
    id: "readme",
    title: "README / project doc",
    body: `# {Project}

One-line description.

## Overview

What this is and why.

## Install

\`\`\`bash
# install steps
\`\`\`

## Usage

\`\`\`bash
# example command
\`\`\`
`,
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m "feat(templates): bundled local template catalog"
```

### Task 4.2: TemplatePicker component

**Files:**
- Create: `src/components/TemplatePicker.tsx`
- Create: `src/components/TemplatePicker.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/TemplatePicker.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplatePicker } from "./TemplatePicker";

describe("TemplatePicker", () => {
  it("renders every template title", () => {
    render(<TemplatePicker onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Meeting notes")).toBeInTheDocument();
    expect(screen.getByText("Blog post")).toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();
  });

  it("calls onPick with the template id", () => {
    const onPick = vi.fn();
    render(<TemplatePicker onPick={onPick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Meeting notes"));
    expect(onPick).toHaveBeenCalledWith("meeting-notes");
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<TemplatePicker onPick={vi.fn()} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/TemplatePicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/components/TemplatePicker.tsx`:
```typescript
import { TEMPLATES } from "../lib/templates";

interface Props {
  onPick: (templateId: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ onPick, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 460, maxWidth: "92vw", maxHeight: "82vh", overflow: "auto", padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Choose a template</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              style={{
                textAlign: "left", background: "var(--bg-muted)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer", fontFamily: "var(--font-sans)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.title}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {t.body.split("\n").slice(1, 2).join(" ").slice(0, 60) || "Start from scratch"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/TemplatePicker.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TemplatePicker.tsx src/components/TemplatePicker.test.tsx
git commit -m "feat(templates): TemplatePicker modal"
```

### Task 4.3: Seed document from template + wire into new-note/new-file

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/VaultDashboard.tsx`
- Modify: `src/components/EmptyState.tsx`
- Modify: `src/components/EditorView.tsx` (insert-into-current)

- [ ] **Step 1: Add the template picker to App for new-note + new-file**

In `src/App.tsx`:
- `import { TemplatePicker } from "./components/TemplatePicker";`
- `import { getTemplate } from "./lib/templates";`
- Add state: `const [templatePickerOpen, setTemplatePickerOpen] = useState(false);` and a ref to remember the destination: `const templateTarget = useRef<"note" | "file" | null>(null);`
- Change `handleNewNote` so the FIRST thing it does is open the picker instead of prompting for a title:
```typescript
const startNewNote = () => { templateTarget.current = "note"; setTemplatePickerOpen(true); };
const startNewFile = () => { templateTarget.current = "file"; setTemplatePickerOpen(true); };
const handlePickTemplate = async (templateId: string) => {
  const tmpl = getTemplate(templateId);
  setTemplatePickerOpen(false);
  const target = templateTarget.current;
  templateTarget.current = null;
  if (target === "note") {
    if (!vault.vaultPath) return;
    const title = window.prompt("Note title", "Untitled");
    if (!title) return;
    const path = await vault.createNote(title);
    if (path) await seedTemplate(path, tmpl?.body ?? "# Untitled\n\n");
  } else {
    // single-file new then seed
    const path = await open.createNew();
    if (path) await seedTemplate(path, tmpl?.body ?? "# Untitled\n\n");
  }
};
```
- Add the seed helper near `handleNewNote` (reuses the save pipeline):
```typescript
const seedTemplate = async (path: string, mdx: string) => {
  const { compileMdx } = await import("./lib/compile");
  const compiled = await compileMdx(mdx);
  await invoke("save_document", { path, contentMd: mdx, compiledJs: compiled, manifest: { version: 1, capabilities: [], origin_domain: null, signature: null } });
  await open.openRecent(path);
  open.openEditor();
};
```
  (Note: `createNew` in `useOpenDocument` returns the path — verify its signature with `grep -n "createNew" src/hooks/useOpenDocument.ts` and adapt if it returns void; if void, call `open.createNew()` then read `open.path` after it resolves.)
- Render the picker (near the other modals at the bottom):
```typescript
{templatePickerOpen && <TemplatePicker onPick={handlePickTemplate} onClose={() => setTemplatePickerOpen(false)} />}
```
- Change the `VaultDashboard` `onNewNote` prop from `handleNewNote` to `startNewNote`, and the `EmptyState` `onNew` prop from `open.createNew` to `startNewFile`.

- [ ] **Step 2: Add "insert template at cursor" in EditorView**

In `src/components/EditorView.tsx`:
- `import { TemplatePicker } from "./TemplatePicker";` and `import { getTemplate } from "../lib/templates";`
- Add state `const [templateInsertOpen, setTemplateInsertOpen] = useState(false);`
- Add handler:
```typescript
const handleInsertTemplate = (id: string) => {
  setTemplateInsertOpen(false);
  const tmpl = getTemplate(id);
  if (!tmpl || !tiptapEditor) return;
  const parsed = parseMdxToDoc(tmpl.body).json.content ?? [];
  tiptapEditor.commands.focus();
  tiptapEditor.commands.insertContent(parsed);
  editor.markDirty();
};
```
- Render `{templateInsertOpen && <TemplatePicker onPick={handleInsertTemplate} onClose={() => setTemplateInsertOpen(false)} />}`.
- Add a "Templates…" entry. The `EditorToolbar` exposes an `onInsert(template)` for the slash menu. Add a button to `EditorToolbar` that calls a new prop `onOpenTemplates: () => void`, and pass `onOpenTemplates={() => setTemplateInsertOpen(true)}` from EditorView.

- [ ] **Step 3: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass. If `VaultDashboard.test.tsx`/`EmptyState.test.tsx` assert the old props, update them (they pass `onNewNote`/`onNew` as `vi.fn()` — unchanged since the callbacks still fire; the only change is which handler App passes, which the component tests don't observe).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/VaultDashboard.tsx src/components/EmptyState.tsx src/components/EditorView.tsx src/components/EditorToolbar.tsx
git commit -m "feat(templates): new-from-template in vault + single-file + insert-into-current"
```

---

## Phase 5: PDF / Print Export

### Task 5.1: print library + stylesheet

**Files:**
- Create: `src/lib/print.ts`
- Create: `src/lib/print.test.ts`
- Create: `src/theme/print.css`

- [ ] **Step 1: Write the failing test**

`src/lib/print.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { printDocument, PRINT_HIDDEN_CLASS } from "./print";

describe("print", () => {
  it("exposes the no-print class constant", () => {
    expect(PRINT_HIDDEN_CLASS).toBe("no-print");
  });

  it("printDocument calls window.print", () => {
    const spy = vi.fn();
    Object.defineProperty(window, "print", { value: spy, configurable: true, writable: true });
    printDocument();
    expect(spy).toHaveBeenCalledOnce();
  });
});
```
Add `import { vi } from "vitest";` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/print.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/print.ts`:
```typescript
/// The CSS class marking elements hidden in print output. Document/editor
/// chrome adds this; print.css hides them under @media print.
export const PRINT_HIDDEN_CLASS = "no-print";

/// Trigger the OS print dialog (the user picks "Save as PDF" for export).
/// Call AFTER any print-prep; no-op if window.print is unavailable.
export function printDocument(): void {
  if (typeof window !== "undefined" && typeof window.print === "function") {
    window.print();
  }
}
```

`src/theme/print.css`:
```css
@media print {
  :root { --bg: #ffffff; --text: #000000; }
  body { background: #fff !important; color: #000 !important; }

  /* Hide every chrome element marked no-print. */
  .no-print { display: none !important; }

  /* Expand the document to a clean page. */
  .prizma-print-root, .ProseMirror {
    max-width: none !important;
    padding: 0 !important;
  }

  /* Avoid breaking inside code blocks / callouts / tables. */
  pre, .callout, table, .component-card { break-inside: avoid; }

  @page { margin: 2cm; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/print.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/print.ts src/lib/print.test.ts src/theme/print.css
git commit -m "feat(print): printDocument helper + print stylesheet"
```

### Task 5.2: Import print.css + Export button in editor

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/EditorTopBar.tsx`
- Modify: `src/components/EditorView.tsx`

- [ ] **Step 1: Import the stylesheet**

In `src/main.tsx`, add (next to the other CSS imports): `import "./theme/print.css";`

- [ ] **Step 2: Add the Export button to EditorTopBar**

In `src/components/EditorTopBar.tsx`, add `onExport: () => void;` to the Props interface, destructure it, and add a button between the gear and the Save button:
```typescript
<button
  onClick={onExport}
  title="Export to PDF / Print"
  className="no-print"
  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, padding: "4px 8px" }}
>
  🖨
</button>
```

- [ ] **Step 3: Wire from EditorView + mark chrome no-print**

In `src/components/EditorView.tsx`:
- `import { printDocument } from "../lib/print";`
- Pass `onExport={() => printDocument()}` to `<EditorTopBar … />`.
- Add `className="no-print"` to: the `EditorToolbar`, both `CollapsiblePane` usages (Files + Nav), the AI panel `CollapsiblePane`, and the `DocStatsBar` (already has it). The outermost container and the editor surface stay printable.
  - For `CollapsiblePane`, check whether it accepts a `className` prop; if not, wrap each in `<div className="no-print" style={{ display: "flex" }}>…</div>` OR add an optional `className` prop to `CollapsiblePane`. Prefer adding the prop (1-line change).

- [ ] **Step 4: tsc + tests + visual (emulated print media)**

Run: `npx tsc --noEmit && npx vitest run`
Then visual:
```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 832 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.getByText('First time? Read the welcome document').click();
  await p.waitForTimeout(400);
  await p.hover('[data-testid=hover-zone]');
  await p.waitForTimeout(200);
  await p.click(\"button:has-text('Edit')\");
  await p.waitForTimeout(700);
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(200);
  const toolbarVisible = await p.evaluate(() => {
    const el = document.querySelector('.no-print');
    return el ? getComputedStyle(el).display : 'none-found';
  });
  console.log('no-print element display under print media:', toolbarVisible);
  await p.screenshot({ path: 'scripts/shots/print-export.png' });
  await b.close();
})();
"
```
Expected: a `.no-print` element reports `display: none` under print media.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/components/EditorTopBar.tsx src/components/EditorView.tsx src/components/CollapsiblePane.tsx
git commit -m "feat(print): Export button + no-print chrome marking"
```

### Task 5.3: Print option in viewer mode

**Files:**
- Modify: `src/components/HoverControls.tsx`
- Modify: `src/components/DocumentView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a Print action to HoverControls + mark viewer chrome no-print**

In `src/components/HoverControls.tsx`, accept a new prop `onPrint: () => void` and add a "🖨 Print" button next to the existing Share/Edit buttons. In `src/components/DocumentView.tsx`, add `className="no-print"` to the `HoverControls`/`TrustFooter` wrappers (the rendered document canvas stays printable). Pass `onPrint={() => printDocument()}` from `App.tsx` to `<DocumentView … />` (add the prop to DocumentView's interface and forward to HoverControls).

- [ ] **Step 2: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass. Update `HoverControls.test.tsx` base props if it asserts the exact button set.

- [ ] **Step 3: Commit**

```bash
git add src/components/HoverControls.tsx src/components/DocumentView.tsx src/App.tsx
git commit -m "feat(print): print option in viewer mode + viewer no-print marking"
```

---

## Final Verification

### Task F.1: Full sweep

- [ ] **Step 1: Run everything**

Run:
```bash
cd "/Volumes/Main External/Development/PrizmaPage"
npx tsc --noEmit
npm test
cd src-tauri && cargo build
```
Expected: tsc clean; all vitest tests pass (145 baseline + ~25 new); cargo build green (Rust unchanged).

### Task F.2: Headless walkthrough

- [ ] **Step 1: Exercise all five features**

Run `node scripts/shot.mjs` (or the inline harnesses from each phase) and confirm:
- Stats bar shows a non-zero word count.
- Spellcheck toggle flips the attribute.
- Cmd+F bar opens, a query present in the doc shows a match count, Next jumps the selection.
- Template picker seeds "Agenda" into a new note.
- Print media hides `.no-print`.

### Task F.3: Spec coverage audit

- [ ] **Step 1: Verify each spec section shipped**

| Spec section | Verified by |
|---|---|
| §3 PDF/print (print.css, export btn, viewer) | Tasks 5.1–5.3 |
| §4 Spellcheck (toggle + persist + apply) | Tasks 2.1–2.2 |
| §5 Find & replace (find/replace, nav, toggles, keys) | Tasks 3.1–3.3 |
| §6 Doc statistics (words/chars/time + selection) | Tasks 1.1–1.3 |
| §7 Templates (catalog, picker, seed, insert) | Tasks 4.1–4.3 |

---

## Self-Review Notes

**Scope discipline:** No Rust changes — all five features reuse `save_document`/`new_document`/`vault_create_note`. Templates use supported bullet/ordered lists only (task-list round-trip deferred; documented).

**Find/replace offset convention:** ProseMirror text positions and the plain-text offsets from `textBetween` differ at block boundaries. The `+1` fudge in `jumpTo`/`replaceOne` is the known approximation; if live testing shows off-by-one on multi-paragraph docs, the fix is to build matches against a single-space-joined text and map offsets through the same `textBetween(..., " ")` join. Flagged for the test phase.

**Keyboard conflicts:** Cmd+F/G/H are added to the existing keydown effect; they `preventDefault` to override the browser's native find. Cmd+Shift+F (vault search), Cmd+K (palette), Cmd+1/2/3 (panes), Cmd+S (save) are untouched.

**Task-list serializer:** explicitly NOT changed in v1 — templates avoid `- [ ]`. A future task can add `taskList`/`taskItem` cases to `serializer.ts`.
