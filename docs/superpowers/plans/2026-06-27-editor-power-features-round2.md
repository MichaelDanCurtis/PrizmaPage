# Editor Power Features (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) tracking.

**Goal:** Five Phase-7 polish features: task-list round-trip, smart paste, auto-save + draft recovery, keyboard-shortcuts reference, outline quick-jump. All frontend-only (no Rust changes).

**Architecture:** Five independent features, TDD. Order: task lists (1) first because it closes a Round-1-deferred item and templates depend on it; shortcuts catalog (4) + outline jump (5) are leaf; smart paste (2) and auto-save (3) wire into the editor.

**Tech Stack:** React 18, TypeScript, TipTap v2, Vitest + React Testing Library, headless-Chrome harness.

**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-round2-design.md`

**Baseline (verified):** `npx tsc --noEmit` clean; `npm test` 176 pass; `cargo build` green.

---

## Phase 1: Task List Round-Trip

### Task 1.1: Install TaskList extensions

- [ ] **Step 1: Install**

Run: `npm install @tiptap/extension-task-list @tiptap/extension-task-item`
Expected: installs.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: TipTap TaskList + TaskItem extensions"
```

### Task 1.2: Serializer taskList/taskItem round-trip

**Files:** `src/registry/serializer.ts`, `src/registry/serializer.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/registry/serializer.test.ts`:
```typescript
  it("round-trips an unchecked task list (- [ ])", () => {
    const mdx = "- [ ] buy milk\n- [ ] walk dog\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a checked task (- [x])", () => {
    const mdx = "- [x] done thing\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a mixed checked/unchecked list", () => {
    const mdx = "- [ ] a\n- [x] b\n- [ ] c\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("does not confuse tasks with bullets", () => {
    const mdx = "- bullet\n- [ ] task\n";
    const doc = parseMdxToDoc(mdx);
    const out = serializeDoc(doc).trim();
    expect(out).toContain("- bullet");
    expect(out).toContain("- [ ] task");
  });
```

- [ ] **Step 2: Run — FAIL** (`npx vitest run src/registry/serializer.test.ts`)

- [ ] **Step 3: Implement parsing (before the bullet branch)**

In `src/registry/serializer.ts`, in the line-loop, insert a task branch **before** the `if (line.startsWith("- "))` bullet branch:
```typescript
    // Task list.
    if (/^- \[[ xX]\] /.test(line)) {
      const items: DocNode[] = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i])) {
        const checked = /^- \[[xX]\] /.test(lines[i]);
        items.push({
          type: "taskItem",
          attrs: { checked },
          content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^- \[[ xX]\] /, "")) }],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }
```
And update `isBlockStart` to also return true for `/^- \[[ xX]\] /`.

- [ ] **Step 4: Implement serialization**

Add cases in the block serializer (near `case "bulletList"`):
```typescript
      case "taskList": {
        return (node.content ?? []).map((c) => serializeBlock(c)).join("");
      }
      case "taskItem": {
        const checked = node.attrs?.checked === true;
        const inner = (node.content ?? []).map((c) => serializeBlock(c)).join("").trimEnd();
        return `- ${checked ? "[x]" : "[ ]"} ${inner}\n`;
      }
```
(Confirm the exact serializer dispatch shape by reading the existing `bulletList`/`listItem` cases first and mirroring them.)

- [ ] **Step 5: Run — PASS** (4 new tests).

- [ ] **Step 6: Commit**
```bash
git add src/registry/serializer.ts src/registry/serializer.test.ts
git commit -m "feat(serializer): task list (- [ ] / - [x]) round-trip"
```

### Task 1.3: Register TaskList in WysiwygSurface + toolbar toggle

**Files:** `src/components/WysiwygSurface.tsx`, `src/components/EditorToolbar.tsx`

- [ ] **Step 1: Register extensions**

In `src/components/WysiwygSurface.tsx`:
```typescript
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
```
Add to the `extensions` array (after `StarterKit`):
```typescript
      TaskList,
      TaskItem.configure({ nested: true }),
```

- [ ] **Step 2: Add checklist toggle to the list dropdown**

