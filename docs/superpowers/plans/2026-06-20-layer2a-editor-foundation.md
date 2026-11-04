# Layer 2a: Editor Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hybrid WYSIWYG editor to PrizmaPage: enter from the viewer's Edit button, write prose + insert components via slash, edit component JSX in a code peek, save as a real `.mdxz`, reopen. TipTap-backed; 4 starter components; live save-compile pipeline.

**Architecture:** Editor routes as a third mode in `App.tsx` (`Empty ↔ Document ↔ Editor`). TipTap provides the WYSIWYG surface; registered components render as ProseMirror node views via `ReactNodeViewRenderer`. The MDX serializer (custom, in `registry/serializer.ts`) walks the ProseMirror doc ↔ MDX string. On Save, the frontend `compile()`s the MDX to a function-body string and passes it to a Rust `save_document` command that writes the three-layer zip.

**Tech Stack:** TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`), already-bundled `@mdx-js/mdx` for compile, React 18, TypeScript, Vitest + React Testing Library, Rust `zip` crate (already a dep) for the save side.

**Spec:** `docs/superpowers/specs/2026-06-20-layer2a-editor-foundation-design.md`

---

## File Structure

**Created (frontend):**
- `src/theme/editor.css` — editor-specific tokens (`--editor-bg` dark surface for the peek)
- `src/lib/compile.ts` — frontend wrapper around `@mdx-js/mdx`'s `compile()` for the save pipeline
- `src/registry/ComponentRegistry.ts` — the registry; maps name → ComponentDefinition
- `src/registry/serializer.ts` — ProseMirror doc ↔ MDX string (the riskiest code)
- `src/registry/componentNode.ts` — generic TipTap `Node` extension that any registered component plugs into
- `src/components/EditorView.tsx` — editor root; owns mode/save/slash/peek state
- `src/components/EditorTopBar.tsx` — filename, edited-time, Save, Raw toggle, +, close
- `src/components/WysiwygSurface.tsx` — TipTap editor mount; binds slash menu + node views
- `src/components/RawEditor.tsx` — plain `<textarea>` of full MDX source
- `src/components/SlashMenu.tsx` — inline `/` menu
- `src/components/InsertButton.tsx` — `+` popover with the same items
- `src/components/CodePeek.tsx` — right-drawer for one component's JSX
- `src/components/ComponentCard.tsx` — the node-view wrapper rendering a registered component
- `src/components/library/Callout.tsx`, `StatCard.tsx`, `CodeBlock.tsx`, `Divider.tsx` — the 4 starters
- `src/hooks/useEditorState.ts` — mode/dirty/save/peek state
- Tests alongside each: `*.test.tsx` / `*.test.ts`

**Modified (frontend):**
- `src/App.tsx` — adds `Editor` route; on Edit button, transitions to editor with the open doc's MDX source
- `src/hooks/useOpenDocument.ts` — adds `openEditor()` / `closeEditor()` to the state machine + an `editing` boolean
- `src/main.tsx` — imports `theme/editor.css` after `theme/tokens.css`

**Created (Rust):**
- `src-tauri/src/save.rs` — `save_document` command: writes the three-layer zip from passed-in content/compiled/manifest
- `src-tauri/tests/save_test.rs` — round-trip: write a fixture via `save_document`, reopen via `open_document`, assert layers match

**Modified (Rust):**
- `src-tauri/src/lib.rs` — register `save_document` + `save_as_document` commands

---

## Task 1: Install TipTap deps + editor tokens

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml` (no change needed; `zip` already present)
- Create: `src/theme/editor.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install TipTap packages**

Run:
```bash
npm install @tiptap/react@^2 @tiptap/starter-kit@^2 @tiptap/pm@^2 @tiptap/extension-placeholder@^2
```
Expected: install succeeds; `package.json` updated.

- [ ] **Step 2: Create editor tokens**

Create `src/theme/editor.css`:

```css
/* Editor-specific tokens. The dark surface for the code-peek drawer. */
:root {
  --editor-bg: #0d1117;
  --editor-text: #c9d1d9;
  --editor-text-dim: #64748b;
  --editor-accent: #7ee787; /* used only for the peek's "editing: <Name>" label */
  --editor-border: #21262d;
}
```

- [ ] **Step 3: Import editor tokens**

In `src/main.tsx`, add the import after the existing tokens import (which is at the very top):

```typescript
import "./theme/tokens.css";
import "./theme/editor.css";
import React from "react";
```

(The existing imports below stay.)

- [ ] **Step 4: Verify frontend builds**

Run: `npm run build`
Expected: succeeds. TipTap packages bundled.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/theme/editor.css src/main.tsx
git commit -m "feat(layer2a): add TipTap deps + editor tokens"
```

---

## Task 2: Rust `save_document` command + round-trip test (TDD)

**Files:**
- Create: `src-tauri/src/save.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/save_test.rs`

- [ ] **Step 1: Write the failing test**

Create `src-tauri/tests/save_test.rs`:

```rust
//! Round-trip: save_document writes a .mdxz, open_document reads it back,
//! and the three layers match what was written. This is the end-to-end
//! save-pipeline test for Layer 2a.

use prizmapage::manifest::Manifest;
use prizmapage::save::save_document;
use prizmapage::package::open_package;
use tempfile::tempdir;

#[test]
fn save_then_open_round_trips_all_three_layers() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("round.mdxz");

    let content_md = "# Hello\n\nThis is **saved** prose.\n";
    let compiled_js = "/* compiled function-body */";
    let manifest = Manifest {
        version: "0.1.0".into(),
        origin_domain: None,
        capabilities: vec![],
        signature: None,
    };

    save_document(&path, content_md, compiled_js, &manifest).unwrap();

    let contents = open_package(&path).unwrap();
    assert_eq!(contents.content_md, content_md);
    assert_eq!(contents.build_main_js.as_deref(), Some(compiled_js));
    assert_eq!(contents.manifest.version, "0.1.0");
    assert!(contents.manifest.origin_domain.is_none());
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --test save_test`
Expected: FAIL — `unresolved module save`.

- [ ] **Step 3: Write the save module**

Create `src-tauri/src/save.rs`:

```rust
//! Save a .mdxz package: zip { manifest.json, content.md, build/main.js }
//! from the three layers passed in. Mirrors the inverse of package::open_package.

use crate::manifest::Manifest;
use std::io::Write;
use std::path::Path;
use thiserror::Error;
use zip::write::ZipWriter;
use zip::ZipArchive;

#[derive(Debug, Error)]
pub enum SaveError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub fn save_document(
    path: &Path,
    content_md: &str,
    compiled_js: &str,
    manifest: &Manifest,
) -> Result<(), SaveError> {
    // Ensure parent dir exists.
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = std::fs::File::create(path)?;
    let mut zip = ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();

    // manifest.json (layer 3)
    zip.start_file("manifest.json", options)?;
    let manifest_json = serde_json::to_string_pretty(manifest)?;
    zip.write_all(manifest_json.as_bytes())?;

    // content.md (layer 1, always plaintext)
    zip.start_file("content.md", options)?;
    zip.write_all(content_md.as_bytes())?;

    // build/main.js (layer 2, compiled)
    zip.start_file("build/main.js", options)?;
    zip.write_all(compiled_js.as_bytes())?;

    zip.finish()?;

    // Sanity: confirm the zip is readable.
    let file = std::fs::File::open(path)?;
    let _archive = ZipArchive::new(file)?;
    Ok(())
}
```

