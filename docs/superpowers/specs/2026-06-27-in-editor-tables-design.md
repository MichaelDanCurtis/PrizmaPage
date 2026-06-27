# In-Editor Table Editing — Design (Round 3, Feature 5)

> **Status:** Design
> **Date:** 2026-06-27
> **Roadmap position:** Rich-content phase (architecture §12 build order places "built-in component library" at Phase 3; tables are core word-processor content). Tables are Word-document-core and roadmap-fitting.
> **Predecessors:** Round 1–3 (14 features). This is the 5th feature of Round 3 to complete a full five-feature round.

## 1. Goal

Make tables first-class editable content: author a GFM pipe table in raw MDX (`| a | b |\n|---|---|`), and in the WYSIWYG editor it renders as a real editable table — click a cell to edit, add/remove rows and columns, set header row. The change round-trips back to GFM on save. The existing render-only `<Table data=...>` library component is retained for the JSON-attr case (backward compatible).

## 2. Non-goals

- Cell merging, complex styling, column-width dragging (later refinement).
- Migrating the legacy `<Table data=...>` JSON component to GFM (it stays as-is; the two coexist).
- Sorting / formulas (spreadsheet territory).

## 3. Approach

- **Install** `@tiptap/extension-table` + `@tiptap/extension-table-row` + `@tiptap/extension-table-cell` + `@tiptap/extension-table-header` (v2.x to match the project's TipTap).
- **Register** them in `WysiwygSurface` so the editor schema knows `table`/`tableRow`/`tableCell`/`tableHeader`.
- **Serializer GFM round-trip:** parse `| ... |` pipe tables (with a `|---|` separator) into `table` nodes; serialize `table` nodes back to GFM. This is the load-bearing change — without it, tables authored in raw mode wouldn't survive a save/open cycle.
- **Toolbar:** a Table button (⊞) in the Insert menu inserts a 2×2 starter table; a small cell-context menu (or the standard TipTap table controls) offers add row/column, toggle header.

## 4. GFM format

```
| H1 | H2 |
|----|----|
| a  | b  |
| c  | d  |
```

Header row first, then a `|---|`-style separator, then body rows. Cells are pipe-separated; leading/trailing pipes required. Serializer emits this form.

## 5. Testing & verification

- **Unit:** serializer round-trips a 2-column table (header + 2 rows); a table with more rows/cols; preserves cell text with inline marks; does not mis-parse non-table pipes.
- **Integration:** the editor schema renders a parsed GFM table as `table`/`tableRow`/`tableCell`/`tableHeader` (assert on editor HTML); `insertTable` command present.
- **Visual:** insert a table via the toolbar, edit a cell, switch to Raw → GFM present.

## 6. File-level summary

**New:** none (no new lib files).
**Modified:** `package.json` (4 table extensions); `src/registry/serializer.ts` (+ tests); `src/components/WysiwygSurface.tsx` (register); `src/components/EditorToolbar.tsx` (Insert → Table).
**No Rust changes.**

## 7. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Table model | TipTap table extensions + GFM serializer | Native editable cells; standard markdown authoring |
| Coexistence | keep `<Table data=...>` render component | Backward compatible; JSON-attr tables still render |
| Cell styling | default borders via CSS | Minimal; matches the existing Table component look |
