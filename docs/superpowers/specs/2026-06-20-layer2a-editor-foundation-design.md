# PrizmaPage — Layer 2a: Editor Foundation Design

**Date:** 2026-06-20
**Status:** Draft — pending user review
**Builds on:** `2026-06-19-prizmapage-architecture-design.md` (dual-shell viewer/editor architecture) and `2026-06-20-layer1-document-surface-design.md` (the frameless viewer)
**Replaces:** Nothing. Adds the editor half of the dual-shell architecture.

---

## 1. Goal

Build the first authoring surface for PrizmaPage, layered on top of the Layer 1 viewer. A user can switch from viewer mode into editor mode, write prose in WYSIWYG, insert components via slash or the `+` button, edit a component's JSX in a code peek, save the result as a real `.mdxz`, and reopen it.

This is **Layer 2a of three** in the editor build-out:

| Layer | Delivers | Status |
|-------|----------|--------|
| 2a — Editor foundation | WYSIWYG editor + 4 starter components + save pipeline + registry | ← this spec |
| 2b — Comprehensive component library | Chart, Image, Table, Tabs, Accordion, Video, Steps, Embed | future |
| 3 — AI authoring | `/ai-component` lights up; AI generates real component code | future |

Layer 2a unblocks real authoring. Layer 2b fills the toolbox. Layer 3 makes the product magic.

### 1.1 Locked design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Authoring model | **Hybrid**: WYSIWYG prose by default, raw-MDX toggle for power users | Reaches non-technical authors; keeps escape hatch for devs |
| Layout | **WYSIWYG-primary with code peek** | Document fills the window; double-click a component → right-drawer code editor. True to viewer's minimal aesthetic |
| Slash menu | **Prose blocks + built-in components + `/ai-component` (stubbed)** | Components first-class in the same surface; AI affordance visibly present, generation deferred to Layer 3 |
| Chrome | **Minimal top bar + slash + insert button** | Stays true to viewer's minimal aesthetic; two insertion paths (keyboard + mouse) with one mental model |
| Library scope | **Comprehensive eventually, 4 starter components now** | Hard part is the registry/editor, not the components. 4 components prove every code path; Chart etc. want their own design pass |
| Layer 2 split | **Decompose: 2a (foundation) now, 2b (library) after** | Each cycle tractable; 2a unblocks authoring; 2b can react to real use |
| Rich-text engine | **TipTap** | Component-card-as-custom-node is exactly its strength; largest ecosystem; React-first |
| Compile location | **Frontend (compile in JS, zip in Rust)** | Webview already loads `@mdx-js/mdx`; no Rust MDX toolchain |

---

## 2. Scope

### 2.1 In scope

- **Editor mode** — toggled from the viewer's hover-controls "Edit" button (currently inert). Returns to viewer via the `✕` in the editor's top bar.
- **WYSIWYG prose editing** — headings (H2/H3), paragraphs, bullet/ordered lists, blockquotes, inline code, bold, italic, links. TipTap-backed.
- **Slash menu framework** — typing `/` brings up an inline menu. Two categories: **Prose blocks** (Heading 2, Heading 3, Bulleted list, Numbered list, Quote, Inline code, Divider) and **Components** (Callout, StatCard, CodeBlock, Divider) plus the **AI component** stub. Same items appear in the `+` button's popover.
- **Code peek** — double-click a component card → dark drawer slides in from the right showing that component's JSX source. Edit, Apply, re-render. Cancel discards. Invalid JSX disables Apply.
- **Raw mode toggle** — "Raw" button in the top bar flips the whole document to a plain MDX source view (textarea) for power-user/whole-doc editing. Flipping back re-parses; parse failures refuse the flip with a clear error.
- **Save / compile pipeline** — `Save` compiles the MDX (compile-at-save, per the architecture spec) and writes a real `.mdxz` (three-layer package). Live version of what the fixture builder does.
- **Component registry** — registration system: editor knows "these are the available components, here's their card renderer, here's their insert template." Extension point for Layer 2b.
- **Starter component library** — Callout, StatCard, CodeBlock, Divider. 4 components, each proving a different code path.