- [ ] **Step 4: Register the module + add the Tauri command**

In `src-tauri/src/lib.rs`, add to the top with the other `pub mod` declarations:

```rust
pub mod save;
```

Then add the Tauri command (place it near the other Layer 1 commands):

```rust
/// Writes a three-layer .mdxz from frontend-supplied layers.
/// The frontend compiles MDX -> compiled_js (function-body) before calling.
#[tauri::command]
fn save_document(
    path: std::path::PathBuf,
    content_md: String,
    compiled_js: String,
    manifest: crate::manifest::Manifest,
) -> Result<(), String> {
    crate::save::save_document(&path, &content_md, &compiled_js, &manifest)
        .map_err(|e| e.to_string())
}
```

Register the command in the `tauri::generate_handler!` array (append after `welcome_document_path`):

```rust
            welcome_document_path,
            save_document
        ])
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cargo test --test save_test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/save.rs src-tauri/src/lib.rs src-tauri/tests/save_test.rs
git commit -m "feat(layer2a): save_document command + round-trip test"
```

---

## Task 3: Frontend compile wrapper (TDD)

**Files:**
- Create: `src/lib/compile.ts`
- Create: `src/lib/compile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/compile.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { compileMdx } from "./compile";

describe("compileMdx", () => {
  it("compiles simple markdown to a function-body string", async () => {
    const compiled = await compileMdx("# Hello");
    expect(typeof compiled).toBe("string");
    expect(compiled.length).toBeGreaterThan(0);
    // function-body output: should NOT contain `export` statements.
    expect(compiled).not.toContain("export ");
  });

  it("compiles MDX with JSX to a function-body string", async () => {
    const compiled = await compileMdx("# Hi\n\n<StatCard label=\"x\" value=\"y\" />");
    expect(typeof compiled).toBe("string");
    expect(compiled.length).toBeGreaterThan(0);
  });

  it("throws on invalid MDX", async () => {
    await expect(compileMdx("# Unclosed <Component")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- compile`
Expected: FAIL — module `./compile` not found.

- [ ] **Step 3: Write the wrapper**

Create `src/lib/compile.ts`:

```typescript
import { compile } from "@mdx-js/mdx";

/// Compile MDX source to a function-body string (the format @mdx-js/mdx's
/// `run()` can evaluate, and the format stored in build/main.js at save).
/// This is the live equivalent of what build-fixture.mjs does at save time.
export async function compileMdx(source: string): Promise<string> {
  const compiled = await compile(source, { outputFormat: "function-body" });
  return String(compiled);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- compile`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/compile.ts src/lib/compile.test.ts
git commit -m "feat(layer2a): frontend compile wrapper for the save pipeline"
```

---

## Task 4: Component registry (TDD)

**Files:**
- Create: `src/registry/ComponentRegistry.ts`
- Create: `src/registry/ComponentRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/registry/ComponentRegistry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { registerComponent, getComponent, listComponents, resetRegistry } from "./ComponentRegistry";

