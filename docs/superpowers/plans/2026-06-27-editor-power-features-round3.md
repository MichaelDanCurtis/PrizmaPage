# Editor Power Features (Round 3, Phase 7 closing) Implementation Plan

> **For agentic workers:** superpowers:subagent-driven-development or executing-plans. Checkbox tracking.

**Goal:** Four Phase-7-closing features: focus/zen mode, raw-editor highlighting, word-count goal, HTML/Markdown export. All frontend-only.

**Architecture:** Four independent features, TDD. Order: leaf libs first (focus hook, goal, export builders), then wiring.

**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-round3-design.md`
**Baseline:** tsc clean; 205 tests pass; cargo build green.

---

## Phase 1: Raw-editor highlighting (smallest first)

### Task 1.1: Wrap CodeHighlight in RawEditor

**Files:** `src/components/RawEditor.tsx`

- [ ] **Step 1: Replace the textarea with CodeHighlight**

`src/components/RawEditor.tsx`:
```typescript
import { CodeHighlight } from "./CodeHighlight";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

/// Raw MDX source editor. Delegates to CodeHighlight (the Prism
/// backdrop+transparent-textarea editor already used by CodePeek) with the
/// jsx grammar — MDX is JSX-adjacent and jsx covers the markup well.
export function RawEditor({ value, onChange }: Props) {
  return (
    <div style={{ width: "100%", height: "100%", maxWidth: "var(--content-width)", margin: "0 auto", padding: "var(--content-padding)" }}>
      <CodeHighlight value={value} onChange={onChange} language="jsx" />
    </div>
  );
}
```

- [ ] **Step 2: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: open the editor, switch to Raw mode, confirm the MDX is syntax-highlighted (tokens colored via the editor CSS). If the highlight container sizing is off (CodeHighlight uses `flex: 1`), wrap so it fills height — the outer div above sets width/padding; confirm the inner fills. Adjust the wrapper height if needed.

- [ ] **Step 3: Commit**
```bash
git add src/components/RawEditor.tsx
git commit -m "feat(editor): syntax highlighting in the raw MDX editor (CodeHighlight)"
```

---

## Phase 2: Focus / Zen mode

### Task 2.1: useFocusMode hook

**Files:** `src/hooks/useFocusMode.ts`, `src/hooks/useFocusMode.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusMode } from "./useFocusMode";

beforeEach(() => localStorage.clear());