### 2.2 Out of scope (deferred)

- Comprehensive component library (Chart, Image, Table, Tabs, Accordion, Video, Steps, Embed) — Layer 2b
- AI component generation — `/ai-component` visibly present but stubbed ("AI generation comes in Layer 3"). Layer 3
- Mermaid, Math (multi-format rendering phase, per the architecture spec)
- Capability prompts at save time — Layer 2a saves with no declared capabilities; manifest format already supports them
- Collaborative editing / real-time multi-user
- Version history / undo beyond browser-native
- Syntax highlighting in the code peek (Layer 2b polish)

### 2.3 Success criterion

A user can launch the app, open the welcome doc, click Edit, write a new paragraph, insert a Callout via slash, edit its text in the code peek, hit Save, close, reopen, and see their changes persisted.

---

## 3. Architecture & file boundaries

### 3.1 Component tree

```
src/
  App.tsx                          — MODIFIED: adds Editor route + open state for "editing"
  theme/
    tokens.css                     — UNCHANGED
    editor.css                     — NEW: editor-specific tokens (dark code-peek surface, top-bar styles)
  components/
    EmptyState.tsx                 — UNCHANGED
    DocumentView.tsx               — UNCHANGED (still the viewer; onEdit now actually routes)
    EditorView.tsx                 — NEW: editor root; owns mode state, save state, slash menu state
    EditorTopBar.tsx               — NEW: filename, edited-time, Save, Raw toggle, +, close-back-to-viewer
    WysiwygSurface.tsx             — NEW: the rich-text editing surface (TipTap-backed)
    RawEditor.tsx                  — NEW: plain textarea showing full MDX source; raw-mode toggle target
    SlashMenu.tsx                  — NEW: inline menu on "/" — prose blocks + components + AI stub
    InsertButton.tsx               — NEW: the + popover; same items as slash menu
    CodePeek.tsx                   — NEW: dark right-drawer showing one component's JSX, with Apply/Cancel
    ComponentCard.tsx              — NEW: wrapper that renders a registered component in WYSIWYG with a tag + dblclick handler
    components/                    — NEW dir: the starter library
      Callout.tsx
      StatCard.tsx
      CodeBlock.tsx
      Divider.tsx
  registry/
    ComponentRegistry.ts           — NEW: maps component name → definition (see §4)
    serializer.ts                  — NEW: ProseMirror doc ↔ MDX string (the riskiest code, see §6)
  hooks/
    useOpenDocument.ts             — MODIFIED: adds openEditor()/closeEditor() to the state machine
    useEditorState.ts              — NEW: mode (wysiwyg|raw), dirty flag, save-in-flight, peek target
  lib/
    package.ts                     — UNCHANGED
    runner.ts                      — UNCHANGED (WYSIWYG preview reuses it)
    compile.ts                     — NEW: frontend compile() wrapper — MDX source → function-body
    ai.ts, capability.ts, recents.ts — UNCHANGED
```

### 3.2 New Rust commands (Tauri bridge)

- `save_document(path: PathBuf, content_md: String, compiled_js: String, manifest: Manifest)` — writes the three-layer `.mdxz` zip. Compiling happens in the frontend (passed in as `compiled_js`); Rust just zips.
- `save_as_document()` — `Save As…` flow: native picker for destination path, then `save_document`.
- `reveal_in_finder(path)` — optional convenience; low priority.

### 3.3 State machine

```
[launch] → Empty
Empty + open → Document (viewer)
Document + onEdit → Editor
Editor + ✕ (with dirty prompt) → Document (viewer, reloaded from saved state)
Editor + Save → persists, stays in Editor
Editor + Raw toggle → Raw mode (same document, different surface)
```