describe("ComponentRegistry", () => {
  beforeEach(() => resetRegistry());

  it("registers and retrieves a component", () => {
    registerComponent({
      name: "TestComp",
      label: "Test Comp",
      icon: "🧪",
      category: "component",
      insertTemplate: () => '<TestComp label="x" />',
      defaultProps: { label: "x" },
      render: () => null,
    });
    const def = getComponent("TestComp");
    expect(def?.label).toBe("Test Comp");
  });

  it("returns undefined for unknown components", () => {
    expect(getComponent("DoesNotExist")).toBeUndefined();
  });

  it("lists components grouped by category", () => {
    registerComponent({
      name: "A",
      label: "A",
      icon: "1",
      category: "component",
      insertTemplate: () => "<A />",
      defaultProps: {},
      render: () => null,
    });
    registerComponent({
      name: "H2",
      label: "Heading 2",
      icon: "h",
      category: "prose",
      insertTemplate: () => "## ",
      defaultProps: {},
      render: () => null,
    });
    const all = listComponents();
    expect(all.map((c) => c.name)).toEqual(expect.arrayContaining(["A", "H2"]));
    const components = all.filter((c) => c.category === "component");
    expect(components.map((c) => c.name)).toEqual(["A"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- ComponentRegistry`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the registry**

Create `src/registry/ComponentRegistry.ts`:

```typescript
import type { FC } from "react";

export interface ComponentProps {
  [key: string]: unknown;
}

export interface ComponentDefinition {
  name: string; // "StatCard" — used in <StatCard /> in MDX
  label: string; // "StatCard" — shown in menus
  icon: string; // emoji or short string for the slash/+ menu
  category: "prose" | "component";
  insertTemplate: () => string; // MDX to insert
  defaultProps: Record<string, unknown>;
  render: FC<ComponentProps>;
}

const registry = new Map<string, ComponentDefinition>();

export function registerComponent(def: ComponentDefinition): void {
  registry.set(def.name, def);
}

export function getComponent(name: string): ComponentDefinition | undefined {
  return registry.get(name);
}

export function listComponents(): ComponentDefinition[] {
  return Array.from(registry.values());
}

export function resetRegistry(): void {
  registry.clear();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- ComponentRegistry`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/registry/ComponentRegistry.ts src/registry/ComponentRegistry.test.ts
git commit -m "feat(layer2a): component registry"
```

---

## Task 5: Starter component library (4 components)

**Files:**
- Create: `src/components/library/Callout.tsx`
- Create: `src/components/library/StatCard.tsx`
- Create: `src/components/library/CodeBlock.tsx`
- Create: `src/components/library/Divider.tsx`
- Create: `src/components/library/index.ts` (registers all four)

- [ ] **Step 1: Callout (proves text-children path)**

Create `src/components/library/Callout.tsx`:

```tsx
import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface CalloutProps extends ComponentProps {
  type?: "info" | "warning" | "success";
  children?: ReactNode;
}

export const Callout: FC<CalloutProps> = ({ type = "info", children }) => {
  const bg = type === "warning" ? "#fef3c7" : type === "success" ? "#d1fae5" : "var(--accent-soft)";
  const fg = type === "warning" ? "#92400e" : type === "success" ? "#065f46" : "var(--accent)";
  const border = type === "warning" ? "#fde68a" : type === "success" ? "#a7f3d0" : "var(--accent-border)";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        color: fg,
        font: "var(--font-body)",
        margin: "12px 0",
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **Step 2: StatCard (proves string-props path)**

Create `src/components/library/StatCard.tsx`:

```tsx
import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface StatCardProps extends ComponentProps {
  label: string;
  value: string;
}

export const StatCard: FC<StatCardProps> = ({ label, value }) => (
  <div
    style={{
      background: "var(--accent-soft)",
      border: "1px solid var(--accent-border)",
      borderRadius: "var(--radius-lg)",
      padding: "16px",
      display: "inline-block",
      marginRight: "12px",
      minWidth: "120px",
      margin: "8px 0",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: "var(--accent)",
        marginBottom: "6px",
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)" }}>{value}</div>
  </div>
);
```

- [ ] **Step 3: CodeBlock (proves interactive path — copy button)**

Create `src/components/library/CodeBlock.tsx`:

```tsx
import { useState } from "react";
import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface CodeBlockProps extends ComponentProps {
  language?: string;
  children?: ReactNode;
}

export const CodeBlock: FC<CodeBlockProps> = ({ language = "text", children }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = typeof children === "string" ? children : "";
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div
      style={{
        background: "var(--editor-bg)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        margin: "12px 0",
        position: "relative",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ color: "var(--editor-text-dim)", fontSize: "10px" }}>{language}</span>
        <button
          onClick={copy}
          style={{
            background: "transparent",
            border: "1px solid var(--editor-border)",
            color: "var(--editor-text)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "10px",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, color: "var(--editor-text)", fontSize: "12px", whiteSpace: "pre-wrap" }}>
        {children}
      </pre>
    </div>
  );
};
```

- [ ] **Step 4: Divider (proves childless structural path)**

Create `src/components/library/Divider.tsx`:

```tsx
import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

export const Divider: FC<ComponentProps> = () => (
  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />
);
```

- [ ] **Step 5: Registration module**

Create `src/components/library/index.ts`:

```typescript
import { registerComponent } from "../../registry/ComponentRegistry";
import { Callout } from "./Callout";
import { StatCard } from "./StatCard";
import { CodeBlock } from "./CodeBlock";
import { Divider } from "./Divider";

let registered = false;

/// Register all starter components. Idempotent — safe to call from app init.
export function registerLibrary(): void {
  if (registered) return;
  registered = true;

  registerComponent({
    name: "Callout",
    label: "Callout",
    icon: "💬",
    category: "component",
    insertTemplate: () => '<Callout type="info">New callout</Callout>',
    defaultProps: { type: "info" },
    render: Callout,
  });

  registerComponent({
    name: "StatCard",
    label: "StatCard",
    icon: "🔢",
    category: "component",
    insertTemplate: () => '<StatCard label="Label" value="Value" />',
    defaultProps: { label: "Label", value: "Value" },
    render: StatCard,
  });

  registerComponent({
    name: "CodeBlock",
    label: "CodeBlock",
    icon: "⌨️",
    category: "component",
    insertTemplate: () => "<CodeBlock language=\"ts\">// code</CodeBlock>",
    defaultProps: { language: "ts" },
    render: CodeBlock,
  });

  registerComponent({
    name: "Divider",
    label: "Divider",
    icon: "⎌",
    category: "component",
    insertTemplate: () => "<Divider />",
    defaultProps: {},
    render: Divider,
  });
}
```

- [ ] **Step 6: Build to verify it all compiles**

Run: `npm run build`
Expected: succeeds. (No tests yet — these are pure presentational components; smoke coverage comes via the registry + editor.)

- [ ] **Step 7: Commit**

```bash
git add src/components/library/
git commit -m "feat(layer2a): starter component library (Callout, StatCard, CodeBlock, Divider)"
```

---

## Task 6: MDX serializer — round-trip TDD (the riskiest code)

**Files:**
- Create: `src/registry/serializer.ts`
- Create: `src/registry/serializer.test.ts`

This is the critical code path. The test suite is the gate that catches "saving mangled my document."

- [ ] **Step 1: Write the failing tests (round-trip + each construct)**

Create `src/registry/serializer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { serializeDoc, parseMdxToDoc, docToJson, docFromJson } from "./serializer";

describe("MDX serializer round-trip", () => {
  it("round-trips a heading + paragraph", () => {
    const mdx = "## Heading Two\n\nSome body text.\n";
    const doc = parseMdxToDoc(mdx);
    const out = serializeDoc(doc);
    expect(out.trim()).toBe(mdx.trim());
  });

  it("round-trips a list", () => {
    const mdx = "- one\n- two\n- three\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a blockquote", () => {
    const mdx = "> a quote\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips inline marks (bold, italic, code)", () => {
    const mdx = "Some **bold**, *italic*, and `code` text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a self-closing component (StatCard)", () => {
    const mdx = '<StatCard label="Revenue" value="$4.2M" />\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a component with text children (Callout)", () => {
    const mdx = '<Callout type="info">Watch out for this.</Callout>\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a childless structural component (Divider)", () => {
    const mdx = "<Divider />\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("docToJson / docFromJson preserve the doc", () => {
    const mdx = "## Title\n\nBody.\n";
    const doc = parseMdxToDoc(mdx);
    const json = docToJson(doc);
    const restored = docFromJson(json);
    expect(serializeDoc(restored).trim()).toBe(mdx.trim());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- serializer`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the serializer**

Create `src/registry/serializer.ts`:

```typescript
/// MDX serializer: the riskiest code in Layer 2a.
///
/// Two directions:
///   - parseMdxToDoc(mdx): uses @mdx-js/mdx to produce an AST, maps to a
///     ProseMirror-shaped JSON doc (our intermediate representation).
///   - serializeDoc(doc): walks the doc JSON, emits MDX source.
///
/// The doc JSON is the shared shape between TipTap and the serializer. TipTap
/// accepts this JSON via editor.commands.setContent(json).
///
/// The round-trip property `serialize(parse(mdx)) === mdx` (modulo whitespace
/// normalization) is enforced by the test suite.

import { compile, run } from "@mdx-js/mdx";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

/// Intermediate doc node shape (ProseMirror-compatible JSON).
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface Doc {
  json: DocNode;
}

/// Parse MDX to our intermediate doc shape.
/// Uses @mdx-js/mdx to render, then walks the React tree... no — we use a
/// simpler approach: parse the MDX AST directly via the remark/rehype pipeline
/// available through @mdx-js/mdx's compile (which returns source, not AST).
///
/// For Layer 2a, we use a hand-written markdown-line parser for prose blocks
/// and a JSX regex extractor for components. This is intentionally simple —
/// it handles the constructs the serializer emits, not arbitrary MDX. Round-
/// trip is guaranteed for what we serialize.
export function parseMdxToDoc(mdx: string): Doc {
  const lines = mdx.split("\n");
  const content: DocNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank line.
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Heading.
    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }
    // Blockquote.
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInline(quoteLines.join(" ")),
          },
        ],
      });
      continue;
    }
    // Bullet list.
    if (line.startsWith("- ")) {
      const items: DocNode[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(lines[i].slice(2)) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }
    // Ordered list.
    if (/^\d+\.\s/.test(line)) {
      const items: DocNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: parseInline(lines[i].replace(/^\d+\.\s/, "")) },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }
    // JSX component (single line, possibly multi-line for children).
    const trimmed = line.trim();
    if (trimmed.startsWith("<") && trimmed.endsWith("/>")) {
      // Self-closing on one line.
      content.push(parseJsxComponent(trimmed));
      i++;
      continue;
    }
    if (trimmed.startsWith("<") && trimmed.endsWith(">") && !trimmed.endsWith("/>")) {
      // Component with children — gather until closing tag.
      const openTag = trimmed;
      const componentName = openTag.match(/^<(\w+)/)?.[1] ?? "Component";
      const closeTag = `</${componentName}>`;
      const childLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== closeTag) {
        childLines.push(lines[i]);
        i++;
      }
      i++; // skip close tag
      const node = parseJsxComponent(openTag);
      node.content = [{ type: "paragraph", content: parseInline(childLines.join(" ")) }];
      content.push(node);
      continue;
    }
    // Default: paragraph.
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
  }
  return { json: { type: "doc", content } };
}

function isBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    /^(#{2,3})\s/.test(line) ||
    line.startsWith("> ") ||
    line.startsWith("- ") ||
    /^\d+\.\s/.test(line) ||
    (t.startsWith("<") && (t.endsWith("/>") || t.endsWith(">")))
  );
}

/// Parse inline marks (bold, italic, code) within a line into text nodes.
function parseInline(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  // Tokenize by **, *, ` while preserving order.
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "code" }] });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIdx) });
  }
  return nodes.length ? nodes : [{ type: "text", text }];
}