In `src/components/EditorToolbar.tsx`, inside the list `Dropdown`, add a `MenuRow`:
```typescript
            <MenuRow
              icon="☐"
              label="Checklist"
              onClick={() => { editor.chain().focus().toggleTaskList().run(); close(); }}
            />
```

- [ ] **Step 3: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: type `- [ ] x` in raw mode, switch to WYSIWYG, confirm a checkbox renders; click it, switch to raw, confirm `- [x] x`.
```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel:'chrome', headless:true });
  const p = await (await b.newContext({viewport:{width:1280,height:832}})).newPage();
  await p.goto('http://localhost:5173',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
  await p.getByText('First time? Read the welcome document').click(); await p.waitForTimeout(500);
  await p.hover('[data-testid=hover-zone]'); await p.waitForTimeout(250);
  await p.click(\"button:has-text('Edit')\"); await p.waitForTimeout(700);
  // Use the checklist menu
  await p.click('button:has-text(\"☰\")'); await p.waitForTimeout(150);
  await p.click('div:has-text(\"Checklist\")'); await p.waitForTimeout(200);
  await p.keyboard.type('a task'); await p.waitForTimeout(200);
  const hasCheckbox = await p.evaluate(() => !!document.querySelector('.ProseMirror ul[data-type=taskList] input[type=checkbox], .ProseMirror ul[data-type=taskList]'));
  console.log('taskList rendered:', hasCheckbox);
  await b.close();
})();
"
```
Expected: `taskList rendered: true`.

- [ ] **Step 4: Commit**
```bash
git add src/components/WysiwygSurface.tsx src/components/EditorToolbar.tsx
git commit -m "feat(editor): register TaskList + checklist toolbar toggle"
```

### Task 1.4: Update meeting-notes template to use tasks

**Files:** `src/lib/templates.ts`, `src/lib/templates.test.ts`

- [ ] **Step 1: Update template + test**

In `src/lib/templates.ts`, change meeting-notes "Action items" body lines from `- Owner — action — due date` to `- [ ] Owner — action — due date`. In `src/lib/templates.test.ts`, the assertion `expect(m!.body).not.toContain("- [ ]")` must now flip — replace it with an assertion that action items use tasks: `expect(m!.body).toContain("- [ ] Owner");`.

- [ ] **Step 2: Run — PASS**
```bash
npx vitest run src/lib/templates.test.ts src/registry/serializer.test.ts
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m "feat(templates): meeting action items now use checklists"
```

---

## Phase 2: Smart Paste

### Task 2.1: smartPaste classifier

**Files:** `src/lib/smartPaste.ts`, `src/lib/smartPaste.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { isUrl, isLikelyMarkdown, classifyPaste, type PasteInput } from "./smartPaste";

describe("smartPaste", () => {
  it("isUrl detects URLs", () => {
    expect(isUrl("https://example.com")).toBe(true);
    expect(isUrl("http://foo.bar/baz")).toBe(true);
    expect(isUrl("not a url")).toBe(false);
    expect(isUrl("see below")).toBe(false);
  });

  it("isLikelyMarkdown detects markdown signals", () => {
    expect(isLikelyMarkdown("# heading")).toBe(true);
    expect(isLikelyMarkdown("- item\n- item2")).toBe(true);
    expect(isLikelyMarkdown("1. ordered")).toBe(true);
    expect(isLikelyMarkdown("**bold**")).toBe(true);
    expect(isLikelyMarkdown("`code`")).toBe(true);
    expect(isLikelyMarkdown("[link](http://x)")).toBe(true);
    expect(isLikelyMarkdown("just a plain sentence.")).toBe(false);
  });

  it("caps markdown conversion at 4KB", () => {
    const big = "# h\n" + "x".repeat(5000);
    expect(isLikelyMarkdown(big)).toBe(false); // over cap → treated as plain
  });

  it("classifies URL-over-selection as link", () => {
    const out = classifyPaste({ text: "https://x.com", html: null, hasSelection: true });
    expect(out).toBe("link");
  });

  it("classifies markdown plain-text as markdown", () => {
    const out = classifyPaste({ text: "# hi\n- a", html: null, hasSelection: false });
    expect(out).toBe("markdown");
  });

  it("classifies HTML as html (defer to TipTap)", () => {
    const out = classifyPaste({ text: "x", html: "<p>x</p>", hasSelection: false });
    expect(out).toBe("html");
  });

  it("classifies plain text as plain", () => {
    const out = classifyPaste({ text: "hello there", html: null, hasSelection: false });
    expect(out).toBe("plain");
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
export type PasteStrategy = "plain" | "html" | "markdown" | "link";
export interface PasteInput { text: string; html: string | null; hasSelection: boolean; }

const MARKDOWN_CAP = 4096;

export function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

export function isLikelyMarkdown(s: string): boolean {
  if (s.length > MARKDOWN_CAP) return false;
  return /^#{1,6}\s/m.test(s)
    || /^[*+-]\s/m.test(s)
    || /^\d+\.\s/m.test(s)
    || /\*\*[^*]+\*\*/.test(s)
    || /`[^`]+`/.test(s)
    || /\[[^\]]+\]\([^)]+\)/.test(s);
}

