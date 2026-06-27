# Editor Power Features (Round 1) — Design

> **Status:** Design (pending user review)
> **Date:** 2026-06-27
> **Roadmap position:** Phase 7 polish (architecture §12) — five sub-features.
> **Scope:** Word-document-class authoring affordances that a Phase-7 polish pass requires and that are confirmed not yet built: PDF export, spellcheck surface, find & replace, document statistics, and templates. Each is independently valuable and ships behind its own toggle/entry point so partial adoption is safe.

## 0. Roadmap evaluation (the "re-U" checkpoint)

The architecture's build order (§12) reserves **Phase 7 = "Polish (code completion, autocomplete, spell check, editor power features)."** The codebase has built well past completion into vault workflows (SP8/SP9) but skipped several load-bearing Phase-7 *word-processor* affordances. The five features below are each:

- Word-document-useful (explicit objective criterion),
- Phase-7-aligned (spellcheck is named verbatim; the rest are "editor power features"), and
- Confirmed **absent** from the current codebase (searched before selection: no `print`/`exportPdf`, no find/replace, no word-count/stats bar, no template gallery, only the native `spellcheck="true"` HTML attribute — no spellcheck *UI*).

Therefore they meet "what we originally put in the roadmap." Non-goals (wikilink trust, DNS signing, remote MCP) are untouched.

## 1. Goals

1. **PDF / print export** — export the current document to PDF via the OS print dialog with a print stylesheet that drops editor chrome.
2. **Spellcheck surface** — a visible toolbar toggle for the editor's native spellcheck + a "check this selection" affordance; the native attribute alone is invisible to the user.
3. **Find & replace** — Cmd/Ctrl+F (find) and Cmd/Ctrl+H (replace) modal over the editor document with next/prev and replace-one/replace-all.
4. **Document statistics** — a live status bar: word count, character count, reading time, derived from the ProseMirror doc.
5. **Templates** — a "New from template" entry (meeting notes, blog post, weekly review, blank) feeding the existing create-note and new-document flows.

## 2. Non-goals

