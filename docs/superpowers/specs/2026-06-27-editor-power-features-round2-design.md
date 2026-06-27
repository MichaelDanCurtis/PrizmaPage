# Editor Power Features (Round 2) — Design

> **Status:** Design (pending user review)
> **Date:** 2026-06-27
> **Roadmap position:** Phase 7 polish (architecture §12) — five sub-features, Round 2.
> **Predecessor:** Round 1 (`docs/superpowers/notes/round1-editor-power-features.md`) shipped stats, spellcheck, find/replace, templates, PDF/print.
> **Scope:** Five more word-processor affordances that complete the Phase-7 surface: task lists, smart paste, auto-save, a shortcuts reference, and outline quick-jump. Each is independently valuable.

## 0. Roadmap evaluation (the "re-U" checkpoint)

Architecture §12 Phase 7 names "code completion, autocomplete, spell check, editor power features." Round 1 closed the spelling/stats/find/export gap; Round 2 closes the remaining editor-power gaps an audit confirmed missing: checklists (explicitly deferred in Round 1 notes), paste handling (none today), auto-save (manual-only today), shortcut discoverability (shortcuts exist but are invisible), and keyboard outline navigation (TOC is mouse-only). All five are Word-document-useful and confirmed absent. They pass the roadmap gate.

## 1. Goals