### 3.4 The save pipeline

```
User clicks Save
  → WYSIWYG: TipTap doc → serialize to MDX source string (content.md)
  → Frontend: compile(mdxSource, {outputFormat:'function-body'}) → compiled string (build/main.js)
  → Bridge: save_document(path, content_md, compiled_js, manifest)
  → Rust: zip { manifest.json, content.md, build/main.js } → write .mdxz
```

The serialize direction (TipTap → MDX) is custom code in `registry/serializer.ts` (~200 lines). Round-tripping (MDX → TipTap → MDX) has to preserve formatting — heavily tested in §6.

---

## 4. Component registry & starter library

### 4.1 Registry shape

```typescript
interface ComponentDefinition {
  name: string;                          // "StatCard" — used in <StatCard /> in MDX
  label: string;                         // "StatCard" — shown in menus
  icon: string;                          // emoji or SVG path for the slash/+ menu
  category: "prose" | "component";       // which slash section it appears in
  insertTemplate: () => string;          // MDX to insert: '<StatCard label="Label" value="Value" />'
  defaultProps: Record<string, unknown>; // for the node view's initial attrs
  render: React.FC<ComponentProps>;      // actual component, used by both WYSIWYG card + compiled preview
  // Layer 2b adds: editSchema (form-based prop editing); Layer 2a uses raw JSX in the peek
}
```

Registry is a simple `Map<string, ComponentDefinition>`. Components registered at app init. MDX serializer and runner both consult it.

### 4.2 Starter library (4 components)

| Component | Code path it proves | Insert template |
|-----------|---------------------|-----------------|
| **Callout** | Pure styling + text children | `<Callout type="info">New callout</Callout>` |
| **StatCard** | Data-driven string props | `<StatCard label="Label" value="Value" />` |
| **CodeBlock** | Stateful interactivity (copy button) | `<CodeBlock language="ts">// code</CodeBlock>` |
| **Divider** | Childless structural | `<Divider />` |

Each exercises a distinct serializer branch (text children, string props, interactive state, no children). Adding a component in Layer 2b is a one-file edit to the registry.

### 4.3 Slash/+ menu contents

- **Prose blocks:** Heading 2, Heading 3, Bulleted list, Numbered list, Quote, Inline code, Divider
- **Components:** Callout, StatCard, CodeBlock, Divider
- **AI:** ✨ AI component… (stub — clicking shows "AI generation comes in Layer 3")

All components render with theme tokens (`var(--accent)` etc.) — none ship with hardcoded colors.

---

## 5. Interaction states & behavior

### 5.1 Mode toggle

- **Enter editor:** DocumentView's hover-controls "Edit" button → `useOpenDocument.openEditor()`. App re-routes to EditorView with the current document's MDX source re-parsed into a TipTap doc.
- **Exit editor:** `✕` in top bar. If dirty, prompt "Save changes? (Save / Discard / Cancel)". On Save or Discard, route back to DocumentView, reload from disk.
- **Raw toggle:** "Raw" button flips WYSIWYG ↔ plain textarea of full MDX source. Flipping back re-parses; invalid MDX refuses the flip with a clear error.

### 5.2 WYSIWYG surface

- TipTap editor bound to document state. ProseMirror schema: headings (H2/H3), paragraphs, bullet/ordered lists, blockquotes, inline code, bold, italic, links, and one custom node type per registered component.
- **Selection styling:** `--accent` caret, `--accent-soft` selection highlight.
- **Keyboard:** standard markdown shortcuts (`## ` → H2, `**bold**` wraps, etc.) via TipTap; no custom handling.
- **Slash trigger:** typing `/` at start of empty line or after whitespace opens SlashMenu inline at cursor. Typing filters list. Escape or space-after closes. Selection inserts and closes.
- **Empty state:** faint "Type / for commands, or just start writing…" placeholder.

