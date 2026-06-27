# Round 2 — Editor Power Features (Phase 7 polish, cont.)

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-round2-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-editor-power-features-round2.md`

## Roadmap position (the "re-U" checkpoint)

Architecture §12 Phase 7 = "Polish (code completion, autocomplete, spell check, editor power features)." Round 1 closed spelling/stats/find/export; Round 2 closed the remaining editor-power gaps an audit confirmed missing. All five pass the Word-document-useful + Phase-7-fit gate.

## What shipped (5 features)

1. **Task list `- [ ]` round-trip** — TipTap `TaskList`/`TaskItem` registered; serializer parses `- [ ]`/`- [x]` into `taskList`/`taskItem` (with `checked` attrs) and serializes back; the bullet branch no longer greedily eats task lines. Checklist toggle in the list dropdown; meeting-notes action items now use checklists. **Closes the item Round 1 explicitly deferred.** (`src/registry/serializer.ts`, `src/components/WysiwygSurface.tsx`)
2. **Smart paste** — `classifyPaste` decides per paste: URL-over-selection → link; markdown-looking plain text → nodes (per-block, fault-tolerant); HTML → TipTap default; else plain. 4KB markdown cap. (`src/lib/smartPaste.ts`, wired via `handlePaste`)
3. **Auto-save + draft recovery** — `useAutoSave` schedules a save 3s after an edit (reschedules on new edits, cleared on save). `draftStore` snapshots `contentMd`+`ts` to localStorage per path; a `DraftBanner` offers Restore/Discard when a draft is present on open. Both WYSIWYG and raw edits write drafts + arm the timer. (`src/hooks/useAutoSave.ts`, `src/lib/draftStore.ts`, `src/components/DraftBanner.tsx`)
4. **Keyboard shortcuts reference** — single-source `SHORTCUTS` catalog feeds a grouped `ShortcutsDialog` opened by Cmd+/ and a `?` button in the top bar. Every existing binding is now discoverable. (`src/lib/shortcuts.ts`, `src/components/ShortcutsDialog.tsx`)
5. **Outline quick-jump** — Cmd+Shift+O fuzzy heading picker reusing TocPanel's extraction; typing filters, Enter/click jumps the ProseMirror selection + scrolls. Completes the mouse-only TOC with keyboard nav. (`src/components/OutlineJump.tsx`, `src/lib/outlineJump.ts`)

## Verification

- **Vitest:** 205 pass (was 176 at Round-2 start → **+29 new**). TypeScript clean.
- **Rust:** `cargo build` green (all five features are frontend-only).
- **Live + real-editor integration tests:**
  - Task list: editor HTML confirms `data-type=taskList`/`taskItem` with `data-checked` attrs + checkboxes; toggle command present.
  - Smart paste: `# Paste Head\n- a\n- b` → `<h1>` + `<ul>` confirmed live.
  - Shortcuts: Cmd+/ opens the grouped dialog.
  - Outline jump: picker lists headings, fuzzy-filters by "Welcome" (5 matches in the welcome doc).
  - Auto-save: `useAutoSave` timer + `draftStore` round-trip unit-tested.

## Bugs caught during verification (not by mocks)

1. **False-pass trap on task lists** — the first round-trip test asserted only string equality; `- [ ] x` parsed as a **bullet** with text `[ ] x` and round-tripped identically, passing vacuously. Strengthened to assert the semantic `taskList` type — which then correctly failed and drove real implementation. (The recurring "mocks prove internal consistency, not correctness" lesson from Phase 5.)
2. **Greedy bullet branch** — after the task branch was added, `- bullet\n- [ ] task` still parsed as one bullet list because the bullet branch consumed the task line. Fixed by excluding task lines from the bullet branch.
3. **jsdom + TipTap node views** — the TaskList node view's `<li>` children don't render into jsdom's DOM, so a DOM-query test reported 0 items while `editor.getHTML()` showed them. Switched the integration test to assert on the editor's HTML output (authoritative).

## Scope notes

- **No Rust changes** — all five reuse existing commands.
- **Markdown-paste cap 4KB** — avoids untested large-paste perf; HTML pastes defer to TipTap.
- **Auto-save + manual save coexist** — Cmd+S and the debounced timer both call `handleSave`; the timer is cleared when `dirty` flips false, so no double-save.
- **Single-file new-from-template** still deferred from Round 1 (hook state-machine) — unchanged.

## Commit chain

5 feature commits + 1 integration-test commit, all on `layer2a/editor-foundation`.

## Cumulative Phase-7 progress (Rounds 1 + 2)

10 Phase-7 polish features delivered across two rounds: stats, spellcheck, find/replace, templates, PDF/print (R1); task lists, smart paste, auto-save/draft, shortcuts reference, outline quick-jump (R2). Frontend test count: 145 → 205 (+60). All live- or integration-verified.