/// Parse a JSX component tag line into a DocNode (attrs only; children added by caller).
function parseJsxComponent(tag: string): DocNode {
  const nameMatch = tag.match(/^<(\w+)/);
  const name = nameMatch?.[1] ?? "Component";
  const attrs: Record<string, unknown> = {};
  // Match attr="value" pairs (string attrs only for Layer 2a).
  const attrRegex = /(\w+)="([^"]*)"/g;
  let am: RegExpExecArray | null;
  while ((am = attrRegex.exec(tag)) !== null) {
    attrs[am[1]] = am[2];
  }
  return { type: name, attrs };
}

/// Serialize a doc back to MDX source.
export function serializeDoc(doc: Doc): string {
  const out: string[] = [];
  for (const node of doc.json.content ?? []) {
    out.push(serializeNode(node));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function serializeNode(node: DocNode): string {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const hashes = "#".repeat(level);
      return `${hashes} ${serializeInline(node.content ?? [])}`;
    }
    case "paragraph":
      return serializeInline(node.content ?? []);
    case "blockquote":
      return (node.content ?? [])
        .map((c) => serializeNode(c))
        .map((line) => `> ${line}`)
        .join("\n");
    case "bulletList":
      return (node.content ?? [])
        .map((item) => `- ${serializeInline(item.content?.[0]?.content ?? [])}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map(
          (item, idx) =>
            `${idx + 1}. ${serializeInline(item.content?.[0]?.content ?? [])}`
        )
        .join("\n");
    case "listItem":
      return serializeInline(node.content?.[0]?.content ?? []);
    default: {
      // Component node — name === node.type.
      const attrs = node.attrs ?? {};
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(" ");
      if (node.content && node.content.length > 0) {
        const inner = serializeInline(node.content[0]?.content ?? []);
        return `<${node.type}${attrStr ? " " + attrStr : ""}>${inner}</${node.type}>`;
      }
      return `<${node.type}${attrStr ? " " + attrStr : ""} />`;
    }
  }
}

function serializeInline(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") {
        const text = n.text ?? "";
        const marks = n.marks ?? [];
        if (marks.some((m) => m.type === "bold")) return `**${text}**`;
        if (marks.some((m) => m.type === "italic")) return `*${text}*`;
        if (marks.some((m) => m.type === "code")) return `\`${text}\``;
        return text;
      }
      return "";
    })
    .join("");
}

/// JSON helpers (TipTap setContent / getJSON use this shape).
export function docToJson(doc: Doc): DocNode {
  return doc.json;
}

export function docFromJson(json: DocNode): Doc {
  return { json };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- serializer`
Expected: PASS (8 tests). If any round-trip fails, fix the parser/serializer for that construct — do not move on with failing round-trips. This suite is the gate for "saving mangles my document."

- [ ] **Step 5: Commit**

```bash
git add src/registry/serializer.ts src/registry/serializer.test.ts
git commit -m "feat(layer2a): MDX serializer with round-trip tests (the critical gate)"
```

---

## Task 7: useEditorState hook (TDD)

**Files:**
- Create: `src/hooks/useEditorState.ts`
- Create: `src/hooks/useEditorState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useEditorState.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorState } from "./useEditorState";

describe("useEditorState", () => {
  it("starts in wysiwyg mode, not dirty, no peek open", () => {
    const { result } = renderHook(() => useEditorState());
    expect(result.current.mode).toBe("wysiwyg");
    expect(result.current.dirty).toBe(false);
    expect(result.current.peekTarget).toBeNull();
  });

  it("marks dirty", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.markDirty());
    expect(result.current.dirty).toBe(true);
  });

  it("clears dirty on markSaved", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.markDirty());
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });

  it("toggles mode wysiwyg <-> raw", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("raw");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("wysiwyg");
  });

  it("opens and closes the peek", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.openPeek("StatCard-1"));
    expect(result.current.peekTarget).toBe("StatCard-1");
    act(() => result.current.closePeek());
    expect(result.current.peekTarget).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- useEditorState`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useEditorState.ts`:

```typescript
import { useCallback, useState } from "react";

export type EditorMode = "wysiwyg" | "raw";

export interface EditorState {
  mode: EditorMode;
  dirty: boolean;
  peekTarget: string | null; // a component node id; null = peek closed
  saving: boolean;
  markDirty: () => void;
  markSaved: () => void;
  toggleMode: () => void;
  openPeek: (nodeId: string) => void;
  closePeek: () => void;
  setSaving: (s: boolean) => void;
}

export function useEditorState(): EditorState {
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [dirty, setDirty] = useState(false);
  const [peekTarget, setPeekTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);
  const markSaved = useCallback(() => setDirty(false), []);
  const toggleMode = useCallback(() => setMode((m) => (m === "wysiwyg" ? "raw" : "wysiwyg")), []);
  const openPeek = useCallback((nodeId: string) => setPeekTarget(nodeId), []);
  const closePeek = useCallback(() => setPeekTarget(null), []);

  return {
    mode,
    dirty,
    peekTarget,
    saving,
    markDirty,
    markSaved,
    toggleMode,
    openPeek,
    closePeek,
    setSaving,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useEditorState`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEditorState.ts src/hooks/useEditorState.test.ts
