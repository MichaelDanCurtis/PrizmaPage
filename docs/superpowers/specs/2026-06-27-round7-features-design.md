# Round 7 — Refinements: Reading Aids + Per-Doc + Preview + Anchors — Design

> **Status:** Design
> **Date:** 2026-06-27
> **Branch:** `layer2a/editor-foundation`
> **Roadmap position:** Phase 7 editor power + accessibility + export polish. Round 7 of the feature swarm.
> **Predecessors:** Rounds 1–6 (30 features).

## 0. Roadmap evaluation (the "re-U" checkpoint)

Five remaining refinement-tier features, each Word-document-useful and Phase-7-fitting, all confirmed missing. Each passes the gate.

## 1. Goals (5 features)

1. **Reading ruler / line focus** — a caret-following horizontal highlight bar over the active line, toggleable. Accessibility aid; adjacent to R3's focus mode.
2. **Per-document settings** — per-doc zoom + per-doc word goal, persisted by doc path (extends the per-path `draftStore`/`commentsStore` pattern).
3. **Print preview** — a modal rendering the print-styled HTML before `window.print()`, so the user sees what will export.
4. **Anchor / cross-reference links** — link to a heading within the doc (`#slug`); a heading picker in the link popover + scroll-to-heading on click.
5. **Spellcheck locale selector** — a language dropdown that sets the editor's `lang` attribute (complements the on/off toggle).

## 2. Non-goals

- Multi-cursor (Cmd+D) — high ProseMirror risk (recurring deferral).
- Real-time comment sync — collaboration phase.
- SP9 full stub completion — larger separate effort.
- Document metadata editor — needs `.mdxz` format break.
- SP10 — undefined (needs a roadmap spec first).

## 3. Feature 1 — Reading ruler

A `useReadingRuler` toggle (persisted). When on, a fixed-position horizontal bar (subtle accent tint) tracks the caret's line via `editor.view.coordsAtPos` on selection updates. Toggle in the view menu / shortcuts.

## 4. Feature 2 — Per-document settings

A `docSettings` store (localStorage per path): `{ zoom, goal }`. The viewer's zoom + the editor's word goal read/write per-doc instead of global. A small "per-doc" note in the UI.

## 5. Feature 3 — Print preview

A `PrintPreview` modal: renders `buildHtmlExport(currentSource)` (or the print CSS) in an `<iframe>`/`<div>` with a Print button → `window.print()`. Replaces the direct-print for the editor's 🖨 PDF option.

## 6. Feature 4 — Anchor links

Generate stable heading ids (a TipTap Heading extension override adding a slug `id` attr). The link popover gains a "Link to heading…" affordance: a dropdown of headings → sets the link href to `#slug`. Clicking an in-doc `#slug` link scrolls to the heading.

## 7. Feature 5 — Spellcheck locale

A `SpellcheckLocale` dropdown (common locales) setting the editor element's `lang` attribute (e.g. `en-US`, `en-GB`, `fr`, `es`, `de`). Persisted. The native webview spellchecker honors `lang`.

## 8. Testing & verification

- **Unit:** `useReadingRuler` toggle/persist; `docSettings` per-path round-trip; `slugify` for headings; `SPELLCHECK_LOCALES` shape.
- **Visual:** ruler follows caret; per-doc zoom persists; print preview shows; anchor link scrolls; spellcheck lang applies.

## 9. File-level summary

**New:** `src/hooks/useReadingRuler.ts`, `src/lib/docSettings.ts`, `src/components/PrintPreview.tsx`, `src/lib/anchorLinks.ts`. Tests alongside.
**Modified:** `src/components/EditorView.tsx` (ruler, preview, per-doc), `src/components/DocumentView.tsx` (per-doc zoom), `src/components/WysiwygSurface.tsx` (heading ids, spellcheck lang), `src/components/LinkPopover.tsx` (heading picker), `src/components/EditorToolbar.tsx` (locale/ruler toggles), `src/lib/shortcuts.ts`.
**No Rust changes.**

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reading ruler | caret-following bar | Accessibility; adjacent to focus mode |
| Per-doc settings | localStorage per path | Word has per-doc zoom; extends existing pattern |
| Print preview | iframe of buildHtmlExport | WYSIWYG before print |
| Anchor links | heading slug ids + popover picker | Cross-references are a Word feature |
| Spellcheck locale | lang attribute dropdown | Honored by native webview spellchecker |
