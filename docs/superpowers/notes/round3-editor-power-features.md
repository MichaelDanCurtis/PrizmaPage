# Round 3 — Editor Power Features + In-Editor Tables

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-editor-power-features-round3-design.md`, `docs/superpowers/specs/2026-06-27-in-editor-tables-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-editor-power-features-round3.md`

## Roadmap position (the "re-U" checkpoint)

Four Phase-7 polish features plus one rich-content feature. All five are Word-document-useful and roadmap-fitting (architecture §12: Phase 7 "editor power features" + Phase 3 "built-in component library," where tables belong). This round crosses from Phase-7 polish into rich content, opening the next loop batch.

## What shipped (5 features)

1. **Raw-editor syntax highlighting** — `RawEditor` wraps the existing `CodeHighlight` (Prism backdrop + transparent textarea) with the jsx grammar. Zero new deps. (`src/components/RawEditor.tsx`)
2. **Focus / Zen mode** — `useFocusMode` toggle (persisted) gates the toolbar, Files/Nav/AI panes, and stats/goal bars; top bar collapses to filename + "Exit focus." 🎯 button + Cmd+.. (`src/hooks/useFocusMode.ts`)
3. **Word-count goal** — `GoalBar` under the stats bar shows progress toward a persisted session target; "🎯 Goal reached" flash when met. (`src/components/GoalBar.tsx`)
4. **HTML / Markdown export** — the 🖨 menu: PDF/Print, HTML (self-contained styled doc, script-injection-safe), Markdown (source verbatim). Blob download, Rust-free. (`src/lib/exportDoc.ts`)
5. **In-editor table editing** — GFM pipe tables (`| h | h |\n|---|---|\n| a | b |`) parse to `table`/`tableRow`/`tableHeader`/`tableCell` nodes and serialize back. 4 TipTap table extensions register an editable schema; Insert → Table (2×2 starter); context controls (add row/col, toggle header, delete) appear in-table; `editor-content.css` styles them. Legacy `<Table data=...>` JSON component retained. (`src/registry/serializer.ts`, `src/components/WysiwygSurface.tsx`)

## Verification

- **Vitest:** 221 pass (was 205 at Round-3 start → **+16 new**). TypeScript clean.
- **Rust:** `cargo build` green (all five features are frontend-only).
- **Live + real-editor integration:**
  - Raw highlighting: 41 Prism token spans (live).
  - Focus mode: chrome hidden, "Exit focus" present (live).
  - Word goal: "Goal reached" at 80 > 20 (live).
  - Export menu: PDF / HTML / Markdown present (live).
  - Tables: editor HTML confirms `table`/`th`/`td` from parsed GFM + `insertTable`/`addRowAfter` commands (real-editor integration).

## Bugs caught during verification

- TipTap emits `<th colspan=...>` (attributes), not bare `<th>` — the first table integration test asserted `<th>` and failed; corrected to `<th ` after inspecting the real HTML. (Another instance of "assert on real output, not the assumed shape.")

## Commit chain

5 feature commits + 1 deps commit, all on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1 + 2 + 3)

**15 features delivered across three rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck toggle, find & replace, document templates, PDF/print export |
| **R2** | task lists, smart paste, auto-save + draft recovery, shortcuts reference, outline quick-jump |
| **R3** | raw-editor highlighting, focus/zen mode, word-count goal, HTML/Markdown export, in-editor tables |

- **Frontend tests:** 145 → **221** (+76). TypeScript clean throughout.
- **Rust:** unchanged across all three rounds (every feature reuses existing commands).
- **Verification discipline:** every feature live- or real-editor-integration-verified; multiple bugs caught only by live runs (find-offset drift, empty-text-node rejection, greedy bullet branch, false-pass trap, TipTap `<th>` attribute shape).

## Next loop batch (Round 4 candidates, confirmed missing + roadmap-fitting)

The feature swarm continues — these are NOT exhausted: drag-to-reorder blocks, version history, comments/annotations, plus the rich-content/collaboration surface and the unspecced built-but-incomplete items (SP8 memories creation, SP9 workflow stubs, SP10).

