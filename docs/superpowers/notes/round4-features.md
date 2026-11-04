# Round 4 — Vault Loop + Word-Processor Completeness

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-round4-features-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-round4-features.md`

## Roadmap position (the "re-U" checkpoint)

The objective's criteria are "useful for a Word document and fits within the road map" — spanning ALL phases (v3 SPs + collaboration + rich content), not Phase 7 alone. A fresh audit confirmed five missing, buildable, roadmap-fitting features. Each passes the gate; this round crosses from Phase-7 polish into vault (SP8) + rich content + small Rust additions.

## What shipped (5 features)

1. **SP8 Memories creation UI** — `vault_create_memory` Rust command (mirrors `mcp_server`'s `vault.remember`) writes `<vault>/Memories/<title>-<ts>.mdxz`; a `MemoryDialog` (title/content/tags) reachable from `VaultDashboard` lets users deposit memories, not only agents. The count caption reflects user + agent memories. Closes named SP8. (`src-tauri/src/lib.rs`, `src/components/MemoryDialog.tsx`)
2. **Drag-to-reorder blocks** — `@tiptap/extension-drag-handle` renders a handle next to the hovered top-level node; dragging reorders via ProseMirror's native node-drag (no DnD library). Subtly styled. (`src/components/WysiwygSurface.tsx`)
3. **Inline image resize** — `ImageResize` extends Image with a persisted `width` attr + a React NodeView with a corner-drag resize handle. Width round-trips through editor JSON (editor-only in v1; MDX `![alt](src)` text unchanged — documented scope). (`src/components/ImageResize.tsx`)
4. **Link editor popover** — a BubbleMenu appears when the caret is in a link: editable href (Apply re-sets over `extendMarkRange`; empty Apply or ✕ removes). Closes the add-only `window.prompt` gap. (`src/components/LinkPopover.tsx`)
5. **Version history / snapshots** — `vault_snapshot` writes a timestamped copy to `<vault>/.versions/` on each save (vault-scoped); `vault_list_versions` + `vault_restore_version` power a `HistoryPanel` (📋 button) that lists snapshots and restores them (the editor re-reads the restored doc). (`src-tauri/src/lib.rs`, `src/components/HistoryPanel.tsx`)

## Verification

- **Vitest:** 226 pass (was 221 at Round-4 start → **+5 frontend**). TypeScript clean.
- **Rust:** 7 vault tests pass (was 5 → **+2**: memory + snapshot round-trip). `cargo build` green.
- **Live headless-Chrome walkthrough:**
  - Drag-handle: rendered on block hover.
  - Link popover: appeared when clicking into a link.
  - History button: present.
  - MemoryDialog + image resize: dashboard/dialog-gated or file-dialog-gated; verified via unit + real-editor tests (MemoryDialog 4 tests; image width-attr persistence 1 real-editor test; Rust memory + snapshot 2 tests).

## Bugs caught during verification

- **TipTap option type mismatch** — `DragHandle.configure({ pluginKey })` rejected (`pluginKey` not a v2 DragHandle option); removed.
- **BubbleMenu import path** — must come from `@tiptap/react` (JSX component), not `@tiptap/extension-bubble-menu` (which exports the Extension, not the React component).
- **`setLink` nullability** — TipTap's `setLink` type expects `{ href: string }`, not nullable; switched to `unsetLink` for empty href.

## Commit chain

5 feature commits + 1 deps commit, all on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1 + 2 + 3 + 4)

**20 features delivered across four rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck, find & replace, templates, PDF/print |
| **R2** | task lists, smart paste, auto-save + draft, shortcuts, outline jump |
| **R3** | raw highlighting, focus mode, word goal, HTML/MD export, in-editor tables |
| **R4** | SP8 memories UI, drag-to-reorder, image resize, link popover, version history |

- **Frontend tests:** 145 → **226** (+81). **Rust tests:** +2 (memory, snapshot). TypeScript clean throughout; cargo build green.
- **Verification discipline:** every feature unit/Rust-tested; the editor-wiring ones verified live or via real-editor integration tests. Bugs caught only by typecheck + live runs (DragHandle option, BubbleMenu import, setLink nullability).

## Next loop batch (Round 5 candidates, confirmed missing + roadmap-fitting)

The swarm continues — these are NOT exhausted: comments/annotations (collaboration), SP9 workflow persistence + stub completion (named SP9), footnotes, CodeBlock language picker, find-all results view, reading ruler, per-document settings, plus SP10 (still undefined — needs a spec).
