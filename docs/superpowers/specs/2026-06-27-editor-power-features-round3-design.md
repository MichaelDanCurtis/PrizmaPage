# Editor Power Features (Round 3, Phase 7 closing) — Design

> **Status:** Design (pending user review)
> **Date:** 2026-06-27
> **Roadmap position:** Phase 7 polish (architecture §12) — four sub-features, Round 3 (closing round for Phase 7).
> **Predecessors:** Round 1 + Round 2 (10 features shipped: stats, spellcheck, find/replace, templates, PDF/print, task lists, smart paste, auto-save/draft, shortcuts, outline jump).
> **Scope:** A deliberately tight round of four word-processor-core features that cleanly close Phase 7. The audit explicitly rejected extending to 5 — table editing, drag-to-reorder, comments, and multi-cursor belong to later phases (collaboration / rich-content), not "editor power features." Gold-plating stops here.

## 0. Roadmap evaluation (the "re-U" checkpoint)

Architecture §12 Phase 7 = "Polish (code completion, autocomplete, spell check, editor power features)." After Rounds 1–2 the editor-power surface is near saturation. The four features below are the last genuinely word-processor-core, Phase-7-fit, low-cost items confirmed missing. Each passes the Word-document-useful + Phase-7-fit gate; none pre-empts later roadmap phases.

## 1. Goals

1. **Focus / Zen / Typewriter mode** — a toggle that hides editor chrome (toolbar, side panes, stats bar) and keeps only the document, with optional typewriter-style caret-centering. Canonical in Word/Docs/iA Writer.
2. **Raw-editor syntax highlighting** — the raw MDX editor gets Prism highlighting (the `CodeHighlight` infrastructure already exists, just unwired from `CodePeek`).
3. **Word-count goal / target** — a session word-count goal with a live progress indicator, reusing the existing `docStats` count.
4. **HTML / Markdown file export** — export the current document as a standalone `.html` (rendered) or `.md` (source) file for handoff to non-PrizmaPage users.

## 2. Non-goals (deferred — confirmed not Phase 7)

- In-editor table editing (Phase 8/9 rich-content; render-only `Table.tsx` covers reads).
- Drag-to-reorder blocks (needs DnD library + serializer work).
- Comments / annotations (collaboration phase — multi-author by nature).
- Multi-cursor / select-next-occurrence (deep ProseMirror surgery; find/replace covers the practical case).
- CodeBlock language picker (niche; presentation component, not authoring surface).
- Reading ruler (accessibility niche).

## 3. Feature 1 — Focus / Zen mode

### 3.1 Approach
A `useFocusMode` toggle (persisted at `prizma.editor.focus`). When on, EditorView hides the toolbar, the Files/Nav/AI `CollapsiblePane`s, and the `DocStatsBar` via the existing `.no-print`-style conditional rendering — the document surface fills the window. The top bar collapses to a thin strip showing only the filename + a "Leave focus" button. A typewriter option (off by default) centers the caret vertically via scroll-on-update.

### 3.2 Entry points
- A "Focus" button in the top bar (🎯) that toggles the mode.
- Cmd/Ctrl+. toggles focus mode (a common binding; added to the shortcuts catalog).

## 4. Feature 2 — Raw-editor highlighting

### 4.1 Approach
`RawEditor` currently renders a bare `<textarea>`. Swap it for the existing `CodeHighlight` component (`language="jsx"` — MDX is JSX-adjacent and Prism's jsx grammar covers the markup). Zero new deps; the component already has scroll sync, the transparent-textarea trick, and matches the existing `RawEditor` props (`{value, onChange}`). `RawEditor` becomes a thin wrapper.

## 5. Feature 3 — Word-count goal

### 5.1 Approach
A small `GoalBar` component under the `DocStatsBar` (or merged into it). The user sets a session target (words); a thin progress bar fills as `docStats.words` approaches/exceeds it. Persisted at `prizma.editor.goal` (0 = no goal). A "set goal" affordance (click the bar → prompt for a number). When the goal is hit, a brief "🎯 Goal reached" flash.

### 5.2 Scope
Whole-document word count vs target (not per-session delta — simpler and matches Scrivener's "manuscript target"). No daily-reset tracking (that's a habit-tracking feature, later).

## 6. Feature 4 — HTML / Markdown export

### 6.1 Approach
Two Rust-free exports driven from the frontend:
- **`.md`** — write `serializeDoc(doc)` (the MDX source) to a save-as dialog (`@tauri-apps/plugin-dialog` `save()`), default name `<filename>.md`.
- **`.html`** — compile the MDX to a standalone HTML document: `compileMdx(source)` produces the component JS; wrap the **rendered prose** (the MDX stripped to plain markdown → a minimal HTML template with the prose + basic styling) into a self-contained `.html`. For v1, export the markdown-to-HTML conversion of the prose (not the full compiled mini-app — that needs the runtime). The recipient gets a readable, styled document.

### 6.2 Entry point
The existing 🖨 Export button becomes a small menu: **PDF / Print**, **HTML**, **Markdown**.

### 6.3 Testing constraint
Tauri's `save()` dialog doesn't exist in the browser harness, so the export logic is split: a pure `buildHtmlExport(markdownSource)` / `buildMarkdownExport(markdownSource)` function (unit-tested) produces the content; the dialog write is a thin shell.

## 7. Testing & verification

### 7.1 Unit (Vitest)
- `useFocusMode` — toggles + persists.
- `GoalBar` — renders progress; set/clear goal; reached flash.
- `buildMarkdownExport` — returns the source verbatim.
- `buildHtmlExport` — returns a self-contained HTML doc with the prose wrapped in a styled template.

### 7.2 Visual
- Focus mode: toggle → chrome hides, document fills; toggle off → restored.
- Raw editor: switch to Raw → syntax-highlighted MDX.
- Goal: set 50 words, type, bar fills; at 50 the flash shows.
- Export: open the export menu, the three options present.

### 7.3 Definition of done
1. All Vitest tests pass (existing + new); TypeScript clean.
2. Rust unchanged; cargo build green.
3. Phase 7 declared closed: the editor-power surface is complete.

## 8. File-level summary

**New (frontend):**
- `src/hooks/useFocusMode.ts` (+ test).
- `src/components/GoalBar.tsx` (+ test).
- `src/lib/exportDoc.ts` (+ test) — `buildHtmlExport`, `buildMarkdownExport`.

**Modified (frontend):**
- `src/components/RawEditor.tsx` — wrap `CodeHighlight`.
- `src/components/EditorView.tsx` — focus-mode conditionals + goal bar + export menu wiring + Cmd+. key.
- `src/components/EditorTopBar.tsx` — focus toggle button; export becomes a menu.
- `src/lib/shortcuts.ts` — add Focus (Cmd+.).

**No Rust changes.**

## 9. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Round size | 4, not 5 | Audit: 5th forces gold-plating into later-phase features |
| Focus mode | CSS/toggle + optional typewriter | Canonical word-processor feature; near-zero cost |
| Raw highlighting | reuse CodeHighlight | Infrastructure exists; zero new deps |
| Word goal | whole-doc target, persisted | Scrivener-like; reuses docStats; cheap |
| HTML export | prose markdown→HTML (not full mini-app) | Standalone readable doc without bundling the runtime |
| Phase 7 closure | declared after this round | Editor-power surface saturated; further items are later phases |
