# Round 6 — Editor Completeness + Export Polish + Version Diff

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-round6-features-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-round6-features.md`

## Roadmap position (the "re-U" checkpoint)

Five missing, Word-document-useful, roadmap-fitting features confirmed. Each passes the gate. The feature set is not exhausted (Round 7+ candidates noted).

## What shipped (5 features)

1. **Subscript / superscript** — TipTap Subscript/Superscript extensions; serializer round-trips `<sub>`/`<sup>` into marks; `X₂`/`X²` toolbar buttons. (`src/registry/serializer.ts`, `src/components/WysiwygSurface.tsx`)
2. **Readability & word-frequency stats** — `computeReadability` (sentences, avg word length, Flesch reading-ease, top-N words w/ stopwords excluded); DocStatsBar gains a clickable "details" expansion. Word's Readability Statistics. (`src/lib/readability.ts`)
3. **Export table of contents** — `buildHtmlExport` collects headings, assigns slug ids, prepends a styled `<nav>` Contents block. Signature Word export. (`src/lib/exportDoc.ts`)
4. **Markdown import (.md → new doc)** — `importMarkdown` opens a file dialog, reads `.md`/`.markdown`/`.txt`, opens it in the editor as an unsaved doc (path null). Entry points: EmptyState "Import .md…" + editor export menu "Import Markdown…". Companion to R3's Markdown export (symmetry). (`src/hooks/useOpenDocument.ts`)
5. **Version diff** — pure-TS LCS `diffLines` powers a "Compare" button in HistoryPanel: diffs a snapshot's content vs the current document, renders an inline +/− view. Extends R4's version history. (`src/lib/diff.ts`, `src/components/HistoryPanel.tsx`)

## Verification

- **Vitest:** 257 pass (was 242 at Round-6 start → **+15**). TypeScript clean.
- **Rust:** `cargo build` green (no Rust changes this round).
- **Test discipline:** sub/sup test strengthened to assert the semantic mark (avoiding the literal-text false-pass); the export TOC test updated for new heading `id` attrs.

## Commit chain

5 feature commits, all on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1–6)

**30 features delivered across six rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck, find & replace, templates, PDF/print |
| **R2** | task lists, smart paste, auto-save + draft, shortcuts, outline jump |
| **R3** | raw highlighting, focus mode, word goal, HTML/MD export, in-editor tables |
| **R4** | SP8 memories UI, drag-to-reorder, image resize, link popover, version history |
| **R5** | SP9 workflow persistence, comments, footnotes, CodeBlock language picker, find-all results |
| **R6** | subscript/superscript, readability stats, export TOC, markdown import, version diff |

- **Frontend tests:** 145 → **257** (+112). **Rust tests:** +2 (memory, snapshot). TypeScript clean throughout; cargo build green.

## Next loop batch (Round 7 candidates)

The swarm continues. Remaining candidates from prior audits: reading ruler, per-document settings, print preview, anchor/cross-reference links, spellcheck locale, SP10 (still undefined), deeper collaboration (real-time comment sync), and SP9 full stub completion (wire workflow store/notify/mcp-call to real MCP). The feature set is NOT exhausted.
