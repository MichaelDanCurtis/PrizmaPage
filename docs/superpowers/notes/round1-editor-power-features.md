# Round 1 — Editor Power Features (Phase 7 polish)

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-editor-power-features.md`

## Roadmap position (the "re-U" checkpoint)

The architecture (§12) reserves **Phase 7 = "Polish (code completion, autocomplete, spell check, editor power features)."** The codebase had built well past completion into vault workflows (SP8/SP9) but skipped several load-bearing word-processor affordances. This round delivers five Phase-7 features, each Word-document-useful and confirmed absent before selection. They pass the roadmap gate.

## What shipped (5 features)

1. **Document statistics** — `computeStats` (words / characters / ceil reading-time at 200 wpm) + `DocStatsBar` status strip with live selection count. Recomputes on every editor update. (`src/lib/docStats.ts`, `src/components/DocStatsBar.tsx`)
2. **Spellcheck surface** — `useSpellcheck` toggle persists the pref; a `✓ABC` toolbar button flips the ProseMirror element's `spellcheck` attribute reactively (effect on prop change, since TipTap doesn't recreate the editor). (`src/hooks/useSpellcheck.ts`)
3. **Find & Replace** — `findAll` (case-insensitive substring, optional case/whole-word) + `FindReplaceBar` docked over the editor. Selection-based navigation jumps the ProseMirror selection to each match; Replace / Replace-all operate back-to-front. Cmd+F / Cmd+H / Cmd+G. (`src/lib/findReplace.ts`, `src/components/FindReplaceBar.tsx`)
4. **Templates** — bundled local catalog (blank, meeting notes, blog post, weekly review, README). Seeds a new vault note via the save pipeline; "Insert → Templates…" inserts at the cursor. (`src/lib/templates.ts`, `src/components/TemplatePicker.tsx`)
5. **PDF / Print export** — `printDocument()` + `print.css` (`@media print` hides `.no-print` chrome, expands the doc, avoids page-break-inside). Export button in the editor top bar + Print button in the viewer hover controls. No Rust PDF dep — the OS "Save as PDF" path is the exporter. (`src/lib/print.ts`, `src/theme/print.css`)

## Verification

- **Vitest:** 176 pass (was 145 baseline → **+31 new**). TypeScript clean.
- **Rust:** `cargo build` green (unchanged — all five features are frontend-only, reusing `save_document` / `new_document` / `vault_create_note`).
- **Live headless-Chrome walkthrough** — all five verified end-to-end against the running app:
  - Stats bar shows `80 words 432 characters 1 min read`.
  - Spellcheck attribute flips `true → false → on`.
  - Find "the" → count `1 / 2`, Next selects `"the"`, Replace inserts `REPLACED`.
  - Template picker opens; Meeting notes inserts its Agenda/Action-items headings.
  - Under `@media print`, all 5 `.no-print` elements report `display: none`.

## Bugs caught live (not by mocks) — exactly the pattern the project's Phase-5 note documents

1. **Reading-time rounding** — TDD caught that 201 words should be 2 min (ceil, not round) and that whitespace-only docs should report 0 characters. Fixed in `computeStats`.
2. **Find offset drift** — the first flat-text→ProseMirror mapping (a block walk) drifted on nested blocks: the selection landed on adjacent text (" as" instead of "the"). Replaced with a single `nodesBetween` walk that records the PM position for every flat-text char, plus a `focus()+scrollIntoView()` chain so the selection is both applied and reflected in the DOM.
3. **Empty-text-node rejection** — `insertContent` *throws* (not returns false) on template blocks containing empty text nodes / component-nesting edge cases, which aborted the whole template insert. Fix: recursively strip empty text nodes + insert top-level blocks individually in try/catch so one rejected block (e.g. a `<Callout>`) doesn't lose the template's prose.

Live verification was load-bearing again — mocks proved the libraries were internally consistent; only the live runs caught the mapping drift and the throw-vs-return distinction.

## Scope notes (deliberate)

- **No Rust changes** — all five reuse existing commands. Keeps the security/policy boundary untouched.
- **Single-file new-from-template deferred** — `useOpenDocument.createNew` ends in an async editing state, so seeding it cleanly needs a hook signature change. Vault new-note (the primary authoring path) + insert-into-current both ship; single-file new keeps its empty-doc path.
- **Task-list (`- [ ]`) round-trip deferred** — the serializer handles `bulletList`/`orderedList` today; templates use plain bullets. Task-list support is a separate serializer task.
- **Spellcheck dictionaries** — uses the webview's native dictionary (best-in-class); a custom engine / per-language selector is out of scope.

## Commit chain

5 feature commits + 2 live-caught fixes, all on `layer2a/editor-foundation`.