### 5.3 Slash menu & Insert button

Same items in both. Slash is keyboard-driven (filters as you type, arrow + Enter to select); `+` opens a popover anchored top-right, click to select. Sections render as small uppercase headers ("Prose blocks", "Components", "AI"). AI item indigo, others `--text`. Selecting a prose block inserts that node at cursor; selecting a component inserts the `insertTemplate()` result and renders it as a node view.

### 5.4 Code peek

- Triggered by double-click on a component card (or selecting the card + `Cmd+E`).
- Dark drawer (`--editor-bg` = `#0d1117`) slides in from right, width ~38% of window, showing that component's raw JSX.
- Focused `<textarea>` (SF Mono) pre-populated with the component's serialized JSX. **No syntax highlighting in Layer 2a** (plain monospace) — belongs with Layer 2b polish.
- **Apply:** re-parses JSX to component attrs, updates the ProseMirror node, drawer closes, card re-renders. **Cancel:** closes, no change.
- **Validation:** edited JSX that doesn't parse (unclosed tag, unknown component) disables Apply with inline "Invalid JSX: <reason>".
- Only one peek open at a time; opening a new one closes the previous.

### 5.5 Save & dirty tracking

- **Dirty flag** set on any TipTap transaction. Top bar shows "edited" with relative time once dirty.
- **Save** (`Cmd+S` or button):
  1. Serialize TipTap doc → MDX source string (`content.md`)
  2. `compile(mdxSource, { outputFormat: 'function-body' })` → compiled JS string (`build/main.js`)
  3. Bridge `save_document(path, content_md, compiled_js, manifest)` → Rust writes the three-layer zip
  4. On success: dirty clears, "Saved" flash, stays in editor. On error: inline error, stays dirty.
- **Save As:** native picker for new path → same flow → updates open document's path.
- **Unsaved-on-close guard:** exiting editor with dirty doc always prompts first.

### 5.6 Raw mode

Plain `<textarea>` filling the document area, monospace, full MDX source. Edits update the source string; flipping back to WYSIWYG re-parses. Parse failures show inline error and refuse the flip. Power-user / debugging / paste-from-elsewhere path.

---

## 6. MDX serializer (the riskiest new code)

The serializer in `registry/serializer.ts` walks the ProseMirror document tree and emits MDX source. It is the single most bug-prone piece of Layer 2a because round-tripping must preserve the user's formatting.

### 6.1 Two directions

