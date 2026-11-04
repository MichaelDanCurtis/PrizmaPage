# Round 5 — Vault Completion + Collaboration Seed + Refinements — Design

> **Status:** Design
> **Date:** 2026-06-27
> **Branch:** `layer2a/editor-foundation`
> **Roadmap position:** v3 SP9 (workflows) + collaboration (comments) + rich content (footnotes) + Phase-7 refinements. Round 5 of the feature swarm.
> **Predecessors:** Rounds 1–4 (20 features).

## 0. Roadmap evaluation (the "re-U" checkpoint)

Five missing, buildable, roadmap-fitting features (confirmed across prior audits). Each is Word-document-useful and fits a named roadmap area: SP9 (workflow persistence), collaboration (comments), rich content (footnotes), Phase 7 refinements (CodeBlock language, find-all).

## 1. Goals (5 features)

1. **SP9 Workflow persistence** — workflows save to localStorage on edit and reload into the canvas; a workflow library lists saved workflows. Closes the "workflows vanish on close" gap.
2. **Comments / annotations** — inline comments stored as a doc side-channel (a `comments` array in a doc-level meta, keyed by a stable anchor); a comments side panel lists/adds/resolves them. Seed for the collaboration phase.
3. **Footnotes** — `[^1]` footnote marks + a footnotes block; serializer round-trip; renders as superscript markers + a numbered list at the end.
4. **CodeBlock language picker** — the render-only `CodeBlock` gains a language dropdown (in the component-card editor / peek) so authors can set the language without hand-editing JSX.
5. **Find-all results view** — the find/replace bar gains a "results" expansion listing all matches with context; clicking jumps.

## 2. Non-goals

- Real-time multi-user comment collaboration (this seeds the data model + single-user UI; sync is a later phase).
- SP9 full stub completion (wiring store/notify/mcp-call to real MCP) — separate larger effort; persistence is the clean win here.
- Multi-cursor (Cmd+D) — high ProseMirror risk.

## 3. Feature 1 — SP9 Workflow persistence

### 3.1 Approach
A `workflowStore` (localStorage) module: `saveWorkflow(name, wf)`, `listWorkflows()`, `loadWorkflow(name)`, `deleteWorkflow(name)`. `WorkflowCanvas` auto-saves the current `wf` to a "draft" workflow on change; a small library dropdown loads/deletes named workflows; "Save as…" prompts for a name.

## 4. Feature 2 — Comments

### 4.1 Approach
A `Comment` model `{ id, anchor (selection text or block pos), body, author, ts, resolved }`. Comments live in a doc-side-channel JSON in the manifest or a parallel `comments.json` in the `.mdxz` (v1: localStorage per path, mirroring `draftStore`, to avoid a format change). A `CommentsPanel` in the left nav (a 4th nav tab, or a top-bar button) lists comments; add via a "Comment" button on a selection; resolve/clear. This seeds the collaboration data model without the format-break.

## 5. Feature 3 — Footnotes

### 5.1 Approach
Parse `[^id]` marks in `parseInline` into footnote-reference nodes; collect `[^id]: text` definition lines at doc end into a `footnotes` block. Serialize back. Render references as `<sup>` and a numbered list. A Footnote TipTap extension (or a custom mark) makes them editable.

## 6. Feature 4 — CodeBlock language picker

### 6.1 Approach
A `LANGUAGES` constant (common: text, javascript, typescript, jsx, tsx, python, rust, bash, json, css, html). In the CodePeek / component-card editor, a `<select>` sets the `language` attr on the CodeBlock component node. (The library `CodeBlock.tsx` render component is unchanged.)

## 7. Feature 5 — Find-all results view

### 7.1 Approach
The `FindReplaceBar` gains a toggle to expand a results list (each match: its line context + offset). Clicking a result jumps the selection to it (reusing the existing `jumpTo`). Reuses `findAll` + the flat-text positions.

## 8. Testing & verification

- **Unit:** `workflowStore` round-trip; `commentsStore` round-trip; footnote serializer round-trip; `LANGUAGES` shape; find-all results build.
- **Visual:** workflow reloads after close; add/resolve a comment; footnotes render; pick a CodeBlock language; expand find results.

## 9. File-level summary

**New:** `src/lib/workflowStore.ts`, `src/lib/commentsStore.ts`, `src/components/CommentsPanel.tsx`, `src/lib/footnotes.ts` (helpers), `src/lib/languages.ts`. Tests alongside.
**Modified:** `src/components/WorkflowCanvas.tsx` (persistence), `src/registry/serializer.ts` (footnotes), `src/components/CodePeek.tsx` (language picker), `src/components/FindReplaceBar.tsx` (results), `src/components/EditorView.tsx` (comments panel, find-all wiring).
**No Rust changes.**

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Workflow persistence | localStorage | SP9-named; avoids format change |
| Comments storage | localStorage side-channel | Seeds collab model without .mdxz format-break |
| Footnotes | serializer `[^id]` round-trip | Standard markdown |
| CodeBlock language | LANGUAGES constant + select | Small; sets the existing attr |
| Find-all | expand-in-bar results list | Reuses shipped findAll + jumpTo |