/// Decide how to handle a paste event. Order: URL-over-selection → link;
/// HTML present → html (TipTap default); markdown-looking plain text → markdown;
/// else plain.
export function classifyPaste(input: PasteInput): PasteStrategy {
  const { text, html, hasSelection } = input;
  if (hasSelection && isUrl(text)) return "link";
  if (html) return "html";
  if (isLikelyMarkdown(text)) return "markdown";
  return "plain";
}
```

- [ ] **Step 4: Run — PASS** (7 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/smartPaste.ts src/lib/smartPaste.test.ts
git commit -m "feat(paste): classifyPaste — url-link/markdown/html/plain strategy"
```

### Task 2.2: Wire handlePaste into WysiwygSurface

**Files:** `src/components/WysiwygSurface.tsx`

- [ ] **Step 1: Add handlePaste to editorProps**

In `src/components/WysiwygSurface.tsx`, import:
```typescript
import { classifyPaste } from "../lib/smartPaste";
import { parseMdxToDoc } from "../registry/serializer";
```
Add `editorProps.handlePaste`:
```typescript
    editorProps: {
      attributes: { spellcheck: spellcheck ? "true" : "false" },
      handlePaste: (view, event) => {
        const cd = event.clipboardData;
        if (!cd) return false;
        const text = cd.getData("text/plain");
        const html = cd.getData("text/html") || null;
        const { empty } = view.state.selection;
        const strategy = classifyPaste({ text, html, hasSelection: !empty });

        if (strategy === "link") {
          // Wrap the current selection as a link to the pasted URL.
          event.preventDefault();
          const mark = view.state.schema.marks.link.create({ href: text.trim() });
          view.dispatch(view.state.tr.addMark(view.state.selection.from, view.state.selection.to, mark));
          return true;
        }
        if (strategy === "markdown") {
          event.preventDefault();
          const parsed = parseMdxToDoc(text).json.content ?? [];
          view.dispatch(view.state.tr.replaceSelectionWith(parsed as any));
          return true;
        }
        return false; // html/plain → TipTap default
      },
    },
```
Note: the `link` mark must exist (it does — `@tiptap/extension-link` is registered). If `replaceSelectionWith` with an array of nodes is awkward, fall back to inserting each block via `tr.insert`. Test live and adjust.

- [ ] **Step 2: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: select a word, paste a URL, confirm it becomes a link (`<a>` in the DOM); paste `# hi\n- a` into empty space, confirm a heading + list appear.
```bash
node -e "
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ channel:'chrome', headless:true });
  const p = await (await b.newContext({viewport:{width:1280,height:832}})).newPage();
  await p.goto('http://localhost:5173',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
  await p.getByText('First time? Read the welcome document').click(); await p.waitForTimeout(500);
  await p.hover('[data-testid=hover-zone]'); await p.waitForTimeout(250);
  await p.click(\"button:has-text('Edit')\"); await p.waitForTimeout(800);
  // Simulate paste of markdown via the DataTransfer API
  const dt = await p.evaluateHandle(() => new DataTransfer());
  await p.evaluate((d) => { d.setData('text/plain', '# Hello\\n- one\\n- two'); }, dt);
  await p.dispatchEvent('.ProseMirror', 'paste', { clipboardData: dt });
  await p.waitForTimeout(300);
  const hasH = await p.evaluate(() => !!document.querySelector('.ProseMirror h1'));
  const hasList = await p.evaluate(() => !!document.querySelector('.ProseMirror ul'));
  console.log('paste markdown -> h1:', hasH, 'ul:', hasList);
  await b.close();
})();
"
```
Expected: `paste markdown -> h1: true ul: true`.

