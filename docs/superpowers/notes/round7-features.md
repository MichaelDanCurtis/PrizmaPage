# Round 7 — Reading Aids + Per-Doc + Preview + Anchors + Locale

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-round7-features-design.md`
**Plan:** (executed inline per the design)

## Roadmap position (the "re-U" checkpoint)

Five remaining refinement-tier features, each Word-document-useful and Phase-7-fitting, all confirmed missing. Each passes the gate.

## What shipped (5 features)

1. **Reading ruler** — `useReadingRuler` toggle (persisted) renders a fixed-position accent-tinted bar over the active line, tracking the caret via `coordsAtPos`. Toggle via Cmd+Shift+R. Accessibility aid. (`src/hooks/useReadingRuler.ts`)
2. **Per-document settings** — `docSettings` stores `{zoom, goal}` per doc-path; the viewer's zoom + the editor's word goal read/write per-doc instead of global. Word has per-doc zoom. (`src/lib/docSettings.ts`)
3. **Print preview** — a `PrintPreview` modal renders the export-styled HTML (buildHtmlExport) in a sandboxed iframe before `window.print()`. The editor's PDF export option opens it. (`src/components/PrintPreview.tsx`)
4. **Anchor / cross-reference links** — a `slugify` helper + a § heading dropdown in the `LinkPopover` that sets the href to `#slug`, enabling in-document cross-references. (`src/lib/anchorLinks.ts`)
5. **Spellcheck locale selector** — `useSpellcheck` now also holds a persisted locale reflected onto the ProseMirror element's `lang` attribute; a locale `<select>` appears next to the spellcheck toggle. (`src/hooks/useSpellcheck.ts`)

## Verification

- **Vitest:** 268 pass (was 257 at Round-7 start → **+11**: ruler 3, docSettings 4, slugify 4). TypeScript clean.
- **Rust:** `cargo build` green (no Rust changes).

## Commit chain

5 feature commits, all on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1–7)

**35 features delivered across seven rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck, find & replace, templates, PDF/print |
| **R2** | task lists, smart paste, auto-save + draft, shortcuts, outline jump |
| **R3** | raw highlighting, focus mode, word goal, HTML/MD export, in-editor tables |
| **R4** | SP8 memories UI, drag-to-reorder, image resize, link popover, version history |
| **R5** | SP9 workflow persistence, comments, footnotes, CodeBlock language picker, find-all results |
| **R6** | subscript/superscript, readability stats, export TOC, markdown import, version diff |
| **R7** | reading ruler, per-doc settings, print preview, anchor links, spellcheck locale |

- **Frontend tests:** 145 → **268** (+123). **Rust tests:** +2. TypeScript clean throughout; cargo build green.

## Next loop batch (Round 8 candidates)

The swarm continues but the candidate pool is genuinely thinning toward items that are either heavy (multi-cursor, SP9 full stub completion, SP10 definition) or require format/capability changes (document metadata editor). Remaining buildable candidates: emoji/symbol picker, multi-cursor (high-risk), per-doc page/margin settings, deeper accessibility (high-contrast mode), and defining/implementing SP10. The feature set is approaching exhaustion for clean, in-scope swarm slots.