1. **Task list `- [ ]` round-trip** — checkbox lists parse and serialize; the editor renders interactive checkboxes; checking one persists.
2. **Smart paste** — pasting a bare URL into selected text wraps it as a link; pasting markdown text converts it to the right nodes instead of dumping raw markdown.
3. **Auto-save / draft recovery** — a debounced auto-save when the doc is dirty + a localStorage draft snapshot so a crash/close never loses work; on reopen, offer to restore.
4. **Keyboard shortcuts reference** — Cmd+/ (and a help menu entry) opens an overlay listing every shortcut.
5. **Outline quick-jump** — Cmd+Shift+O opens a fuzzy heading picker (like VS Code's symbol nav) that jumps the cursor to the chosen heading.

## 2. Non-goals

- Collaborative comments / annotations (later phase).
- Version-history snapshot backend (needs storage; post-Phase-7).
- Full table cell editing (the render-only `Table.tsx` stays; editing is a later phase).
- Drag-to-reorder blocks (DnD library; later).
- .docx export (PDF + the existing format cover sharing; .docx is a new surface).

## 3. Feature 1 — Task list round-trip

### 3.1 Approach
Install `@tiptap/extension-task-list` + `@tiptap/extension-task-item`, register them in `WysiwygSurface` (so the editor renders `<ul data-type="taskList">` with clickable checkboxes). Extend the serializer to parse `- [ ]` / `- [x]` into `taskList`/`taskItem` nodes and emit them back.

### 3.2 Serializer changes (`serializer.ts`)
- Parse: a new block branch ahead of the bullet branch — lines starting with `- [ ]` → `taskItem` with `checked: false`; `- [x]`/`- [X]` → `checked: true`. Consecutive task lines group into one `taskList`.
- Serialize: a `case "taskList"` emits its `taskItem` children as `- [ ]`/`- [x]`; `case "taskItem"` emits the inner paragraph text.
- The `isBlockStart` helper gains `- [ ]`/`- [x]` recognition.

### 3.3 Toolbar
A checkbox button in the list dropdown ("☐ Checklist"). Toggles `taskList`.

### 3.4 Templates
Once supported, the meeting-notes template's action items can switch from `- ` to `- [ ]`. (Done as a follow-on edit after the serializer lands — validates the round-trip end-to-end.)

## 4. Feature 2 — Smart paste

### 4.1 Approach
Add `editorProps.handlePaste` to `WysiwygSurface`:
- If the clipboard has `text/html`, defer to TipTap's default (it already converts HTML → nodes well).
- If the clipboard is `text/plain` AND the plain text looks like markdown (heuristic: contains `- `, `#`, `**`, `` ` ``, `[`, `1.`), parse it via `parseMdxToDoc` and insert the resulting nodes. Otherwise default (plain text).
- **URL auto-link:** if the selection is non-empty and the clipboard is a single URL, wrap the selection in a link to that URL (the classic "select text, paste URL → link" affordance).

### 4.2 Scope
Single-line markdown and small blocks only. Pasting a 500-line markdown file is best-effort (the parser handles it, but perf is untested at that scale — a guard caps paste-conversion at ~4KB).

## 5. Feature 3 — Auto-save + draft recovery

### 5.1 Auto-save
A debounced effect in `EditorView`: when `editor.dirty` becomes true, start a 3-second timer; on fire, call `handleSave` (the existing Cmd+S path). Reset on each new edit. Typing pauses ≥3s save automatically. A subtle "saved" indicator already exists via `editor.saving`/`markSaved`.

### 5.2 Draft recovery
On every edit (debounced 1s), write a JSON draft to `localStorage` keyed by the doc path: `{ contentMd, ts }`. On opening a doc, compare the draft's `ts` to the file's mtime; if the draft is newer, show a small banner "Unsaved draft found — Restore / Discard." Restore seeds the editor from the draft; Discard clears it. On successful save, clear the draft.

### 5.3 Toggle
A Settings → Appearance (or a new "Editor" section) toggle "Auto-save" (default on), persisted at `prizma.editor.autosave`.

## 6. Feature 4 — Keyboard shortcuts reference

### 6.1 Approach
A `ShortcutsDialog` component — a centered modal listing every shortcut in grouped rows (File, Edit, Format, View, Find, AI). Opened by Cmd+/ and a "Keyboard shortcuts" entry in the settings gear menu / a `?` button in the top bar. Escape/backdrop closes.

### 6.2 Source
A `shortcuts.ts` constant array (single source) so the dialog and any future in-app hints share it. Each row: keys (display) + description.

## 7. Feature 5 — Outline quick-jump (Cmd+Shift+O)

### 7.1 Approach
A `OutlineJump` component reusing `TocPanel`'s heading extraction (extract headings + PM positions from the live editor). A modal with a search input; typing filters headings by fuzzy/substring match; Enter/click jumps the selection to the heading and closes. Opens via Cmd+Shift+O (distinct from Cmd+Shift+F vault search).

## 8. Testing & verification

### 8.1 Unit (Vitest)
- `serializer` — round-trip `- [ ]` and `- [x]` (checked/unchecked, mixed with bullets, nested text).
- `smartPaste` — `classifyPaste(plain, html, hasSelection)` returns the right strategy; `isLikelyMarkdown(text)` heuristic; URL detection.
- `autoSave` — `useAutoSave` schedules/clears a timer on dirty changes; draft write/read/clear round-trips in localStorage.
- `shortcuts` — `SHORTCUTS` has well-formed entries (keys + description, grouped).
- `outlineJump` — `filterHeadings(headings, query)` returns fuzzy matches; empty query returns all.

### 8.2 Visual (headless Chrome)
- Task list: type `- [ ]` raw → switch to WYSIWYG → checkbox renders → click it → raw shows `- [x]`.
- Smart paste: select a word, paste a URL → it becomes a link; paste markdown `# hi\n- a` into an empty doc → renders as heading + list.
- Auto-save: edit, wait 3s, confirm `save_document` invoked; draft written to localStorage; "restore" banner logic.
- Shortcuts: Cmd+/ opens dialog; rows present.
- Outline jump: Cmd+Shift+O opens picker; typing filters; Enter jumps.

### 8.3 Definition of done
1. All Vitest tests pass (existing + new); TypeScript clean.
2. Rust unchanged; cargo build green.
3. Headless walkthrough covers all five.
4. Task-list round-trips through save (the Round-1-deferred item is closed).

## 9. File-level summary

**New (frontend):**
- `src/lib/smartPaste.ts` (+ test) — `classifyPaste`, `isLikelyMarkdown`, `isUrl`.
- `src/hooks/useAutoSave.ts` (+ test) — debounced save scheduler.
- `src/lib/draftStore.ts` (+ test) — localStorage draft write/read/clear + mtime compare.
- `src/components/DraftBanner.tsx` — restore/discard banner.
- `src/lib/shortcuts.ts` (+ test) — `SHORTCUTS` catalog.
- `src/components/ShortcutsDialog.tsx` (+ test) — the reference modal.
- `src/components/OutlineJump.tsx` (+ test) — Cmd+Shift+O picker; `filterHeadings` helper in `src/lib/outlineJump.ts` (+ test).

**Modified (frontend):**
- `src/registry/serializer.ts` (+ test) — taskList/taskItem parse + serialize.
- `src/components/WysiwygSurface.tsx` — register TaskList/TaskItem; add `handlePaste`.
- `src/components/EditorToolbar.tsx` — checklist toggle in list dropdown.
- `src/components/EditorView.tsx` — wire auto-save, draft banner, shortcuts dialog, outline jump, Cmd+/ and Cmd+Shift+O keys.
- `src/components/EditorTopBar.tsx` — `?` help button.
- `src/lib/templates.ts` — meeting-notes action items → `- [ ]` (after serializer lands).
- `src/hooks/useEditorState.ts` — (no change; reuse dirty/saving).
- `index.html` — `save_document` mock already no-ops; no change needed.

**No Rust changes.**

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Task lists | TipTap TaskList + serializer | Native checkboxes; closes the Round-1-deferred item |
| Smart paste | heuristic markdown detect + URL auto-link | Covers the 90% case without a full markdown engine |
| Auto-save | debounced 3s on dirty + localStorage draft | Crash protection without a backend; matches Word |
| Shortcuts | single-source catalog + Cmd+/ | Discoverability; shortcuts already exist |
| Outline jump | reuse TocPanel extraction + Cmd+Shift+O | Small; completes mouse-only TOC |
| Markdown-paste cap | 4KB | Avoids untested large-paste perf |