- [ ] **Step 3: Commit**
```bash
git add src/components/WysiwygSurface.tsx
git commit -m "feat(paste): smart paste — URL auto-link + markdown conversion"
```

---

## Phase 3: Auto-Save + Draft Recovery

### Task 3.1: draftStore

**Files:** `src/lib/draftStore.ts`, `src/lib/draftStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { writeDraft, readDraft, clearDraft } from "./draftStore";

beforeEach(() => localStorage.clear());

describe("draftStore", () => {
  it("round-trips a draft", () => {
    writeDraft("/x/note.mdxz", "# hi", 1000);
    expect(readDraft("/x/note.mdxz")).toEqual({ contentMd: "# hi", ts: 1000 });
  });

  it("returns null when no draft", () => {
    expect(readDraft("/x/none.mdxz")).toBeNull();
  });

  it("clearDraft removes it", () => {
    writeDraft("/x/n.mdxz", "a", 1);
    clearDraft("/x/n.mdxz");
    expect(readDraft("/x/n.mdxz")).toBeNull();
  });

  it("ignores corrupt drafts", () => {
    localStorage.setItem("prizma.draft./x/bad.mdxz", "{not json");
    expect(readDraft("/x/bad.mdxz")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
export interface Draft { contentMd: string; ts: number; }

const key = (path: string) => `prizma.draft.${path}`;

export function writeDraft(path: string, contentMd: string, ts: number): void {
  try { localStorage.setItem(key(path), JSON.stringify({ contentMd, ts })); } catch { /* quota */ }
}
export function readDraft(path: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(path));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.contentMd === "string" && typeof d.ts === "number") return d;
    return null;
  } catch { return null; }
}
export function clearDraft(path: string): void {
  localStorage.removeItem(key(path));
}
```

- [ ] **Step 4: Run — PASS** (4 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/draftStore.ts src/lib/draftStore.test.ts
git commit -m "feat(autosave): draftStore — localStorage draft write/read/clear"
```

### Task 3.2: useAutoSave hook

**Files:** `src/hooks/useAutoSave.ts`, `src/hooks/useAutoSave.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutoSave } from "./useAutoSave";

beforeEach(() => localStorage.clear());

