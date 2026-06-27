# Round 4 — Vault Loop + Word-Processor Completeness — Design

> **Status:** Design
> **Date:** 2026-06-27
> **Branch:** `layer2a/editor-foundation`
> **Roadmap position:** v3 "Vault & Intelligence" SP8 + Phase 7 editor power + rich content. Round 4 of the feature swarm.
> **Predecessors:** Rounds 1–3 (15 features).

## 0. Roadmap evaluation (the "re-U" checkpoint)

The objective's criteria are "useful for a Word document and fits within the road map" — spanning ALL phases, including the v3 SPs and collaboration/rich-content, not Phase 7 alone. A fresh audit confirmed five missing, roadmap-fitting, buildable features. Each passes the gate.

## 1. Goals (5 features)

1. **SP8 Memories creation UI** — expose the existing `vault.remember` Rust logic (in `mcp_server.rs`) as an in-app "Save memory" command + dialog, so users (not just external agents) can deposit memories into `Memories/`. Closes named SP8.
2. **Drag-to-reorder blocks** — a drag handle on each top-level block (paragraph/heading/list) that lets the user reorder via ProseMirror's native node-drag. No DnD library.
3. **Inline image resize** — corner-drag resize handles on images, persisting a `width` that round-trips through the serializer.
4. **Link editor popover** — a popover when the caret is in a link: edit the href or remove the link (replaces the `window.prompt` add-only affordance).
5. **Version history / snapshots** — on each save, write a timestamped snapshot to `<vault>/.versions/`; a "History" panel lists snapshots and restores one. Small Rust addition.

## 2. Non-goals

- Full SP9 workflow stub completion (wiring `store`/`notify`/`mcp-call` to real MCP) — separate, larger effort.
- Comments/annotations — needs an upfront serialization-format decision; its own round.
- Multi-cursor (Cmd+D) — high ProseMirror risk, low prose payoff.
- Footnotes, CodeBlock language picker, reading ruler, find-all view — deferred (lower value or refinements).

## 3. Feature 1 — SP8 Memories creation

### 3.1 Approach
A new Rust command `vault_create_memory(vault_path, title, content, tags)` that mirrors `mcp_server.rs`'s `vault.remember` branch (writes `Memories/<title>-<ts>.mdxz` via `save::save_document`). Frontend: a "Save memory" dialog (`MemoryDialog`) reachable from `VaultDashboard`, which calls it and refreshes the vault. The dashboard's existing memory count then reflects user-created memories too.

### 3.2 Mock
Add `vault_create_memory` to `index.html`'s browser mock returning `{ ok: true }`.

## 4. Feature 2 — Drag-to-reorder blocks

### 4.1 Approach
TipTap's `@tiptap/extension-drag-handle` renders a handle next to the hovered top-level node; dragging it reorders via ProseMirror's native node-drag (the doc schema already permits it once `draggable` is set on block nodes, which StarterKit enables). Install the extension (v2.x), register it in `WysiwygSurface`. The handle is styled subtly; no serializer change (reordering just changes JSON order).

## 5. Feature 3 — Inline image resize

### 5.1 Approach
A custom TipTap `ImageResize` NodeView extending `@tiptap/extension-image`: adds a `width` attr and corner-drag handles. The serializer round-trips the width as `<img src=... width="N">`-equivalent — since images currently serialize as `![alt](src)`, store width in a data attribute via a custom serializer case `image` that emits `![alt](src){width=N}` (a markdown-attribute extension) OR keep `![alt](src)` and accept width is editor-only. v1: editor-only width (persisted in JSON, round-trips through the JSON path, not emitted to MDX text). Document this scope.

## 6. Feature 4 — Link editor popover

### 6.1 Approach
A `LinkPopover` shown when the caret is inside a `link` mark (via `BubbleMenu` from `@tiptap/extension-bubble-menu`). Shows the current href in an editable field + "Apply" (re-`setLink` over `extendMarkRange("link")`) + "Remove" (`unsetLink`). The existing add-link toolbar button stays; the popover handles edit/remove.

## 7. Feature 5 — Version history

### 7.1 Approach
- **Rust:** `vault_snapshot(vault_path, doc_path, content_md, compiled_js)` writes `<vault>/.versions/<basename>-<ts>.mdxz` via `save::save_document`. Called by the frontend after each successful save (when a vault is set). `vault_list_versions(vault_path, doc_path)` → `Vec<{path, ts, label}>`. `vault_restore_version(src, dst)` copies a snapshot back.
- **Frontend:** a "History" entry in the top bar (📋) opens a `HistoryPanel` listing snapshots for the current doc; restore seeds the editor (with a confirm).

## 8. Testing & verification

- **Unit (Rust):** `vault_create_memory` writes a readable memory; `vault_snapshot`/`vault_list_versions`/`vault_restore_version` round-trip.
- **Unit (frontend):** `MemoryDialog` calls the command with right args; `LinkPopover` edit/remove logic; image resize attr round-trips via JSON; `HistoryPanel` lists/restores (mocked).
- **Visual:** save a memory → count increments; drag a block → order changes; resize an image → width persists; edit a link via popover; save a doc → a snapshot appears in History.

## 9. File-level summary

**New (Rust):** commands in `src-tauri/src/lib.rs` — `vault_create_memory`, `vault_snapshot`, `vault_list_versions`, `vault_restore_version`; tests in `src-tauri/tests/vault_test.rs`.
**New (frontend):** `src/components/MemoryDialog.tsx`, `src/components/LinkPopover.tsx`, `src/components/HistoryPanel.tsx`, `src/lib/memories.ts` (+ bridge), `src/lib/history.ts` (+ bridge). Tests alongside.
**Modified (Rust):** `src-tauri/src/lib.rs` (register commands).
**Modified (frontend):** `VaultDashboard.tsx`, `App.tsx` (memory dialog), `WysiwygSurface.tsx` (drag handle, image resize ext, link popover), `EditorView.tsx` (history panel), `EditorTopBar.tsx` (history button), `index.html` (mocks).

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Memories | reuse mcp_server logic via new command | SP8-named; Rust exists |
| Block drag | @tiptap/extension-drag-handle | Native ProseMirror drag; no DnD lib |
| Image resize | custom NodeView, width in JSON (not MDX text) | Avoids markdown-attr complexity; round-trips via JSON |
| Link edit | BubbleMenu popover | Standard pattern; extends shipped add-link |
| Version history | snapshots in `<vault>/.versions/` | Mirrors save path; vault-scoped |
