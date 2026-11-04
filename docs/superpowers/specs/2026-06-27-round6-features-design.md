# Round 6 — Editor Completeness + Export Polish + Version Diff — Design

> **Status:** Design
> **Date:** 2026-06-27
> **Branch:** `layer2a/editor-foundation`
> **Roadmap position:** Phase 7 editor power + export polish + rich content. Round 6 of the feature swarm.
> **Predecessors:** Rounds 1–5 (25 features).

## 0. Roadmap evaluation (the "re-U" checkpoint)

Five missing, Word-document-useful, roadmap-fitting features confirmed. Each passes the gate. The feature set is not exhausted (Round 7+ candidates noted).

## 1. Goals (5 features)

1. **Subscript / superscript toggles** — two TipTap extensions + toolbar buttons (mirror the Underline wiring). Canonical for chemistry/math (H₂O, x²).
2. **Readability & word-frequency stats** — extend `docStats` with sentence count, avg word/sentence length, Flesch reading level, and top-N frequent words; surfaced via an expandable stats detail. Word's "Readability Statistics."
3. **Table of contents in HTML/print export** — `buildHtmlExport` prepends a generated `<nav>` TOC of heading anchor links. Signature Word export.
4. **Markdown import (.md → new document)** — pick/paste a `.md` file → parse → open as an unsaved new doc. Companion to R3's Markdown export (symmetry).
5. **Version diff view** — extend the `HistoryPanel` with a "Compare" button rendering an inline line-diff of two `.mdxz` content layers.

## 2. Non-goals (deferred — confirmed)

- Multi-cursor (Cmd+D) — high ProseMirror risk.
- Code execution for CodeBlocks — violates the capability-bridge security model.
- Document metadata editor — needs a `.mdxz` manifest format break.
- Bulk vault find-replace — requires Rust re-zip of arbitrary packages.
- Reading ruler, per-doc settings, spellcheck locale, emoji picker, print preview, anchor links — Round 7+ candidates.

## 3. Feature 1 — Subscript / superscript

Install `@tiptap/extension-subscript` + `@tiptap/extension-superscript` (v2.x); register in `WysiwygSurface`; add `X₂` (sub) and `X²` (sup) `TBtn`s in the inline-format group. Serialize as `<sub>`/`<sup>` (extend the inline serializer).

## 4. Feature 2 — Readability stats

Extend `computeStats` (or add `computeReadability`) returning `{ sentences, avgWordLength, fleschScore, topWords }`. Surface in a small "details" expansion on `DocStatsBar`. Pure TS.

## 5. Feature 3 — Export TOC

In `buildHtmlExport`, collect `#{1,6}` headings (already parsed), build a `<nav><ul>` of `<a href="#slug">` links + add `id="slug"` to the rendered headings.

## 6. Feature 4 — Markdown import

Add an `onImportMarkdown` flow: a file dialog accepting `.md`/`.markdown`; read text → `parseMdxToDoc` → open in the editor as a new unsaved doc (title from filename). Wired from the editor top bar (an "Import" entry) and the empty state.

## 7. Feature 5 — Version diff

Add a small pure-TS line-diff (`diffLines(a, b)`). In `HistoryPanel`, a "Compare" button next to each version loads the snapshot's content + the current content and renders an inline diff (added/removed/unchanged lines). Frontend-only.

## 8. Testing & verification

- **Unit:** sub/sup serializer round-trip; `computeReadability` known inputs; `buildHtmlExport` includes TOC + heading ids; `diffLines` correctness; import path parses.
- **Visual:** sub/sup toggle; stats detail; HTML export has TOC; import a `.md`; compare a version.

## 9. File-level summary

**New:** `src/lib/readability.ts`, `src/lib/diff.ts`. Tests alongside.
**Modified:** `src/registry/serializer.ts` (sub/sup), `src/components/WysiwygSurface.tsx` (extensions), `src/components/EditorToolbar.tsx` (buttons), `src/components/DocStatsBar.tsx` (+ EditorView) (readability detail), `src/lib/exportDoc.ts` (TOC), `src/components/EditorView.tsx` (import), `src/components/HistoryPanel.tsx` (compare), `src/hooks/useOpenDocument.ts` (import path).
**No Rust changes.**

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sub/sup | TipTap extensions + serializer | Drop-in; canonical Word feature |
| Readability | pure-TS Flesch + frequency | Word's readability dialog |
| Export TOC | generated nav in buildHtmlExport | Signature export |
| Markdown import | reuse parseMdxToDoc | Symmetry with R3 export |
| Version diff | small pure-TS line diff | Frontend-only; extends R4 history |
