# Round 6 — Implementation Plan

> superpowers:executing-plans. Checkbox tracking.

**Goal:** Five features: sub/sup, readability stats, export TOC, markdown import, version diff. All frontend-only.

**Spec:** `docs/superpowers/specs/2026-06-27-round6-features-design.md`
**Baseline:** tsc clean; 242 tests; cargo build green.

---

## Phase 1: Subscript / superscript

### Task 1.1: Install + register + serializer
- [ ] `npm install @tiptap/extension-subscript@^2.27.2 @tiptap/extension-superscript@^2.27.2`; verify v2.27.2.
- [ ] Register both in `WysiwygSurface` (after Underline).
- [ ] Serializer: extend `parseInline` for `<sub>`/`<sup>` and `serializeInline` to emit them. TDD round-trip tests (`H<sub>2</sub>O`, `x<sup>2</sup>`).
- [ ] tsc + tests + commit.

### Task 1.2: Toolbar buttons
- [ ] Add `X₂` (sub) + `X²` (sup) `TBtn`s in `EditorToolbar` inline-format group.
- [ ] tsc + tests + commit.

## Phase 2: Readability stats

### Task 2.1: readability lib
- [ ] TDD `computeReadability(text)` → `{ sentences, avgWordLength, fleschScore, topWords: [{word,count}] }`. ~5 tests.
- [ ] Commit.

### Task 2.2: Surface in DocStatsBar
- [ ] Add a clickable "details" affordance on `DocStatsBar` that expands to show the readability stats. Wire from EditorView.
- [ ] tsc + tests + commit.

## Phase 3: Export TOC

### Task 3.1: buildHtmlExport TOC
- [ ] In `exportDoc.ts`, collect headings during markdownToHtml, assign slug ids, prepend a `<nav>` TOC. Test asserts `<nav` + `href="#` present and heading `id` matches.
- [ ] tsc + tests + commit.

## Phase 4: Markdown import

### Task 4.1: import path
- [ ] `useOpenDocument` gains `importMarkdown()` — open dialog (`.md`/`.markdown`), read text, parse via `parseMdxToDoc`, set as a new unsaved doc. Wire from EditorTopBar "Import" button + EmptyState.
- [ ] tsc + tests + commit.

## Phase 5: Version diff

### Task 5.1: diff lib
- [ ] TDD `diffLines(old, new)` → array of `{ type: "add"|"del"|"eq", text }` (LCS-based). ~4 tests.
- [ ] Commit.

### Task 5.2: HistoryPanel compare
- [ ] Add a "Compare" button on each version that loads snapshot content + current content, renders the inline diff in the panel.
- [ ] tsc + tests + commit.

## Final Verification
- [ ] tsc clean; npm test all pass (242 baseline + new); cargo build green.
- [ ] Headless walkthrough.