describe("useFocusMode", () => {
  it("defaults to off", () => {
    expect(renderHook(() => useFocusMode()).result.current.enabled).toBe(false);
  });
  it("toggles and persists", () => {
    const { result } = renderHook(() => useFocusMode());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem("prizma.editor.focus")).toBe("1");
  });
  it("reads persisted value on mount", () => {
    localStorage.setItem("prizma.editor.focus", "1");
    expect(renderHook(() => useFocusMode()).result.current.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
import { useCallback, useState } from "react";
const KEY = "prizma.editor.focus";
export function useFocusMode() {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(KEY) === "1");
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

- [ ] **Step 4: Run — PASS** (3). Commit.
```bash
git add src/hooks/useFocusMode.ts src/hooks/useFocusMode.test.ts
git commit -m "feat(focus): useFocusMode hook — toggle + persist"
```

### Task 2.2: Wire focus mode into EditorView + top-bar toggle + Cmd+.

**Files:** `src/components/EditorView.tsx`, `src/components/EditorTopBar.tsx`, `src/lib/shortcuts.ts`

- [ ] **Step 1: Add the hook + conditionals**

In `src/components/EditorView.tsx`:
- `import { useFocusMode } from "../hooks/useFocusMode";`
- `const focus = useFocusMode();`
- Gate the chrome: wrap the toolbar, the Files/Nav/AI `CollapsiblePane`s, and `DocStatsBar` in `{!focus.enabled && (...)}`. The top bar stays but passes `focusEnabled={focus.enabled}` so it can collapse to a thin strip. Keep the editor surface + find bar (find is useful in focus mode).

- [ ] **Step 2: Top-bar Focus button + collapse**

In `src/components/EditorTopBar.tsx`: add `focusEnabled: boolean` and `onToggleFocus: () => void` props. When `focusEnabled`, hide the toolbar-mode/save/sign/gear buttons (keep filename + a "← Exit focus" button). When not, show a 🎯 Focus button. Pass `focusEnabled={focus.enabled}` and `onToggleFocus={focus.toggle}` from EditorView.

- [ ] **Step 3: Cmd+. keybinding + shortcut entry**

In `EditorView`'s keydown effect (the Cmd+1/2/3 block), add: `if (e.key === ".") { e.preventDefault(); focus.toggle(); return; }`.
In `src/lib/shortcuts.ts`, add: `{ group: "View", keys: "Cmd+.", description: "Toggle focus mode" }`.

- [ ] **Step 4: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: press Cmd+. → chrome hides, doc fills; press again → restored.

- [ ] **Step 5: Commit**
```bash
git add src/components/EditorView.tsx src/components/EditorTopBar.tsx src/lib/shortcuts.ts
git commit -m "feat(focus): zen/focus mode (Cmd+.) hides chrome, doc fills the window"
```

---

## Phase 3: Word-count goal

### Task 3.1: GoalBar component

**Files:** `src/components/GoalBar.tsx`, `src/components/GoalBar.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalBar } from "./GoalBar";

beforeEach(() => localStorage.clear());

describe("GoalBar", () => {
  it("renders nothing when no goal set", () => {
    const { container } = render(<GoalBar words={10} goal={0} onSetGoal={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
  it("shows a progress fraction and bar", () => {
    render(<GoalBar words={25} goal={50} onSetGoal={vi.fn()} />);
    expect(screen.getByText(/25\s*\/\s*50/i)).toBeInTheDocument();
  });
  it("marks reached when words >= goal", () => {
    render(<GoalBar words={60} goal={50} onSetGoal={vi.fn()} />);
    expect(screen.getByText(/goal reached/i)).toBeInTheDocument();
  });
  it("clicking calls onSetGoal", () => {
    const onSetGoal = vi.fn();
    render(<GoalBar words={25} goal={50} onSetGoal={onSetGoal} />);
    fireEvent.click(screen.getByTitle(/set goal/i));
    expect(onSetGoal).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`src/components/GoalBar.tsx`:
```typescript
interface Props { words: number; goal: number; onSetGoal: () => void; }

export function GoalBar({ words, goal, onSetGoal }: Props) {
  if (!goal || goal <= 0) return null;
  const pct = Math.min(100, Math.round((words / goal) * 100));
  const reached = words >= goal;
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 14px", fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-sans)" }}>
      <span title="Set goal" onClick={onSetGoal} style={{ cursor: "pointer", textDecoration: "underline dotted" }}>
        {reached ? "🎯 Goal reached" : `${words} / ${goal}`}
      </span>
      <div style={{ flex: 1, maxWidth: 120, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: reached ? "#059669" : "var(--accent)", transition: "width 150ms" }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — PASS** (4). Commit.
```bash
git add src/components/GoalBar.tsx src/components/GoalBar.test.tsx
git commit -m "feat(goal): GoalBar — word-count target with progress + reached flash"
```

### Task 3.2: Wire GoalBar into EditorView

**Files:** `src/components/EditorView.tsx`

- [ ] **Step 1: Add goal state + render**

In `src/components/EditorView.tsx`:
- `import { GoalBar } from "./GoalBar";`
- `const [goal, setGoal] = useState<number>(() => Number(localStorage.getItem("prizma.editor.goal")) || 0);`
- A set-goal handler: `const editGoal = () => { const v = window.prompt("Word-count goal (0 to clear)", String(goal)); if (v !== null) { const n = Math.max(0, Number(v) || 0); setGoal(n); localStorage.setItem("prizma.editor.goal", String(n)); } };`
- Render `<GoalBar words={stats.words} goal={goal} onSetGoal={editGoal} />` just below the `DocStatsBar` (and gate it with `!focus.enabled` too).

- [ ] **Step 2: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: set a goal of 20 via the bar; the progress fills as the welcome doc (80 words) exceeds it → "Goal reached".

- [ ] **Step 3: Commit**
```bash
git add src/components/EditorView.tsx
git commit -m "feat(goal): wire GoalBar under the stats bar (persisted target)"
```

---

## Phase 4: HTML / Markdown export

### Task 4.1: export builders

**Files:** `src/lib/exportDoc.ts`, `src/lib/exportDoc.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { buildMarkdownExport, buildHtmlExport } from "./exportDoc";

describe("exportDoc", () => {
  it("buildMarkdownExport returns the source verbatim", () => {
    expect(buildMarkdownExport("# hi\n\ntext")).toBe("# hi\n\ntext");
  });
  it("buildHtmlExport wraps prose in a self-contained styled HTML doc", () => {
    const html = buildHtmlExport("# Title\n\nA paragraph.");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<style>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>A paragraph.</p>");
    // Headings + paragraphs converted (a minimal markdown→html).
  });
  it("buildHtmlExport escapes raw HTML in body text", () => {
    const html = buildHtmlExport("a <b>bold</b> line");
    // The literal <b> in source markdown is preserved as written (markdown allows inline html);
    // but a literal <script> should not survive as a script tag — verify it's text.
    expect(buildHtmlExport("see `<script>x</script>`")).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`src/lib/exportDoc.ts`:
```typescript
/// Markdown export: the document source, verbatim.
export function buildMarkdownExport(source: string): string {
  return source;
}

/// A minimal, dependency-free markdown→HTML for the prose layer, sufficient
/// for a readable standalone export (headings, paragraphs, bold/italic/code,
/// lists, links, code fences). Not a full markdown engine — the goal is a
/// handoff doc the recipient can read, not byte-perfect CommonMark.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(text: string): string {
  // Escape first, then re-apply inline markdown as HTML.
  let t = escapeHtml(text);
  // inline code (do before tags so their angle brackets are already escaped)
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let inFence = false;
  let codeBuf: string[] = [];
  const flushCode = () => { if (codeBuf.length) { out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`); codeBuf = []; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) { if (inFence) { flushCode(); inFence = false; } else { inFence = true; } i++; continue; }
    if (inFence) { codeBuf.push(line); i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inlineMd(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^[*+-]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[*+-]\s+/.test(lines[i])) { items.push(`<li>${inlineMd(lines[i].replace(/^[*+-]\s+/, ""))}</li>`); i++; }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (line.trim() === "") { i++; continue; }
    out.push(`<p>${inlineMd(line)}</p>`); i++;
  }
  flushCode();
  return out.join("\n");
}

/// HTML export: a self-contained styled document with the prose rendered.
export function buildHtmlExport(source: string): string {
  const body = markdownToHtml(source);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PrizmaPage document</title>
<style>
  body { font: 16px/1.7 -apple-system, "Inter", system-ui, sans-serif; color: #1a1a1a; max-width: 720px; margin: 40px auto; padding: 0 24px; }
  h1,h2,h3 { line-height: 1.25; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }
  code { font-family: "SF Mono", monospace; font-size: 0.9em; }
  a { color: #4f46e5; }
  @media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } pre { background: #161b22; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}
```

- [ ] **Step 4: Run — PASS** (3). Commit.
```bash
git add src/lib/exportDoc.ts src/lib/exportDoc.test.ts
git commit -m "feat(export): buildHtmlExport + buildMarkdownExport (standalone handoff docs)"
```

### Task 4.2: Export menu in EditorTopBar + wire from EditorView

**Files:** `src/components/EditorTopBar.tsx`, `src/components/EditorView.tsx`

- [ ] **Step 1: Add the export menu**

In `src/components/EditorTopBar.tsx`, replace the single `onExport` prop with `onExportPdf`, `onExportHtml`, `onExportMarkdown` callbacks (or keep `onExport` and add an `onExportFormat`). Simplest: change the 🖨 button into a small dropdown (reuse the `Dropdown` pattern, but that's in EditorToolbar — instead inline a tiny menu). 

Pragmatic: keep 🖨 as a dropdown trigger using a local `useState(open)` + an absolute flyout with three MenuRow-like divs: "PDF / Print", "HTML", "Markdown". Each calls the matching `onExport*` prop and closes.

- [ ] **Step 2: Wire from EditorView**

In `src/components/EditorView.tsx`:
- `import { save as saveDialog } from "@tauri-apps/plugin-dialog";`
- `import { buildHtmlExport, buildMarkdownExport } from "../lib/exportDoc";`
- Handlers:
```typescript
const exportMarkdown = async () => {
  const dst = await saveDialog({ defaultPath: filename.replace(/\.mdxz$/, ".md"), filters: [{ name: "Markdown", extensions: ["md"] }] });
  if (typeof dst === "string" && dst) {
    const src = editor.mode === "wysiwyg" ? serializeDoc(doc) : rawSource;
    await invoke("write_text_file", { path: dst, content: buildMarkdownExport(src) }).catch(() => {/* browser dev */});
  }
};
```
  (and analogously `exportHtml` with `buildHtmlExport`). Note: a `write_text_file` Rust command may not exist — for v1, in the browser harness use a Blob download fallback; under Tauri, add a minimal `write_text_file(path, content)` Rust command. **Check first:** `grep -n "fn write_text_file\|write_text" src-tauri/src/lib.rs`. If absent, either add the command (small) or use the Tauri `fs` plugin. Prefer adding the minimal Rust command (it's the clean path) — but that breaks the "no Rust changes" theme. Decision: use a frontend Blob download as the universal path (works in both browser and Tauri webview), avoiding a Rust command. Implement `downloadBlob(filename, content, mime)`.

Add `downloadBlob` to `src/lib/exportDoc.ts`:
```typescript
export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
```
Then `exportMarkdown` = `downloadBlob(filename.replace(/\.mdxz$/, ".md"), buildMarkdownExport(src), "text/markdown")` (no dialog needed — the browser/Tauri handles the save location via the download). Simpler and Rust-free.

- [ ] **Step 3: tsc + tests + visual**

Run: `npx tsc --noEmit && npx vitest run`
Visual: click 🖨 → menu shows 3 options; click Markdown → a download triggers (in headless, assert the menu items exist).

- [ ] **Step 4: Commit**
```bash
git add src/lib/exportDoc.ts src/lib/exportDoc.test.ts src/components/EditorTopBar.tsx src/components/EditorView.tsx
git commit -m "feat(export): HTML + Markdown file export via the 🖨 menu (Blob download)"
```

---

## Final Verification

- [ ] `npx tsc --noEmit` clean; `npm test` all pass (205 baseline + ~10 new); `cargo build` green.
- [ ] Headless walkthrough: raw highlighting, focus toggle (Cmd+.), goal bar, export menu (3 options).

## Self-Review Notes

- **RawEditor sizing:** CodeHighlight uses `flex:1`; the wrapper must give it height. Test live.
- **Focus mode + other modals:** find bar, settings, shortcuts stay available in focus (they're tools, not chrome). Only the panes/toolbar/stats hide.
- **Export Blob download:** works in browser dev and the Tauri webview (the OS handles the save dialog for downloads). Avoids a Rust command, keeping the round Rust-free.
- **markdownToHtml** is intentionally minimal — a readable handoff doc, not CommonMark. Documented in the spec.