- Custom spellcheck dictionaries / multi-language dictionaries (use the webview's native dictionary; a per-language selector is a later refinement).
- PDF layout engine / custom pagination (the OS print path is the v1; a typeset export is a later phase).
- Regex / case-sensitive find toggles in v1 (plain substring find is enough for the word-processor baseline; toggles are additive).
- Template marketplace / online template sync (bundled local templates only).
- Outline/structure statistics beyond word/char/time (a richer "document info" panel is later).

## 3. Feature 1 — PDF / Print export

### 3.1 Approach
A toolbar/top-bar action "Export PDF" calls `window.print()`. A dedicated `print.css` (scoped under `@media print`) hides every `.no-print` element (toolbar, panes, AI panel, hover chrome, status bar) and expands the document to a clean, paginated page. The OS "Save as PDF" destination in the print dialog is the export path — no Rust PDF crate, no new binary dep.

### 3.2 Print fidelity
- `@media print` resets: white background, black text, `--content-width`-ish max-width, page margins via `@page { margin: 2cm; }`.
- Component library cards/callouts/printable; code blocks avoid page-break-inside.
- The viewer's `DocumentView` (recipient mode) ALSO gets print support so a shared doc can be printed — same `print.css`, same `.no-print` marking.

### 3.3 Entry points
- Editor top bar: a "🖨" button next to Save.
- Viewer `HoverControls` share button group: a "Print…" option (reuses `window.print()`).

## 4. Feature 2 — Spellcheck surface

### 4.1 Approach
The `WysiwygSurface` already sets `spellcheck="true"`. Add a **spellcheck toggle** in the rich toolbar (✓ABC) that flips a persisted preference (`prizma.editor.spellcheck`, default on) and reflects it onto the ProseMirror element's `spellcheck` attribute live. When off, the browser underline disappears. This makes an invisible capability a controllable feature.

### 4.2 Selection check
A "Check selection" affordance in the toolbar: when a non-empty selection exists, clicking it triggers `document.execCommand('spellcheck')`-equivalent is unavailable; instead the affordance is a no-op hint pointing the user to right-click (native). v1 keeps the toggle as the real feature and documents the selection path as native right-click. (This avoids a fragile custom spellcheck-engine.)

### 4.3 Persistence + dark mode
The toggle persists across sessions and re-applies on `WysiwygSurface` mount. Spelling-error underline color works in both themes (browser-managed).

## 5. Feature 3 — Find & Replace

### 5.1 Approach
A `FindReplaceBar` component (not a modal — a top-docked bar like VS Code) over the editor surface. Plain substring match against the document's concatenated text. Matches are highlighted via a TipTap `search`-style decoration is out of scope for v1 fragility; instead, v1 uses **selection-based navigation**: each "Next"/"Prev" jumps the ProseMirror selection to the next/prev occurrence (scroll into view). The current match is visually obvious because it is *selected*. Occurrence count shown ("3 / 12").

### 5.2 Replace
- **Replace** swaps the current (selected) match with the replacement text via a transaction.
- **Replace all** iterates all matches (back-to-front to keep positions valid) replacing each.
- Case-sensitive and whole-word toggles are included as a small toggle chip set (cheap, and avoids the "plain only" non-goal regret later). Default: case-insensitive.

### 5.3 Keybindings & scope
- Cmd/Ctrl+F → open Find (focus the find field; pre-fill with current selection if any).
- Cmd/Ctrl+G → next match; Shift+Cmd/Ctrl+G → prev match.
- Cmd/Ctrl+H → open Find+Replace (reveals the replace row).
- Escape closes the bar. Operates on the WYSIWYG editor only (raw mode shows a "switch to Write to find" hint); the raw `<textarea>` already has native find.

## 6. Feature 4 — Document statistics

### 6.1 Approach
A `DocStats` footer strip (single thin row under the editor surface, above `TrustFooter` or merged into it). Computed from `tiptapEditor.state.doc.textBetween(0, end, " ")` on every editor `update`. Shows: **words · characters · reading time** (`ceil(words/200)` min). Cheap O(n) per edit; debounced 150ms to avoid recomputing on every keystroke burst.

### 6.2 Reading time
`Math.max(1, Math.round(words / 200))` minutes; if `< 200` words show "<1 min". Standard word-processor convention.

### 6.3 Selection stats
When a selection is active, the strip shows selection word/char count in addition to the whole-doc count (e.g. "selected: 14 words"). Reuses the existing selection-tracking effect.

## 7. Feature 5 — Templates

### 7.1 Approach
A `templates.ts` module exporting a small catalog of bundled templates (title + MDX body). Entry points:
- **Vault new-note** (`VaultDashboard` "New" button): a popover/modal offers template choices before prompting for a title; the chosen template body seeds the new note instead of an empty doc.
- **Single-file new** (`EmptyState` "New"): same template picker.
- **Insert into current doc** (slash menu / + menu): a "Templates…" entry inserts the template body at the cursor (not creating a file).

### 7.2 Catalog (bundled, local)
- **Blank** — empty `# Title`.
- **Meeting notes** — agenda, attendees, notes, action items (uses `Callout` + plain bullet lists; the serializer handles `bulletList`/`orderedList` today — task-list `- [ ]` round-trip is a separate future addition, so action items use `- ` bullets in v1).
- **Blog post** — title, intro, sections, `Quote`.
- **Weekly review** — wins, learned, next week (uses `StatGroup` + lists).
- **README / project doc** — overview, install, usage, `CodeBlock`.

### 7.3 Seeding the note
`vault_create_note` currently writes a minimal empty `.mdxz`. The template flow: create the note, then immediately call `save_document` with the template body as `contentMd` + its compiled form. For single-file new, `new_document` then seed via save. This reuses the existing save pipeline (no new Rust command) — the template is author-time content like any other.

## 8. Testing & verification

### 8.1 Unit (Vitest)
- `print` — DOM test: adding `.no-print` rules hides elements; `@media print` presence verified by stylesheet assertion.
- `spellcheck` — `useSpellcheck` toggles the stored pref and the `WysiwygSurface` element attribute reflects it.
- `findReplace` — `findAll(text, query, opts)` returns correct match ranges incl. case/whole-word; `replaceInDoc(editor, ranges, replacement)` produces correct text.
- `docStats` — `computeStats(text)` returns correct words/chars/reading time for known inputs incl. empty, multi-space, CJK (chars).
- `templates` — `TEMPLATES` has title+body; `seedDocumentFromTemplate` calls save with the right args (mocked).

### 8.2 Visual (headless Chrome harness)
- Print: invoke print, assert `.no-print` elements have `display:none` under the print media query (emulate media).
- Spellcheck: toggle off → element `spellcheck` attr becomes `"false"`.
- Find: open bar, type a query present in the doc, assert match count + selection jumps on Next.
- Stats: assert the footer shows a non-zero word count after editing.
- Templates: open the picker, choose Meeting notes, assert the seeded editor content contains "Agenda".

### 8.3 Definition of done
1. All Vitest tests pass (existing baseline + new); TypeScript clean.
2. Rust unchanged (no new commands) — but cargo build still green.
3. Headless walkthrough covers all five features.
4. Each feature has its own toolbar/entry point reachable without a keyboard-only path (accessibility baseline).

## 9. File-level summary

**New (frontend):**
- `src/lib/print.ts` (+ test) — `printDocument()` wrapper + `PRINT_STYLES` constants for testability.
- `src/hooks/useSpellcheck.ts` (+ test) — toggle + persist + apply.
- `src/lib/findReplace.ts` (+ test) — `findAll`, `replaceRanges`, navigation helpers.
- `src/components/FindReplaceBar.tsx` (+ test) — the docked bar.
- `src/lib/docStats.ts` (+ test) — `computeStats`.
- `src/components/DocStatsBar.tsx` (+ test) — the status strip.
- `src/lib/templates.ts` (+ test) — `TEMPLATES` + `seedDocumentFromTemplate`.
- `src/components/TemplatePicker.tsx` (+ test) — picker modal/popover.
- `src/theme/print.css` — print stylesheet.

**Modified (frontend):**
- `src/components/EditorTopBar.tsx` — add 🖨 Export button + prop.
- `src/components/EditorToolbar.tsx` — add spellcheck toggle; add Find/Replace + Templates buttons (or rely on keys/menu).
- `src/components/WysiwygSurface.tsx` — apply spellcheck attr from `useSpellcheck`; mark `.no-print`.
- `src/components/EditorView.tsx` — host FindReplaceBar, DocStatsBar, TemplatePicker; wire keybindings (Cmd+F/G/H); print button handler; template-seed handlers.
- `src/components/DocumentView.tsx` + `HoverControls.tsx` — `.no-print` marking + print option in viewer.
- `src/components/VaultDashboard.tsx` + `src/components/EmptyState.tsx` — template picker on new-note/new-file.
- `src/main.tsx` — import `print.css`.
- `src/registry/serializer.ts` — (no change in v1; templates use supported bullet/ordered lists).

**No Rust changes** — all five features reuse existing commands (`save_document`, `new_document`, `vault_create_note`).

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF export | `window.print()` + print.css | No new binary; OS path is the universal PDF writer; matches "no bundled browser" ethos |
| Find UI | Selection-based nav, not ProseMirror decorations | Decorations are fragile; selection-jump is robust and visually obvious |
| Find toggles | case-sensitive + whole-word included | Cheap additive; avoids non-goal regret; plain default |
| Stats | footer strip, O(n) per edit debounced | Word-processor baseline; cheap enough at doc scale |
| Templates | bundled local, seed via save pipeline | Reuses author-time content path; no new format/command |
| Spellcheck | toggle on native attribute | Native dictionary is best-in-class; custom engine out of scope |
