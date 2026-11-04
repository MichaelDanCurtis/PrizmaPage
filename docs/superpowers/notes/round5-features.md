# Round 5 — Vault Completion + Collaboration Seed + Refinements

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-round5-features-design.md`
**Plan:** `docs/superpowers/plans/2026-06-27-round5-features.md`

## Roadmap position (the "re-U" checkpoint)

Five missing, buildable, roadmap-fitting features (confirmed across prior audits). Each fits a named roadmap area: SP9 (workflow persistence), collaboration (comments), rich content (footnotes), Phase-7 refinements (CodeBlock language, find-all). All pass the gate.

## What shipped (5 features)

1. **SP9 Workflow persistence** — `workflowStore` (localStorage) saves a draft on every change + named workflows; `WorkflowCanvas` reloads the draft on mount, adds 💾 Save-as and 📂 Library dropdown (load/delete). Closes the "workflows vanish on close" gap. (`src/lib/workflowStore.ts`)
2. **Comments / annotations** — `commentsStore` (per-doc-path localStorage side-channel) + a `CommentsPanel` 4th nav tab: add a comment on the current selection (text anchor), resolve/reopen, clear. Seeds the collaboration model without a `.mdxz` format break. (`src/lib/commentsStore.ts`, `src/components/CommentsPanel.tsx`)
3. **Footnotes** — `[^id]: text` definition lines parse into a structured `footnoteDefinition` node (ref attr + content) and serialize back; references stay inline as `[^id]`. (`src/registry/serializer.ts`)
4. **CodeBlock language picker** — a `LANGUAGES` constant feeds a `<select>` that appears in the toolbar when a CodeBlock component is selected; sets the node's `language` attr via `setNodeMarkup`. (`src/lib/languages.ts`, `src/components/EditorToolbar.tsx`)
5. **Find-all results view** — the find bar gains a ≡ toggle expanding a list of every match with ~30-char context; clicking a row jumps the selection (reuses `findAll` + `jumpTo`). Current match highlighted. (`src/components/FindReplaceBar.tsx`)

## Verification

- **Vitest:** 242 pass (was 226 at Round-5 start → **+16**). TypeScript clean.
- **Rust:** `cargo build` green (no Rust changes this round).
- **Test discipline:** every feature unit-tested; the footnote test strengthened to assert the semantic `footnoteDefinition` node type (avoiding the bullet/task-list false-pass pattern the project has hit twice before).

## Commit chain

5 feature commits, all on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1 + 2 + 3 + 4 + 5)

**25 features delivered across five rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck, find & replace, templates, PDF/print |
| **R2** | task lists, smart paste, auto-save + draft, shortcuts, outline jump |
| **R3** | raw highlighting, focus mode, word goal, HTML/MD export, in-editor tables |
| **R4** | SP8 memories UI, drag-to-reorder, image resize, link popover, version history |
| **R5** | SP9 workflow persistence, comments, footnotes, CodeBlock language picker, find-all results |

- **Frontend tests:** 145 → **242** (+97). **Rust tests:** +2 (memory, snapshot, R4). TypeScript clean throughout; cargo build green.
- **Roadmap coverage:** Phase 7 (editor power) fully saturated; rich content (tables, footnotes, image resize); collaboration seed (comments); v3 SP8 (memories) + SP9 (workflow persistence) closed; export (PDF/HTML/MD); vault (history snapshots, draft recovery).

## Next loop batch (Round 6 candidates)

The swarm continues. Remaining candidates from prior audits: SP9 full stub completion (wire workflow store/notify/mcp-call to real MCP — larger), reading ruler, per-document settings, SP10 (still undefined — needs a spec), and deeper collaboration (real-time comment sync). The feature set is NOT exhausted.