describe("useAutoSave", () => {
  it("does not save immediately when dirty turns true", () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: false, enabled: true, save }));
    act(() => { result.current.notifyEdit(); });
    expect(save).not.toHaveBeenCalled();
  });

  it("saves after the debounce window", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: true, save }));
    act(() => { result.current.notifyEdit(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(save).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does nothing when disabled", async () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: false, save }));
    act(() => { result.current.notifyEdit(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
import { useCallback, useEffect, useRef } from "react";

interface Args { dirty: boolean; enabled: boolean; save: () => void; delayMs?: number; }

/// Schedules a debounced save `delayMs` after each edit notification, but only
/// when `enabled` and `dirty`. Call `notifyEdit()` on every editor change.
export function useAutoSave({ dirty, enabled, save, delayMs = 3000 }: Args) {
  const timer = useRef<number | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const notifyEdit = useCallback(() => {
    if (!enabled || !dirty) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveRef.current(); }, delayMs);
  }, [enabled, dirty, delayMs]);

  // Reset the debounce when dirty flips to false (just saved).
  useEffect(() => {
    if (!dirty && timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, [dirty]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  return { notifyEdit };
}
```

- [ ] **Step 4: Run — PASS** (3 tests).

- [ ] **Step 5: Commit**
```bash
git add src/hooks/useAutoSave.ts src/hooks/useAutoSave.test.ts
git commit -m "feat(autosave): useAutoSave — debounced save scheduler"
```

### Task 3.3: Wire auto-save + draft banner into EditorView

**Files:** `src/components/EditorView.tsx`, `src/components/DraftBanner.tsx`

- [ ] **Step 1: Create DraftBanner**

`src/components/DraftBanner.tsx`:
```typescript
interface Props { onRestore: () => void; onDiscard: () => void; }
export function DraftBanner({ onRestore, onDiscard }: Props) {
  return (
    <div className="no-print" style={{ padding: "6px 14px", background: "var(--accent-soft)", borderBottom: "1px solid var(--accent-border)", display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "var(--text)", fontFamily: "var(--font-sans)" }}>
      <span>⚠ Unsaved draft found for this document.</span>
      <button onClick={onRestore} style={{ fontSize: 11, padding: "3px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Restore</button>
      <button onClick={onDiscard} style={{ fontSize: 11, padding: "3px 10px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Discard</button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into EditorView**

In `src/components/EditorView.tsx`:
- Imports: `import { useAutoSave } from "../hooks/useAutoSave";`, `import { readDraft, clearDraft, writeDraft } from "../lib/draftStore";`, `import { DraftBanner } from "./DraftBanner";`
- Auto-save pref: `const autosaveEnabled = localStorage.getItem("prizma.editor.autosave") !== "0";`
- `const { notifyEdit } = useAutoSave({ dirty: editor.dirty, enabled: autosaveEnabled, save: handleSave });`
- Draft state: `const [draft, setDraft] = useState(() => readDraft(path));`
- Draft write: add to `handleChange` — after `editor.markDirty()`, also `writeDraft(path, serializeDoc(newDoc), Date.now()); notifyEdit();` (and the same for the raw-mode onChange).
- Draft restore handler:
```typescript
const restoreDraft = () => {
  if (!draft) return;
  setDoc(parseMdxToDoc(draft.contentMd));
  setRawSource(draft.contentMd);
  editor.markDirty();
  setDraft(null);
};
const discardDraft = () => { clearDraft(path); setDraft(null); };
```
- Clear draft on save: in `handleSave`, after `editor.markSaved()`, add `clearDraft(path);`.
- Render the banner above the editor surface (and below the top bar):
```typescript
{draft && <DraftBanner onRestore={restoreDraft} onDiscard={discardDraft} />}
```

- [ ] **Step 3: tsc + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + pass.

- [ ] **Step 4: Commit**
```bash
git add src/components/DraftBanner.tsx src/components/EditorView.tsx
git commit -m "feat(autosave): wire debounced auto-save + draft recovery banner"
```

---

## Phase 4: Keyboard Shortcuts Reference

### Task 4.1: shortcuts catalog

**Files:** `src/lib/shortcuts.ts`, `src/lib/shortcuts.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./shortcuts";

describe("shortcuts", () => {
  it("every entry has a group, keys, and description", () => {
    for (const s of SHORTCUTS) {
      expect(s.group.length).toBeGreaterThan(0);
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
  it("includes the core ones", () => {
    const all = SHORTCUTS.map(s => s.keys).join(" ");
    expect(all).toMatch(/Cmd\+S/i);     // save
    expect(all).toMatch(/Cmd\+F/i);     // find
    expect(all).toMatch(/Cmd\/|Cmd\+\//i); // shortcuts help
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`src/lib/shortcuts.ts`:
```typescript
export interface Shortcut { group: string; keys: string; description: string; }
const M = "Cmd"; // display; works for Ctrl on Windows/Linux too.

export const SHORTCUTS: Shortcut[] = [
  { group: "File", keys: `${M}+S`, description: "Save" },
  { group: "Edit", keys: `${M}+Z`, description: "Undo" },
  { group: "Edit", keys: `${M}+Shift+Z`, description: "Redo" },
  { group: "Edit", keys: `${M}+B`, description: "Bold" },
  { group: "Edit", keys: `${M}+I`, description: "Italic" },
  { group: "Edit", keys: `${M}+/`, description: "Show keyboard shortcuts" },
  { group: "Find", keys: `${M}+F`, description: "Find" },
  { group: "Find", keys: `${M}+H`, description: "Replace" },
  { group: "Find", keys: `${M}+G`, description: "Next / previous match" },
  { group: "View", keys: `${M}+1`, description: "Toggle files pane" },
  { group: "View", keys: `${M}+2`, description: "Toggle outline/backlinks/graph pane" },
  { group: "View", keys: `${M}+3`, description: "Toggle AI pane" },
  { group: "View", keys: `${M}+K`, description: "AI command palette" },
  { group: "View", keys: `${M}+Shift+F`, description: "Search vault" },
  { group: "Navigate", keys: `${M}+Shift+O`, description: "Jump to heading" },
];
```

- [ ] **Step 4: Run — PASS** (2 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/shortcuts.ts src/lib/shortcuts.test.ts
git commit -m "feat(shortcuts): shortcuts catalog (single source)"
```

### Task 4.2: ShortcutsDialog + wire Cmd+/

**Files:** `src/components/ShortcutsDialog.tsx`, `src/components/EditorTopBar.tsx`, `src/components/EditorView.tsx`

- [ ] **Step 1: Create ShortcutsDialog**

`src/components/ShortcutsDialog.tsx`:
```typescript
import { SHORTCUTS } from "../lib/shortcuts";
const GROUPS = [...new Set(SHORTCUTS.map(s => s.group))];
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 460, maxWidth: "92vw", maxHeight: "82vh", overflow: "auto", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Keyboard shortcuts</div>
        {GROUPS.map(g => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", marginBottom: 6 }}>{g}</div>
            {SHORTCUTS.filter(s => s.group === g).map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text)", padding: "3px 0" }}>
                <span>{s.description}</span>
                <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 6px" }}>{s.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Cmd+/ keybinding + ? button**

In `src/components/EditorView.tsx`: add `const [shortcutsOpen, setShortcutsOpen] = useState(false);`, render `{shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}`, and in the main keydown effect add (before the Cmd+1/2/3 block):
```typescript
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
```
In `src/components/EditorTopBar.tsx`: add `onShowShortcuts: () => void` prop + a `?` button (before the gear). Pass `onShowShortcuts={() => setShortcutsOpen(true)}` from EditorView.

- [ ] **Step 3: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: press Cmd+/ (use Control+/ in the harness), confirm the dialog lists shortcuts.

- [ ] **Step 4: Commit**
```bash
git add src/components/ShortcutsDialog.tsx src/components/EditorTopBar.tsx src/components/EditorView.tsx
git commit -m "feat(shortcuts): Cmd+/ reference dialog + top-bar ? button"
```

---

## Phase 5: Outline Quick-Jump

### Task 5.1: outlineJump filter helper

**Files:** `src/lib/outlineJump.ts`, `src/lib/outlineJump.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { filterHeadings, type Heading } from "./outlineJump";

const hs: Heading[] = [
  { level: 1, text: "Intro", pos: 1 },
  { level: 2, text: "Setup", pos: 50 },
  { level: 2, text: "Usage", pos: 100 },
  { level: 1, text: "Conclusion", pos: 200 },
];

describe("filterHeadings", () => {
  it("returns all for empty query", () => {
    expect(filterHeadings(hs, "").length).toBe(4);
  });
  it("case-insensitive substring match", () => {
    expect(filterHeadings(hs, "usage").map(h => h.text)).toEqual(["Usage"]);
  });
  it("matches multiple", () => {
    expect(filterHeadings(hs, "s").length).toBe(3); // Setup, Usage, Conclu*s*ion... wait
  });
  it("returns empty for no match", () => {
    expect(filterHeadings(hs, "zzz")).toEqual([]);
  });
});
```
Note: the `"s"` test counts Setup, Usage, Conclu**s**ion = 3. Adjust if needed.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
export interface Heading { level: number; text: string; pos: number; }

export function filterHeadings(headings: Heading[], query: string): Heading[] {
  const q = query.trim().toLowerCase();
  if (!q) return headings;
  return headings.filter(h => h.text.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run — PASS** (adjust the count test to match actual = 3).

- [ ] **Step 5: Commit**
```bash
git add src/lib/outlineJump.ts src/lib/outlineJump.test.ts
git commit -m "feat(outline): filterHeadings helper for quick-jump"
```

### Task 5.2: OutlineJump component + Cmd+Shift+O

**Files:** `src/components/OutlineJump.tsx`, `src/components/EditorView.tsx`

- [ ] **Step 1: Create OutlineJump**

`src/components/OutlineJump.tsx`:
```typescript
import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { filterHeadings, type Heading } from "../lib/outlineJump";

interface Props { editor: Editor | null; onJump: (pos: number) => void; onClose: () => void; }

export function OutlineJump({ editor, onJump, onClose }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const headings: Heading[] = useMemo(() => {
    if (!editor) return [];
    const out: Heading[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        out.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });
    return out;
  }, [editor, q]); // re-derive when the query changes (cheap)

  const filtered = filterHeadings(headings, q);
  const go = (h: Heading) => { onJump(h.pos); onClose(); };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120, zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 480, maxWidth: "92vw", maxHeight: "60vh", overflow: "auto", padding: 12 }}>
        <input ref={inputRef} value={q} placeholder="Jump to heading…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) go(filtered[0]); }} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, color: "var(--text)", background: "var(--bg)", marginBottom: 8 }} />
        {filtered.map((h, i) => (
          <div key={i} onClick={() => go(h)} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--text)", paddingLeft: 10 + (h.level - 1) * 12, borderRadius: "var(--radius-sm)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            {h.text}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)" }}>No matching headings.</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire Cmd+Shift+O + render**

In `src/components/EditorView.tsx`: add `const [outlineJumpOpen, setOutlineJumpOpen] = useState(false);`, import `OutlineJump`. In the keydown effect (the Cmd+Shift+F block area), add:
```typescript
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setOutlineJumpOpen(true);
        return;
      }
```
Render `{outlineJumpOpen && <OutlineJump editor={tiptapEditor} onJump={(pos) => { tiptapEditor?.chain().focus().setTextSelection(pos + 1).scrollIntoView().run(); }} onClose={() => setOutlineJumpOpen(false)} />}`.

- [ ] **Step 3: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: press Control+Shift+O, type a heading prefix present in the welcome doc, Enter, confirm the cursor jumps.

- [ ] **Step 4: Commit**
```bash
git add src/components/OutlineJump.tsx src/components/EditorView.tsx
git commit -m "feat(outline): Cmd+Shift+O quick-jump to heading"
```

---

## Final Verification

### Task F.1: Full sweep
- [ ] `npx tsc --noEmit` clean; `npm test` all pass (176 baseline + ~20 new); `cd src-tauri && cargo build` green.

### Task F.2: Headless walkthrough
- [ ] Task list round-trips (raw `- [ ]` ↔ checkbox ↔ `- [x]`).
- [ ] Smart paste: URL→link, markdown→nodes.
- [ ] Auto-save fires after 3s idle; draft banner restore works.
- [ ] Cmd+/ opens shortcuts; Cmd+Shift+O jumps headings.

### Task F.3: Spec coverage audit
| Spec section | Verified by |
|---|---|
| §3 Task list | Tasks 1.1–1.4 |
| §4 Smart paste | Tasks 2.1–2.2 |
| §5 Auto-save + draft | Tasks 3.1–3.3 |
| §6 Shortcuts reference | Tasks 4.1–4.2 |
| §7 Outline quick-jump | Tasks 5.1–5.2 |

---

## Self-Review Notes

- **TipTap command return values:** `insertContent`/`toggleTaskList` return booleans; the smart-paste `replaceSelectionWith` with a node array may need a per-block insert fallback — test live, adjust.
- **handlePaste markdown insert:** uses `tr.replaceSelectionWith` with parsed nodes; if the schema rejects a block, fall back to inserting text. Flagged for live test.
- **Auto-save + manual save coexist:** Cmd+S calls the same `handleSave`; the auto-save timer is cleared on `dirty=false`. No double-save because the timer is reset on each edit and cleared on save.
- **Draft key uses the full path** — distinct per document; the key includes the path verbatim (paths are filesystem-safe).
- **Keyboard conflicts:** Cmd+/ and Cmd+Shift+O are new; neither collides with existing bindings (Cmd+Shift+F search, Cmd+K palette).
