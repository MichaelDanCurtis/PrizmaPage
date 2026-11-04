# Round 5 — Implementation Plan

> superpowers:executing-plans. Checkbox tracking.

**Goal:** Five features: SP9 workflow persistence, comments/annotations, footnotes, CodeBlock language picker, find-all results. All frontend-only.

**Spec:** `docs/superpowers/specs/2026-06-27-round5-features-design.md`
**Baseline:** tsc clean; 226 tests; cargo build green.

---

## Phase 1: SP9 Workflow persistence

### Task 1.1: workflowStore

**Files:** `src/lib/workflowStore.ts`, `src/lib/workflowStore.test.ts`

- [ ] TDD: `saveWorkflow/listWorkflows/loadWorkflow/deleteWorkflow` round-trip in localStorage. ~4 tests.
- [ ] Commit.

### Task 1.2: Wire into WorkflowCanvas

**Files:** `src/components/WorkflowCanvas.tsx`

- [ ] On mount, load the "draft" workflow (or last-used); on `wf` change, save to draft. Add a library dropdown (load/delete named) + "Save as…" prompt. 
- [ ] tsc + tests + commit.

## Phase 2: Comments

### Task 2.1: commentsStore

**Files:** `src/lib/commentsStore.ts`, `src/lib/commentsStore.test.ts`

- [ ] TDD: `addComment/listComments/resolveComment/clearComments` per-doc-path in localStorage. ~4 tests.
- [ ] Commit.

### Task 2.2: CommentsPanel + wire

**Files:** `src/components/CommentsPanel.tsx` (+ test), `src/components/EditorView.tsx`

- [ ] Panel lists comments; "Comment" button on the current selection adds one (anchor = selection text); resolve/clear. Top-bar 🗨 button opens it.
- [ ] tsc + tests + commit.

## Phase 3: Footnotes

### Task 3.1: Serializer footnote round-trip

**Files:** `src/registry/serializer.ts`, `src/registry/serializer.test.ts`

- [ ] TDD: parse `[^1]` inline references + `[^1]: text` definitions; serialize back. ~3 tests.
- [ ] Commit.

## Phase 4: CodeBlock language picker

### Task 4.1: LANGUAGES + select in CodePeek

**Files:** `src/lib/languages.ts`, `src/components/CodePeek.tsx`

- [ ] `LANGUAGES` constant; in CodePeek, a `<select>` to set the active component's `language` attr. (If CodePeek doesn't edit the component node directly, add a small language-set affordance in the toolbar when a CodeBlock is selected.)
- [ ] tsc + tests + commit.

## Phase 5: Find-all results view

### Task 5.1: FindReplaceBar results expansion

**Files:** `src/components/FindReplaceBar.tsx` (+ test), `src/components/EditorView.tsx`

- [ ] Pass `matches` (with context) into the bar; a toggle expands a list; clicking a row calls `onJump(index)`.
- [ ] tsc + tests + commit.

## Final Verification
- [ ] tsc clean; npm test all pass (226 baseline + new); cargo build green.
- [ ] Headless walkthrough.

## Self-Review Notes
- Comments use selection-text anchors (not block positions) to survive edits — positions drift; text anchors are stable enough for v1.
- Footnote IDs are stable strings (`[^1]`); the definitions block lives at doc end.
- The language picker sets the component node's `language` attr via the editor's `updateAttributes` on the selected CodeBlock node — verify the node-type name in the schema.