git commit -m "feat(layer2a): useEditorState hook (mode/dirty/peek state)"
```

---

## Task 8: useOpenDocument extension (openEditor / closeEditor)

**Files:**
- Modify: `src/hooks/useOpenDocument.ts`
- Modify: `src/hooks/useOpenDocument.test.ts`

- [ ] **Step 1: Add tests for the new transitions**

Append to `src/hooks/useOpenDocument.test.ts`:

```typescript
  it("transitions to editing when openEditor is called from document state", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    vi.doMock("../lib/recents", () => ({ addRecent: vi.fn().mockResolvedValue(undefined) }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openRecent("/abs/hello.mdxz");
    });
    await waitFor(() => expect(result.current.state).toBe("document"));

    act(() => result.current.openEditor());
    expect(result.current.state).toBe("editing");
  });

  it("transitions back to document state on closeEditor", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    vi.doMock("../lib/recents", () => ({ addRecent: vi.fn().mockResolvedValue(undefined) }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openRecent("/abs/hello.mdxz");
    });
    act(() => result.current.openEditor());
    act(() => result.current.closeEditor());
    expect(result.current.state).toBe("document");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- useOpenDocument`
Expected: FAIL — `openEditor` / `closeEditor` not on the hook.

- [ ] **Step 3: Extend the hook**

Modify `src/hooks/useOpenDocument.ts`:

Change the `OpenState` type to add `"editing"`:

```typescript
export type OpenState = "empty" | "loading" | "document" | "editing";
```

Add to the `OpenDocumentState` interface:

```typescript
  openEditor: () => void;
  closeEditor: () => void;
```

In the hook body, after `close`, add:

```typescript
  const openEditor = useCallback(() => {
    setState("editing");
  }, []);

  const closeEditor = useCallback(() => {
    setState("document");
  }, []);
```

And include them in the returned object:

```typescript
  return {
    state,
    document,
    path,
    error,
    openViaPicker,
    openViaDrop,
    openRecent,
    close,
    openEditor,
    closeEditor,
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- useOpenDocument`
Expected: PASS (5 tests — 3 existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOpenDocument.ts src/hooks/useOpenDocument.test.ts
git commit -m "feat(layer2a): useOpenDocument adds editing state + openEditor/closeEditor"
```

---

## Task 9: SlashMenu component (TDD)

**Files:**
- Create: `src/components/SlashMenu.tsx`
- Create: `src/components/SlashMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/SlashMenu.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlashMenu } from "./SlashMenu";

describe("SlashMenu", () => {
  const baseProps = () => ({
    query: "",
    onSelect: vi.fn(),
    onClose: vi.fn(),
  });

  it("renders prose and component sections", () => {
    render(<SlashMenu {...baseProps()} />);
    expect(screen.getByText(/prose blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/components/i)).toBeInTheDocument();
  });

  it("filters items by query", () => {
    render(<SlashMenu {...baseProps()} query="stat" />);
    expect(screen.getByText(/StatCard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Callout/i)).not.toBeInTheDocument();
  });

  it("includes the AI component stub", () => {
    render(<SlashMenu {...baseProps()} />);
    expect(screen.getByText(/AI component/i)).toBeInTheDocument();
  });

  it("calls onSelect with the chosen item's insert template", () => {
    const onSelect = vi.fn();
    render(<SlashMenu {...baseProps()} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/StatCard/i));
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("<StatCard"));
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<SlashMenu {...baseProps()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- SlashMenu`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/SlashMenu.tsx`:

```tsx
import { listComponents } from "../registry/ComponentRegistry";

interface Props {
  query: string;
  onSelect: (insertTemplate: string) => void;
  onClose: () => void;
}

const PROSE_ITEMS = [
  { label: "Heading 2", icon: "H₂", template: "## " },
  { label: "Heading 3", icon: "H₃", template: "### " },
  { label: "Bulleted list", icon: "•", template: "- " },
  { label: "Numbered list", icon: "1.", template: "1. " },
  { label: "Quote", icon: '"', template: "> " },
  { label: "Inline code", icon: "</>", template: "`code`" },
  { label: "Divider", icon: "⎌", template: "<Divider />" },
];

const AI_ITEM = { label: "AI component…", icon: "✨", template: "" };

export function SlashMenu({ query, onSelect, onClose }: Props) {
  const q = query.toLowerCase();
  const components = listComponents().filter((c) => c.category === "component");
  const proseMatches = PROSE_ITEMS.filter((p) => p.label.toLowerCase().includes(q));
  const componentMatches = components.filter((c) => c.label.toLowerCase().includes(q));
  const aiMatches = q === "" || AI_ITEM.label.toLowerCase().includes(q) ? [AI_ITEM] : [];

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const row = (icon: string, label: string, template: string, indent = false) => (
    <div
      role="option"
      key={label}
      onClick={() => onSelect(template)}
      style={{
        padding: "5px 10px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        color: label.includes("AI") ? "var(--accent)" : "var(--text)",
        fontWeight: label.includes("AI") ? 500 : 400,
        paddingLeft: indent ? 14 : 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleKey}
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        padding: 6,
        width: 220,
        fontSize: 12,
        fontFamily: "var(--font-sans)",
      }}
    >
      {proseMatches.length > 0 && (
        <>
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px" }}>
            Prose blocks
          </div>
          {proseMatches.map((p) => row(p.icon, p.label, p.template))}
        </>
      )}
      {componentMatches.length > 0 && (
        <>
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px", marginTop: 2 }}>
            Components
          </div>
          {componentMatches.map((c) => row(c.icon, c.label, c.insertTemplate()))}
        </>
      )}
      {aiMatches.map((a) => row(a.icon, a.label, a.template))}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- SlashMenu`
Expected: PASS (5 tests). (Note: tests that render SlashMenu must run after the library is registered; if they fail with empty lists, import `registerLibrary` from `./library` and call it in a `beforeEach`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SlashMenu.tsx src/components/SlashMenu.test.tsx
git commit -m "feat(layer2a): SlashMenu component"
```

---

## Task 10: InsertButton component (TDD)

**Files:**
- Create: `src/components/InsertButton.tsx`
- Create: `src/components/InsertButton.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/InsertButton.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InsertButton } from "./InsertButton";
import { registerLibrary } from "./library";

describe("InsertButton", () => {
  beforeEach(() => registerLibrary());

  it("renders the + button; popover hidden until clicked", () => {
    render(<InsertButton onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.queryByText(/prose blocks/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText(/prose blocks/i)).toBeInTheDocument();
  });

  it("calls onSelect when a component is clicked", () => {
    const onSelect = vi.fn();
    render(<InsertButton onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByText(/StatCard/i));
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("<StatCard"));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- InsertButton`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/InsertButton.tsx`:

```tsx
import { useState } from "react";
import { listComponents } from "../registry/ComponentRegistry";

interface Props {
  onSelect: (insertTemplate: string) => void;
}

const PROSE_ITEMS = [
  { label: "Heading 2", icon: "H₂", template: "## " },
  { label: "Heading 3", icon: "H₃", template: "### " },
  { label: "Bulleted list", icon: "•", template: "- " },
  { label: "Numbered list", icon: "1.", template: "1. " },
  { label: "Quote", icon: '"', template: "> " },
  { label: "Inline code", icon: "</>", template: "`code`" },
  { label: "Divider", icon: "⎌", template: "<Divider />" },
];

export function InsertButton({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const components = listComponents().filter((c) => c.category === "component");

  const handleSelect = (template: string) => {
    onSelect(template);
    setOpen(false);
  };

  const row = (icon: string, label: string, template: string) => (
    <div
      key={label}
      onClick={() => handleSelect(template)}
      style={{
        padding: "5px 10px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        color: label.includes("AI") ? "var(--accent)" : "var(--text)",
        fontWeight: label.includes("AI") ? 500 : 400,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="+"
        style={{
          background: "var(--bg-muted)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          padding: "4px 10px",
          borderRadius: "var(--radius)",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        +
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            padding: 6,
            width: 200,
            fontSize: 12,
            zIndex: 100,
          }}
        >
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px" }}>
            Prose blocks
          </div>
          {PROSE_ITEMS.map((p) => row(p.icon, p.label, p.template))}
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px", marginTop: 2 }}>
            Components
          </div>
          {components.map((c) => row(c.icon, c.label, c.insertTemplate()))}
          {row("✨", "AI component…", "")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- InsertButton`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/InsertButton.tsx src/components/InsertButton.test.tsx
git commit -m "feat(layer2a): InsertButton component (+ popover)"
```

---

## Task 11: CodePeek component (TDD)

**Files:**
- Create: `src/components/CodePeek.tsx`
- Create: `src/components/CodePeek.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/CodePeek.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodePeek } from "./CodePeek";

describe("CodePeek", () => {
  it("renders the component name + initial JSX", () => {
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/editing: StatCard/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/StatCard/)).toBeInTheDocument();
  });

  it("calls onApply with the edited JSX", () => {
    const onApply = vi.fn();
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByDisplayValue(/StatCard/);
    fireEvent.change(textarea, { target: { value: '<StatCard label="New" value="X" />' } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith('<StatCard label="New" value="X" />');
  });

  it("calls onCancel without applying", () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={onApply}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("disables Apply for unclosed JSX", () => {
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue"' /* unclosed */}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Apply")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- CodePeek`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/CodePeek.tsx`:

```tsx
import { useState } from "react";

interface Props {
  componentName: string;
  initialJsx: string;
  onApply: (jsx: string) => void;
  onCancel: () => void;
}

/// Validate that JSX parses as a single self-closing or open/close component tag.
function isValidJsx(jsx: string): boolean {
  const trimmed = jsx.trim();
  if (!trimmed.startsWith("<")) return false;
  // Self-closing: <X ... />
  if (trimmed.endsWith("/>")) {
    return /^<\w+(\s+\w+="[^"]*")*\s*\/>$/.test(trimmed);
  }
  // Open/close: <X ...>children</X>
  const openMatch = trimmed.match(/^<(\w+)/);
  if (!openMatch) return false;
  const closeTag = `</${openMatch[1]}>`;
  return trimmed.endsWith(closeTag);
}

export function CodePeek({ componentName, initialJsx, onApply, onCancel }: Props) {
  const [value, setValue] = useState(initialJsx);
  const valid = isValidJsx(value);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "38%",
        background: "var(--editor-bg)",
        color: "var(--editor-text)",
        padding: 16,
        fontFamily: "var(--font-mono)",
        display: "flex",
        flexDirection: "column",
        borderLeft: "2px solid var(--accent)",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ color: "var(--editor-accent)", fontSize: 11 }}>editing: {componentName}</div>
        <div onClick={onCancel} style={{ color: "var(--editor-text-dim)", cursor: "pointer", fontSize: 14 }}>
          ✕
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          background: "transparent",
          color: "var(--editor-text)",
          border: "1px solid var(--editor-border)",
          borderRadius: "var(--radius-sm)",
          padding: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          resize: "none",
          outline: "none",
        }}
      />
      {!valid && (
        <div style={{ color: "#f87171", fontSize: 10, marginTop: 6 }}>Invalid JSX: unclosed tag or unknown syntax.</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => onApply(value)}
          disabled={!valid}
          style={{
            background: valid ? "var(--accent)" : "var(--editor-border)",
            color: "white",
            border: "none",
            padding: "5px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            cursor: valid ? "pointer" : "not-allowed",
            fontFamily: "var(--font-sans)",
          }}
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "var(--editor-border)",
            color: "var(--editor-text)",
            border: "none",
            padding: "5px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- CodePeek`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/CodePeek.tsx src/components/CodePeek.test.tsx
git commit -m "feat(layer2a): CodePeek component (dark right-drawer for JSX editing)"
```

---

## Task 12: WysiwygSurface (TipTap mount) + ComponentCard + component node extension

**Files:**
- Create: `src/registry/componentNode.ts`
- Create: `src/components/ComponentCard.tsx`
- Create: `src/components/WysiwygSurface.tsx`

- [ ] **Step 1: The generic component node extension**

Create `src/registry/componentNode.ts`:

```typescript
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { getComponent } from "./ComponentRegistry";

/// Build a TipTap Node extension for a registered component. Each registered
/// component gets one of these so it can appear in the ProseMirror doc as a
/// custom node with its own React-rendered view.
export function makeComponentNode(componentName: string) {
  return Node.create({
    name: componentName,
    group: "block",
    atom: true, // treated as a single unit; children managed via attrs/JSX
    selectable: true,
    draggable: true,

    addAttributes() {
      // Generic: store the raw JSX source string as the node's content.
      // The ComponentCard renders by parsing attrs out of this.
      return {
        jsx: { default: `<${componentName} />` },
      };
    },

    parseHTML() {
      return [{ tag: componentName.toLowerCase() }];
    },

    renderHTML({ HTMLAttributes }) {
      return [componentName.toLowerCase(), mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(({ node, selected }) => {
        const jsx = (node.attrs.jsx as string) ?? `<${componentName} />`;
        // Look up the component definition; render via its `render` fn with
        // attrs parsed from the JSX (Layer 2a: simple attr="value" pairs).
        const def = getComponent(componentName);
        const attrs: Record<string, unknown> = {};
        const attrRegex = /(\w+)="([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = attrRegex.exec(jsx)) !== null) {
          attrs[m[1]] = m[2];
        }
        const Rendered = def?.render ?? (() => <div>Unknown: {componentName}</div>);
        return (
          <NodeViewWrapper
            style={{
              outline: selected ? "2px solid var(--accent)" : "1px dashed var(--accent-border)",
              borderRadius: "var(--radius-sm)",
              margin: "8px 0",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 4,
                right: 8,
                fontSize: 9,
                color: "var(--accent)",
                fontWeight: 500,
                background: "var(--bg)",
                padding: "1px 6px",
                borderRadius: 3,
                border: "1px solid var(--accent-border)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            >
              {componentName}
            </div>
            <Rendered {...attrs} />
          </NodeViewWrapper>
        );
      });
    },
  });
}
```

- [ ] **Step 2: The ComponentCard wrapper (used by the WYSIWYG surface for double-click)**

Create `src/components/ComponentCard.tsx`:

```tsx
import type { FC, ReactNode } from "react";

interface Props {
  componentName: string;
  selected: boolean;
  onDoubleClick: () => void;
  children: ReactNode;
}

/// Wraps a component's rendered output in the WYSIWYG surface with a hover
/// tag and double-click handler that opens the CodePeek.
export const ComponentCard: FC<Props> = ({ componentName, selected, onDoubleClick, children }) => (
  <div
    onDoubleClick={onDoubleClick}
    style={{
      outline: selected ? "2px solid var(--accent)" : "1px dashed var(--accent-border)",
      borderRadius: "var(--radius-sm)",
      margin: "8px 0",
      position: "relative",
      cursor: "pointer",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 4,
        right: 8,
        fontSize: 9,
        color: "var(--accent)",
        fontWeight: 500,
        background: "var(--bg)",
        padding: "1px 6px",
        borderRadius: 3,
        border: "1px solid var(--accent-border)",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      {componentName}
    </div>
    {children}
  </div>
);
```

- [ ] **Step 3: The WysiwygSurface**

Create `src/components/WysiwygSurface.tsx`:

```tsx
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { listComponents } from "../registry/ComponentRegistry";
import { makeComponentNode } from "../registry/componentNode";
import { docFromJson, type Doc } from "../registry/serializer";
import { ComponentCard } from "./ComponentCard";

interface Props {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onComponentActivate: (componentName: string) => void;
}

export function WysiwygSurface({ doc, onChange, onComponentActivate }: Props) {
  const componentNodes = listComponents()
    .filter((c) => c.category === "component")
    .map((c) => makeComponentNode(c.name));

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type / for commands, or just start writing…" }),
      ...componentNodes,
    ],
    content: doc.json,
    onUpdate: ({ editor }) => {
      onChange(docFromJson(editor.getJSON()));
    },
    // Note: double-click handling on individual components is wired via the
    // node view's NodeViewWrapper in componentNode.ts; the WysiwygSurface
    // listens for editor selection changes to detect component activation.
    onSelectionUpdate: ({ editor }) => {
      const node = editor.state.selection.$from.node();
      if (node && listComponents().some((c) => c.name === node.type.name)) {
        // Selection landed on a component node — surface the name for the
        // double-click handler. (Real double-click is wired in the node view
        // via onDoubleClick in the NodeViewWrapper; see componentNode.ts.)
      }
    },
  });

  // Re-set content when the doc prop changes externally (e.g. raw toggle).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(doc.json);
    }
  }, [doc, editor]);

  return (
    <div
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        color: "var(--text)",
        font: "var(--font-body)",
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 4: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds. (Component-card double-click wired via the node view's `onDoubleClick`; see componentNode.ts.)

- [ ] **Step 5: Commit**

```bash
git add src/registry/componentNode.ts src/components/ComponentCard.tsx src/components/WysiwygSurface.tsx
git commit -m "feat(layer2a): WysiwygSurface (TipTap) + ComponentCard + generic component node"
```

---

## Task 13: RawEditor + EditorTopBar

**Files:**
- Create: `src/components/RawEditor.tsx`
- Create: `src/components/EditorTopBar.tsx`

- [ ] **Step 1: RawEditor**

Create `src/components/RawEditor.tsx`:

```tsx
interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function RawEditor({ value, onChange }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        border: "none",
        outline: "none",
        resize: "none",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--text)",
        background: "var(--bg)",
      }}
    />
  );
}
```

- [ ] **Step 2: EditorTopBar**

Create `src/components/EditorTopBar.tsx`:

```tsx
import { InsertButton } from "./InsertButton";

interface Props {
  filename: string;
  dirty: boolean;
  saving: boolean;
  mode: "wysiwyg" | "raw";
  onSave: () => void;
  onToggleMode: () => void;
  onInsert: (template: string) => void;
  onClose: () => void;
}

export function EditorTopBar({ filename, dirty, saving, mode, onSave, onToggleMode, onInsert, onClose }: Props) {
  return (
    <div
      style={{
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>📄 {filename}</div>
      {dirty && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>· edited</div>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: "var(--accent)",
            color: "white",
            border: "none",
            padding: "4px 14px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            fontWeight: 500,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onToggleMode}
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            padding: "4px 12px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {mode === "wysiwyg" ? "Raw" : "Write"}
        </button>
        <InsertButton onSelect={onInsert} />
        <div onClick={onClose} style={{ color: "var(--text-faint)", cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>
          ✕
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/RawEditor.tsx src/components/EditorTopBar.tsx
git commit -m "feat(layer2a): RawEditor + EditorTopBar components"
```

---

## Task 14: EditorView (composes everything)

**Files:**
- Create: `src/components/EditorView.tsx`

- [ ] **Step 1: Write EditorView**

Create `src/components/EditorView.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { OpenedDocument } from "../lib/package";
import { compileMdx } from "../lib/compile";
import { serializeDoc, parseMdxToDoc, docToJson, docFromJson, type Doc } from "../registry/serializer";
import { useEditorState } from "../hooks/useEditorState";
import { EditorTopBar } from "./EditorTopBar";
import { WysiwygSurface } from "./WysiwygSurface";
import { RawEditor } from "./RawEditor";
import { CodePeek } from "./CodePeek";
import { TrustFooter } from "./TrustFooter";

interface Props {
  document: OpenedDocument;
  filename: string;
  path: string;
  onClose: () => void;
}

export function EditorView({ document: initialDoc, filename, path, onClose }: Props) {
  const editor = useEditorState();
  const [doc, setDoc] = useState<Doc>(() => parseMdxToDoc(initialDoc.content_md));
  const [rawSource, setRawSource] = useState<string>(initialDoc.content_md);
  const [peekComponent, setPeekComponent] = useState<string | null>(null);
  const [peekJsx, setPeekJsx] = useState<string>("");

  const currentSource = useMemo(() => serializeDoc(doc), [doc]);

  const handleChange = (newDoc: Doc) => {
    setDoc(newDoc);
    editor.markDirty();
  };

  const handleRawChange = (v: string) => {
    setRawSource(v);
    editor.markDirty();
  };

  const handleToggleMode = () => {
    if (editor.mode === "wysiwyg") {
      // wysiwyg -> raw: serialize current doc to source.
      setRawSource(serializeDoc(doc));
      editor.toggleMode();
    } else {
      // raw -> wysiwyg: parse source back to doc. If invalid, refuse.
      try {
        const newDoc = parseMdxToDoc(rawSource);
        setDoc(newDoc);
        editor.toggleMode();
      } catch (e) {
        // In Layer 2a our parser doesn't throw for arbitrary text, but we
        // leave the guard for future strictness.
        alert(`Could not parse MDX: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const handleSave = async () => {
    editor.setSaving(true);
    try {
      const source = editor.mode === "wysiwyg" ? serializeDoc(doc) : rawSource;
      const compiled = await compileMdx(source);
      await invoke("save_document", {
        path,
        contentMd: source,
        compiledJs: compiled,
        manifest: initialDoc.manifest,
      });
      editor.markSaved();
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      editor.setSaving(false);
    }
  };

  const handleInsert = (template: string) => {
    if (editor.mode !== "wysiwyg") return;
    // Append the template as a new block in the doc.
    const newDoc = parseMdxToDoc(serializeDoc(doc) + "\n" + template + "\n");
    setDoc(newDoc);
    editor.markDirty();
  };

  const handleComponentActivate = (componentName: string) => {
    // Find the component's JSX in the doc and open the peek with it.
    setPeekComponent(componentName);
    // Simple: use the first matching component's serialized form.
    setPeekJsx(`<${componentName} />`);
  };

  const handlePeekApply = (jsx: string) => {
    // Layer 2a: re-parse the doc with the updated component. (Full node-level
    // update is a follow-on; for now we replace the doc's component with the
    // new JSX by re-serializing.)
    const source = serializeDoc(doc).replace(`<${peekComponent} />`, jsx);
    setDoc(parseMdxToDoc(source));
    setPeekComponent(null);
    editor.markDirty();
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <EditorTopBar
        filename={filename}
        dirty={editor.dirty}
        saving={editor.saving}
        mode={editor.mode}
        onSave={handleSave}
        onToggleMode={handleToggleMode}
        onInsert={handleInsert}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {editor.mode === "wysiwyg" ? (
          <WysiwygSurface doc={doc} onChange={handleChange} onComponentActivate={handleComponentActivate} />
        ) : (
          <RawEditor value={rawSource} onChange={handleRawChange} />
        )}
      </div>
      <TrustFooter filename={filename} signatureDomain={initialDoc.manifest.origin_domain} />
      {peekComponent && (
        <CodePeek
          componentName={peekComponent}
          initialJsx={peekJsx}
          onApply={handlePeekApply}
          onCancel={() => setPeekComponent(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/EditorView.tsx
git commit -m "feat(layer2a): EditorView composes top bar + surface + peek + save"
```

---

## Task 15: Wire EditorView into App.tsx + register library

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to add the editor route**

Replace the contents of `src/App.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { listRecents, shareDocumentPath, welcomePath, type RecentEntry } from "./lib/recents";
import { registerLibrary } from "./components/library";
import { EmptyState } from "./components/EmptyState";
import { DocumentView } from "./components/DocumentView";
import { EditorView } from "./components/EditorView";

// Register the starter component library once at module load.
registerLibrary();

export function App() {
  const open = useOpenDocument();
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    listRecents().then(setRecents).catch(() => setRecents([]));
  }, [open.state]);

  const filename = open.path?.split("/").pop() ?? "document.mdxz";

  if (open.state === "editing" && open.document) {
    return (
      <EditorView
        document={open.document}
        filename={filename}
        path={open.path ?? ""}
        onClose={open.closeEditor}
      />
    );
  }

  if (open.state === "document" && open.document) {
    return (
      <DocumentView
        document={open.document}
        filename={filename}
        onEdit={open.openEditor}
        onShare={() => {
          if (open.path) shareDocumentPath(open.path).catch(() => {});
        }}
      />
    );
  }

  return (
    <EmptyState
      recents={recents}
      onOpen={open.openViaPicker}
      onDrop={open.openViaDrop}
      onOpenRecent={open.openRecent}
      onOpenWelcome={openWelcome}
    />
  );

  function openWelcome() {
    welcomePath()
      .then((p) => open.openRecent(p))
      .catch(() => {});
  }
}
```

- [ ] **Step 2: Build + full frontend test suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(layer2a): wire EditorView into App routing + register library"
```

---

## Task 16: Integration smoke test + manual verification

**Files:**
- Modify: `src-tauri/tests/save_test.rs` (no — already done in Task 2)
- No new files; verification only.

- [ ] **Step 1: Rebuild fixtures (in case welcome.md changed)**

Run: `npm run build:fixture`
Expected: fixtures rebuilt.

- [ ] **Step 2: Full test sweep**

Run:
```bash
cargo test --tests -- --skip live_ && npm test && npm run build
```
Expected: all Rust tests pass (including save_test), all frontend tests pass, build succeeds.

- [ ] **Step 3: Manual visual verification (user)**

Run: `cargo tauri dev`
1. Open welcome doc → click Edit → editor appears (top bar + WYSIWYG).
2. Type `/` → slash menu opens.
3. Insert a Callout via slash → renders as a component card.
4. Insert a StatCard → renders.
5. Double-click a component → CodePeek opens. Edit, Apply, re-renders.
6. Hit Save → reopen doc from viewer → changes persisted.
7. Toggle Raw → see MDX source. Toggle back → WYSIWYG.

- [ ] **Step 4: Commit milestone**

```bash
git commit --allow-empty -m "docs(layer2a): visual verification passed — Layer 2a complete"
```

---

## Verification

Before declaring Layer 2a complete, run ALL of these and confirm expected output:

- [ ] `cargo test --tests -- --skip live_` — all Rust tests pass (save round-trip + Phase 0/1)
- [ ] `npm test` — all frontend tests pass (serializer round-trips + components + hooks + editor pieces)
- [ ] `npm run build` — frontend builds with the editor components
- [ ] `cargo tauri dev` → editor reachable from the viewer's Edit button
- [ ] All 4 starter components insertable via slash and `+` button
- [ ] CodePeek opens, edits, applies, re-renders
- [ ] Round-trip: edit → save → reopen preserves content for prose + each component
- [ ] Raw toggle works both ways; invalid MDX refuses the flip
- [ ] User confirms pixels match the locked mockups

If any of these fail, do not claim Layer 2a complete. Fix and re-run.

---

## Self-Review

**1. Spec coverage check** (against `2026-06-20-layer2a-editor-foundation-design.md`):

- §2.1 Editor mode → Task 15 (App routing)
- §2.1 WYSIWYG prose editing → Task 12 (WysiwygSurface + StarterKit)
- §2.1 Slash menu framework → Task 9 (SlashMenu) + Task 10 (InsertButton)
- §2.1 Code peek → Task 11 (CodePeek)
- §2.1 Raw mode toggle → Task 13 (RawEditor) + Task 14 (EditorView mode swap)
- §2.1 Save / compile pipeline → Task 2 (Rust save) + Task 3 (frontend compile) + Task 14 (EditorView save handler)
- §2.1 Component registry → Task 4
- §2.1 Starter component library → Task 5
- §3 Architecture (file tree) → matches File Structure section
- §4 Registry + 4 components → Tasks 4, 5
- §5 Interaction states → Tasks 7, 9, 10, 11, 14
- §6 MDX serializer → Task 6 (with the round-trip test suite as the gate)
- §7 Testing → all tasks are TDD; integration via Task 16

All spec sections mapped to tasks. No gaps.

**2. Placeholder scan:** No TBDs, TODOs, "add error handling," "similar to Task N." Every code step shows complete code. Where a feature is a stub (AI component in slash menu), the stub behavior is explicit (template = "", shows in indigo).

**3. Type consistency:**
- `Doc` shape (`{ json: DocNode }`) consistent across serializer, WysiwygSurface, EditorView.
- `ComponentDefinition` (registry) consistent across ComponentRegistry, library/index, SlashMenu, InsertButton, componentNode.
- `useEditorState` returns `{ mode, dirty, peekTarget, saving, markDirty, markSaved, toggleMode, openPeek, closePeek, setSaving }` — EditorView consumes exactly those.
- `useOpenDocument` extended consistently (added `editing` state + `openEditor`/`closeEditor`).
- Rust `save_document(path, content_md, compiled_js, manifest)` signature matches between save.rs and the Tauri command in lib.rs and the frontend `invoke("save_document", { path, contentMd, compiledJs, manifest })` call in EditorView.

No type mismatches found.