- **Serialize (TipTap → MDX):** used on Save. Walks doc, emits MDX per node type.
- **Parse (MDX → TipTap):** used on entering editor (the document's MDX source becomes the initial doc) and on toggling Raw → WYSIWYG. Uses `@mdx-js/mdx`'s parser to produce an AST, then maps AST nodes to ProseMirror nodes.

### 6.2 Node mapping (key cases)

| ProseMirror node | MDX emitted |
|------------------|-------------|
| `heading` (level 2) | `## text\n` |
| `heading` (level 3) | `### text\n` |
| `paragraph` | `text\n\n` |
| `bulletList` / `listItem` | `- text\n` |
| `orderedList` / `listItem` | `1. text\n` |
| `blockquote` | `> text\n` |
| `codeBlock` (inline) | `` `code` `` |
| `bold` mark | `**text**` |
| `italic` mark | `*text*` |
| Component node (`StatCard`) | `<StatCard label="..." value="..." />\n` |
| Component node (`Callout`, with text children) | `<Callout type="info">child text</Callout>\n` |

### 6.3 Round-trip property

For every supported construct, `serialize(parse(mdx)) === mdx` must hold (modulo whitespace normalization we accept and document). The test suite in §7.1 is the gate.

---

## 7. Testing & verification

### 7.1 Frontend tests (Vitest + React Testing Library)

- **`useOpenDocument` (modified):** new transitions (openEditor, closeEditor).
- **`useEditorState`:** mode toggling, dirty flag set/clear, peek-open target.
- **`ComponentRegistry`:** register/lookup, registry-driven slash menu contents, missing-component error.
- **MDX serializer (critical):** round-trip tests — `serialize(parse(mdx)) === mdx` for each starter component + each prose block. This is the suite that catches "saving mangled my document."
- **`SlashMenu`:** opens on `/`, filters by typed text, inserts right block, closes on Escape.
- **`InsertButton`:** opens popover, same items as slash, inserts on click.
- **`CodePeek`:** opens with component JSX, Apply updates node, Cancel doesn't, invalid JSX disables Apply.
- **`EditorView`:** renders top bar + WYSIWYG; toggling Raw swaps to textarea; Save calls bridge with right args.
- **Starter components:** each renders with given props (smoke snapshots).

### 7.2 Rust integration tests

- **`save_document` round-trip:** write a fixture via the new command, reopen via `open_document`, assert all three layers present and content matches. End-to-end save pipeline test.
- Existing `layer1_smoke_test` reused unchanged.

### 7.3 Manual visual verification (user's pixel gate)

The locked mockups are the contract. After implementation:
1. `cargo tauri dev` → open welcome doc → Edit → editor (State 1).
2. Type `/` → slash menu (State 2). Insert a Callout.
3. Double-click the StatCard → code peek (State 3). Edit value, Apply, re-render.
4. Save → reopen from viewer → changes persisted.
5. Toggle Raw → MDX source. Toggle back → WYSIWYG restored.

### 7.4 Definition of done

1. All Vitest tests pass (including round-trip serializer suite).
2. Rust `save_document` round-trip test passes.
3. `cargo tauri dev` → editor reachable, all 4 starter components insertable/editable/savable.
4. Round-trip (edit → save → reopen) preserves content for prose + each starter component.
5. The currently-inert `onEdit` actually routes to the editor.
6. User confirms pixels match the locked mockups.

### 7.5 Not tested in Layer 2a

Comprehensive component library (2b), AI generation (Layer 3), capability prompts at save, collaboration, version history, syntax highlighting in the peek.

---

## 8. Dependencies on prior work

| Reused from | What |
|-------------|------|
| Layer 1 | `App.tsx` routing (extended), `useOpenDocument` (extended), theme tokens, `DocumentView` (unchanged), `onEdit` hook (now wired) |
| Phase 0 | `open_document` command, `PackageContents`, the three-layer format |
| Phase 0 | `lib/runner.ts` (WYSIWYG preview reuses it) |
| Phase 5 | `lib/ai.ts` (untouched — Layer 3 surfaces it) |

New deps: `@tiptap/*` (react, starter-kit, extensions for custom nodes), already-bundled `@mdx-js/mdx` for the compile step.

---

## 9. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Authoring model | Hybrid (WYSIWYG + raw toggle) | Reaches non-technical authors; escape hatch for devs |
| Layout | WYSIWYG-primary with code peek | Document fills window; double-click component → drawer; stays minimal |
| Slash menu | Prose + components + AI stub | Components first-class; AI affordance present, generation deferred |
| Chrome | Minimal top bar + slash + insert | Two insertion paths, one mental model; true to viewer's aesthetic |
| Library scope | 4 starter components now, comprehensive in 2b | Registry/editor is the hard part; components are incremental |
| Layer 2 split | 2a (foundation) then 2b (library) | Each cycle tractable; 2a unblocks; 2b reacts to real use |
| Rich-text engine | TipTap | Custom-node strength; ecosystem; React-first |
| Compile location | Frontend (JS), zip in Rust | Reuses bundled `@mdx-js/mdx`; no Rust MDX toolchain |
| Syntax highlighting in peek | Deferred to 2b | Plain monospace is enough for Layer 2a's raw-JSX edits |
| Capability prompts at save | Deferred | Layer 2a saves with no declared caps; manifest format supports them when needed |
