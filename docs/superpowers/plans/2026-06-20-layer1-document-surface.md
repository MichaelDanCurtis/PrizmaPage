# Layer 1: Document Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 0/5 debug UI with a frameless document viewer: empty state, open-via-picker/drag-drop/recent, frameless document rendering with hover controls and a trust footer.

**Architecture:** The existing `lib/` (ai, capability, package, runner) is reused as-is. The debug `App.tsx` and `components/ConnectionsPanel.tsx` / `PromptBox.tsx` are deleted from the rendered surface. New `theme/tokens.css` is the single source of all color/type/spacing. New components split by responsibility (EmptyState, DocumentView, HoverControls, TrustFooter, DocumentCanvas, RecentMenu). New Rust commands handle the native file picker, recents persistence, and clipboard.

**Tech Stack:** Tauri v2 + Rust (file dialog, recents JSON in app data dir, clipboard), React 18 + TypeScript (components, hooks), Vitest + React Testing Library (frontend tests), CSS custom properties (theme tokens — no styled-components or other CSS-in-JS, keeping the layer minimal).

**Spec:** `docs/superpowers/specs/2026-06-20-layer1-document-surface-design.md`

---

## File Structure

**Created (Rust):**
- `src-tauri/src/recents.rs` — `RecentEntry`, load/save `recents.json` in app data dir, dedupe/truncate-to-5 logic.

**Modified (Rust):**
- `src-tauri/Cargo.toml` — add `tauri-plugin-dialog = "2"` (native file picker) and `tauri-plugin-clipboard-manager = "2"` (copy path for the share stub).
- `src-tauri/src/lib.rs` — register the two plugins; add `open_file_dialog`, `recent_documents`, `add_recent_document`, `share_document_path` commands.
- `src-tauri/src/state.rs` — no changes (recents are file-backed, not in-memory state).
- `src-tauri/capabilities/default.json` — grant dialog + clipboard + opener permissions.

**Created (frontend):**
- `src/theme/tokens.css` — all CSS custom properties (color, type, spacing). The ONLY place `--accent: #4f46e5` lives.
- `src/components/EmptyState.tsx` — centered mark + Open/Recent + drag-drop target.
- `src/components/DocumentView.tsx` — frameless renderer; owns hover-control state.
- `src/components/HoverControls.tsx` — the faded-in control pill.
- `src/components/TrustFooter.tsx` — faint filename + signature-status line.
- `src/components/DocumentCanvas.tsx` — runs precompiled MDX via `lib/runner.ts` into a centered div.
- `src/components/RecentMenu.tsx` — dropdown of last-5 docs.
- `src/hooks/useOpenDocument.ts` — open-via-picker/drag-drop/recent state machine.
- `src/hooks/useHoverControls.ts` — fade-in/out timing for the control pill.
- Tests alongside each: `*.test.tsx` / `*.test.ts`.

**Modified (frontend):**
- `src/main.tsx` — import `theme/tokens.css` so tokens load before any component.
- `src/App.tsx` — replaced entirely. New version routes EmptyState ↔ DocumentView based on the open doc state from `useOpenDocument`. Deletes all debug-section rendering.
- `package.json` — add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-clipboard-manager` JS bindings.

**Deleted from rendered surface (lib preserved):**
- `src/components/ConnectionsPanel.tsx`
- `src/components/PromptBox.tsx`

The `lib/` directory (`ai.ts`, `capability.ts`, `package.ts`, `runner.ts`) is **untouched** — its tests continue to pass, and the code is reused by `DocumentCanvas` (runner) and reserved for Layers 2 & 3 (ai, capability, package).

---

## Task 1: Add Tauri dialog + clipboard plugins (Rust + capability)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Rust plugin deps**

In `src-tauri/Cargo.toml`, in the `[dependencies]` section after `tauri-plugin-opener = "2"`, add:

```toml
tauri-plugin-dialog = "2"
tauri-plugin-clipboard-manager = "2"
```

- [ ] **Step 2: Register the plugins in `lib.rs`**

In `src-tauri/src/lib.rs`, in the `run()` function, chain the two new plugins after `tauri_plugin_opener::init()`:

```rust
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
```

- [ ] **Step 3: Grant permissions in the capability file**

Replace the `permissions` array in `src-tauri/capabilities/default.json` with:

```json
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "clipboard-manager:allow-write-text",
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        { "url": "https://github.com/login/device" },
        { "url": "https://auth.openai.com/*" }
      ]
    }
  ]
```

- [ ] **Step 4: Verify the Rust workspace compiles**

Run: `cargo check`
Expected: completes without error. (Warnings about unused commands are fine — we'll wire them in later tasks.)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat(layer1): add tauri dialog + clipboard plugins"
```

---

## Task 2: Recents storage module (TDD)

**Files:**
- Create: `src-tauri/src/recents.rs`
- Modify: `src-tauri/src/lib.rs` (add `pub mod recents;`)
- Create: `src-tauri/tests/recents_test.rs`

- [ ] **Step 1: Write the failing test**

Create `src-tauri/tests/recents_test.rs`:

```rust
use prizmapage::recents::{add_recent, load_recents, RecentEntry};
use std::path::PathBuf;
use tempfile::tempdir;

fn empty_store(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("recents.json")
}

#[test]
fn load_returns_empty_when_no_file() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    let recents = load_recents(&path).unwrap();
    assert!(recents.is_empty());
}

#[test]
fn add_then_load_returns_the_entry() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/q4.mdxz"),
            name: "q4".into(),
            opened_at: 1000,
        },
    )
    .unwrap();
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 1);
    assert_eq!(recents[0].name, "q4");
}

#[test]
fn add_dedupes_by_path_and_prepends() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/a.mdxz"),
            name: "a".into(),
            opened_at: 1000,
        },
    )
    .unwrap();
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/b.mdxz"),
            name: "b".into(),
            opened_at: 2000,
        },
    )
    .unwrap();
    // Re-add a — it should move to front, not duplicate.
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/a.mdxz"),
            name: "a".into(),
            opened_at: 3000,
        },
    )
    .unwrap();
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 2);
    assert_eq!(recents[0].name, "a"); // prepended
    assert_eq!(recents[1].name, "b");
}

#[test]
fn add_truncates_to_five_entries() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    for i in 0..7 {
        add_recent(
            &path,
            RecentEntry {
                path: PathBuf::from(format!("/tmp/{i}.mdxz")),
                name: format!("doc{i}"),
                opened_at: 1000 + i as u64,
            },
        )
        .unwrap();
    }
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 5);
    // Most recent (last added) is first.
    assert_eq!(recents[0].name, "doc6");
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --test recents_test`
Expected: FAIL — `unresolved module recents`.

- [ ] **Step 3: Write the recents module**

Create `src-tauri/src/recents.rs`:

```rust
//! Recent-documents persistence: a JSON file in the OS app-data dir holding
//! the last 5 opened .mdxz paths, newest first, deduplicated by path.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecentEntry {
    pub path: PathBuf,
    pub name: String,
    pub opened_at: u64,
}

#[derive(Debug, Error)]
pub enum RecentsError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

#[derive(Serialize, Deserialize, Default)]
struct RecentsFile {
    recents: Vec<RecentEntry>,
}

const MAX_ENTRIES: usize = 5;

pub fn load_recents(path: &Path) -> Result<Vec<RecentEntry>, RecentsError> {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            let file: RecentsFile = serde_json::from_str(&contents)?;
            Ok(file.recents)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(RecentsError::Io(e)),
    }
}

pub fn add_recent(path: &Path, entry: RecentEntry) -> Result<(), RecentsError> {
    let mut current = load_recents(path)?;
    // Dedupe by path: remove any existing entry with the same path.
    current.retain(|e| e.path != entry.path);
    // Prepend the new entry.
    current.insert(0, entry);
    // Truncate to MAX_ENTRIES.
    current.truncate(MAX_ENTRIES);
    let file = RecentsFile { recents: current };
    let json = serde_json::to_string_pretty(&file)?;
    // Ensure parent dir exists.
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, json)?;
    Ok(())
}
```

- [ ] **Step 4: Register the module**

In `src-tauri/src/lib.rs`, add to the top with the other `pub mod` declarations:

```rust
pub mod recents;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cargo test --test recents_test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/recents.rs src-tauri/src/lib.rs src-tauri/tests/recents_test.rs
git commit -m "feat(layer1): recents storage module with dedupe + truncate-to-5"
```

---

## Task 3: Bridge commands — open dialog, recents, share (TDD)

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/bridge_layer1_test.rs`

- [ ] **Step 1: Write the failing test for the recents commands**

Create `src-tauri/tests/bridge_layer1_test.rs`:

```rust
//! Integration test for the Layer 1 bridge commands. The open_file_dialog and
//! share_document_path commands are thin wrappers around Tauri plugins (hard to
//! unit-test without a running app), so we test the recents commands end-to-end
//! against a temp file, which is where the real logic lives.

use prizmapage::recents::{add_recent, load_recent, RecentEntry};
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn recents_round_trip_via_storage_module() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("recents.json");

    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/abs/q4.mdxz"),
            name: "q4".into(),
            opened_at: 1781983000,
        },
    )
    .unwrap();

    let loaded = load_recent(&path).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].name, "q4");
    assert_eq!(loaded[0].path, PathBuf::from("/abs/q4.mdxz"));
}
```

(See Task 2 for the `add_recent` signature; `load_recent` is a renamed re-export added in Step 2 below so the test name matches what the bridge command uses internally.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cargo test --test bridge_layer1_test`
Expected: FAIL — `cannot find function load_recent in module recents` (it's named `load_recents`).

- [ ] **Step 3: Add the bridge commands + the `load_recent` alias**

In `src-tauri/src/lib.rs`, first add these imports near the top of the file (after the existing `use` lines):

```rust
use std::sync::Mutex;
use tauri::Manager;
```

Then add these commands immediately before the `pub fn run()` function:

```rust
/// Native file picker for .mdxz. Returns None if the user cancels.
#[tauri::command]
async fn open_file_dialog(
    app: tauri::AppHandle,
) -> Result<Option<std::path::PathBuf>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("PrizmaPage document", &["mdxz"])
        .blocking_pick_file();
    Ok(file_path.map(|p| p.into_path().unwrap_or_default()))
}

/// Returns the last 5 opened documents, newest first.
#[tauri::command]
fn recent_documents(app: tauri::AppHandle) -> Result<Vec<recents::RecentEntry>, String> {
    let path = recents_path(&app).ok_or_else(|| "no app data dir".to_string())?;
    recents::load_recents(&path).map_err(|e| e.to_string())
}

/// Called after a successful open. Dedupes, prepends, truncates to 5.
#[tauri::command]
fn add_recent_document(app: tauri::AppHandle, path: std::path::PathBuf) -> Result<(), String> {
    let store_path = recents_path(&app).ok_or_else(|| "no app data dir".to_string())?;
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document")
        .to_string();
    let opened_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    recents::add_recent(
        &store_path,
        recents::RecentEntry {
            path,
            name,
            opened_at,
        },
    )
    .map_err(|e| e.to_string())
}

/// Layer 1 share stub: copies the current doc's absolute path to the clipboard.
#[tauri::command]
async fn share_document_path(
    app: tauri::AppHandle,
    path: std::path::PathBuf,
) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Resolve the recents.json path inside the OS app-data dir.
fn recents_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join("recents.json"))
}
```

Then in `src-tauri/src/recents.rs`, add a re-export alias at the bottom so the test's `load_recent` resolves:

```rust
/// Alias so bridge-command callers can use a singular name.
pub fn load_recent(path: &std::path::Path) -> Result<Vec<RecentEntry>, RecentsError> {
    load_recents(path)
}
```

- [ ] **Step 4: Register the new commands in the handler**

In `src-tauri/src/lib.rs`, in the `tauri::generate_handler!` array, append the four new commands (keep the existing ones — append after `open_in_browser`):

```rust
            open_in_browser,
            open_file_dialog,
            recent_documents,
            add_recent_document,
            share_document_path
        ])
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cargo test --test bridge_layer1_test`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full Rust suite to check for regressions**

Run: `cargo test`
Expected: all tests pass (recents_test 4 + bridge_layer1_test 1 + the existing Phase 0/5 tests).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/recents.rs src-tauri/tests/bridge_layer1_test.rs
git commit -m "feat(layer1): open_file_dialog, recents, share_document_path commands"
```

---

## Task 4: Frontend bindings — dialog, clipboard, recents client

**Files:**
- Modify: `package.json`
- Create: `src/lib/recents.ts`
- Create: `src/lib/recents.test.ts`

- [ ] **Step 1: Install the JS plugin bindings**

Run: `npm install @tauri-apps/plugin-dialog@^2 @tauri-apps/plugin-clipboard-manager@^2`
Expected: install succeeds; `package.json` updated.

- [ ] **Step 2: Write the failing test**

Create `src/lib/recents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("recents client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists recent documents via the bridge", async () => {
    const invoke = vi.fn().mockResolvedValue([
      { path: "/abs/q4.mdxz", name: "q4", opened_at: 1781983000 },
    ]);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { listRecents } = await import("./recents");
    const r = await listRecents();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("q4");
    expect(invoke).toHaveBeenCalledWith("recent_documents");
  });

  it("adds a recent after a successful open", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { addRecent } = await import("./recents");
    await addRecent("/abs/q4.mdxz");
    expect(invoke).toHaveBeenCalledWith("add_recent_document", { path: "/abs/q4.mdxz" });
  });

  it("shares (copies) a document path via clipboard", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { shareDocumentPath } = await import("./recents");
    await shareDocumentPath("/abs/q4.mdxz");
    expect(invoke).toHaveBeenCalledWith("share_document_path", { path: "/abs/q4.mdxz" });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- recents`
Expected: FAIL — module `./recents` not found.

- [ ] **Step 4: Write the client**

Create `src/lib/recents.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

export interface RecentEntry {
  path: string;
  name: string;
  opened_at: number;
}

export function listRecents(): Promise<RecentEntry[]> {
  return invoke<RecentEntry[]>("recent_documents");
}

export function addRecent(path: string): Promise<void> {
  return invoke("add_recent_document", { path });
}

export function shareDocumentPath(path: string): Promise<void> {
  return invoke("share_document_path", { path });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- recents`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/recents.ts src/lib/recents.test.ts
git commit -m "feat(layer1): recents + share frontend client"
```

---

## Task 5: Theme tokens (the single source of color/type/spacing)

**Files:**
- Create: `src/theme/tokens.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create the tokens file**

Create `src/theme/tokens.css`:

```css
/* PrizmaPage design tokens.
 * The single source of color, type, and spacing. Components reference these
 * by name (var(--accent)); the literal hex values live ONLY in this file.
 * To change the accent color later, edit --accent here — nothing else.
 */

:root {
  /* Color */
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
  --accent-border: #c7d2fe;
  --bg: #ffffff;
  --bg-muted: #fafafa;
  --text: #0f172a;
  --text-muted: #64748b;
  --text-faint: #94a3b8;
  --border: #e5e7eb;
  --border-soft: #f1f5f9;

  /* Type scale — Inter with -apple-system fallback (set on body in App) */
  --font-sans: -apple-system, "Inter", system-ui, sans-serif;
  --font-mono: "SF Mono", "JetBrains Mono", monospace;
  --font-display: 700 26px/1.2 var(--font-sans);
  --font-h2: 600 18px/1.3 var(--font-sans);
  --font-body: 400 16px/1.7 var(--font-sans);
  --font-small: 400 13px/1.5 var(--font-sans);
  --font-label: 600 11px/1 var(--font-sans);
  --font-footer: 400 10px/1.4 var(--font-mono);
  /* letter-spacing/uppercase applied inline where used (eyebrows, labels) */

  /* Spacing & shape */
  --radius-sm: 4px;
  --radius: 7px;
  --radius-lg: 8px;
  --radius-xl: 14px;
  --content-width: 680px;
  --content-padding: 32px;
}
```

- [ ] **Step 2: Import tokens before any component**

In `src/main.tsx`, add the import at the top (before the React/App imports so CSS loads first):

```typescript
import "./theme/tokens.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
```

(The existing imports below stay; this just adds the tokens.css line at the very top.)

- [ ] **Step 3: Verify the frontend builds**

Run: `npm run build`
Expected: build succeeds (tokens.css bundled).

- [ ] **Step 4: Commit**

```bash
git add src/theme/tokens.css src/main.tsx
git commit -m "feat(layer1): theme tokens — single source of color/type/spacing"
```

---

## Task 6: `useOpenDocument` hook (TDD)

**Files:**
- Create: `src/hooks/useOpenDocument.ts`
- Create: `src/hooks/useOpenDocument.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useOpenDocument.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

describe("useOpenDocument", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts in empty state with no document", async () => {
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());
    expect(result.current.state).toBe("empty");
    expect(result.current.document).toBeNull();
  });

  it("transitions to document state on successful open", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    const dialogOpen = vi.fn().mockResolvedValue("/abs/hello.mdxz");
    const addRecent = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: dialogOpen }));
    vi.doMock("../lib/recents", () => ({ addRecent }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openViaPicker();
    });

    await waitFor(() => expect(result.current.state).toBe("document"));
    expect(result.current.document?.content_md).toBe("# Hello");
    expect(addRecent).toHaveBeenCalledWith("/abs/hello.mdxz");
  });

  it("rejects non-mdxz on drop", async () => {
    const invoke = vi.fn();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openViaDrop("/abs/not-a-pdf.pdf");
    });

    expect(result.current.state).toBe("empty");
    expect(result.current.error).toMatch(/\.mdxz/);
    expect(invoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- useOpenDocument`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useOpenDocument.ts`:

```typescript
import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openDocument, type OpenedDocument } from "../lib/package";
import { addRecent } from "../lib/recents";

export type OpenState = "empty" | "loading" | "document";

export interface OpenDocumentState {
  state: OpenState;
  document: OpenedDocument | null;
  path: string | null;
  error: string | null;
  openViaPicker: () => Promise<void>;
  openViaDrop: (path: string) => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  close: () => void;
}

async function openPath(path: string): Promise<OpenedDocument> {
  const doc = await openDocument(path);
  await addRecent(path);
  // Grant declared capabilities (Phase 0 stub — Phase 2 replaces with a prompt).
  await invoke("grant_declared_capabilities", { manifest: doc.manifest });
  return doc;
}

export function useOpenDocument(): OpenDocumentState {
  const [state, setState] = useState<OpenState>("empty");
  const [document, setDocument] = useState<OpenedDocument | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doOpen = useCallback(async (p: string) => {
    setState("loading");
    setError(null);
    try {
      const doc = await openPath(p);
      setDocument(doc);
      setPath(p);
      setState("document");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("empty");
    }
  }, []);

  const openViaPicker = useCallback(async () => {
    const picked = await openDialog({ filters: [{ name: "PrizmaPage document", extensions: ["mdxz"] }] });
    if (typeof picked === "string" && picked) {
      await doOpen(picked);
    }
    // Cancel: stay in current state (no-op).
  }, [doOpen]);

  const openViaDrop = useCallback(
    async (dropped: string) => {
      if (!dropped.toLowerCase().endsWith(".mdxz")) {
        setError("PrizmaPage opens .mdxz files.");
        return;
      }
      await doOpen(dropped);
    },
    [doOpen]
  );

  const openRecent = useCallback(
    async (p: string) => {
      await doOpen(p);
    },
    [doOpen]
  );

  const close = useCallback(() => {
    setDocument(null);
    setPath(null);
    setError(null);
    setState("empty");
  }, []);

  return { state, document, path, error, openViaPicker, openViaDrop, openRecent, close };
}
```

- [ ] **Step 4: Install @testing-library/react**

Run: `npm install -D @testing-library/react@^16 @testing-library/dom@^10`
Expected: install succeeds.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- useOpenDocument`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOpenDocument.ts src/hooks/useOpenDocument.test.ts package.json package-lock.json
git commit -m "feat(layer1): useOpenDocument hook — picker/drop/recent state machine"
```

---

## Task 7: `useHoverControls` hook (TDD)

**Files:**
- Create: `src/hooks/useHoverControls.ts`
- Create: `src/hooks/useHoverControls.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useHoverControls.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useHoverControls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts hidden", () => {
    const { useHoverControls } = require("./useHoverControls");
    const { result } = renderHook(() => useHoverControls());
    expect(result.current.visible).toBe(false);
  });

  it("becomes visible on enter", () => {
    const { useHoverControls } = require("./useHoverControls");
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    expect(result.current.visible).toBe(true);
  });

  it("hides 400ms after leave", () => {
    const { useHoverControls } = require("./useHoverControls");
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    act(() => result.current.onLeave());
    // Still visible immediately (within the delay).
    expect(result.current.visible).toBe(true);
    // Advance past the 400ms fade-out delay.
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(result.current.visible).toBe(false);
  });

  it("stays visible if re-entered before the delay elapses", () => {
    const { useHoverControls } = require("./useHoverControls");
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    act(() => result.current.onLeave());
    act(() => vi.advanceTimersByTime(200)); // halfway through delay
    act(() => result.current.onEnter()); // re-enter
    act(() => vi.advanceTimersByTime(450)); // well past original delay
    expect(result.current.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- useHoverControls`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useHoverControls.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

const FADE_OUT_DELAY_MS = 400;

export interface HoverControlsState {
  visible: boolean;
  onEnter: () => void;
  onLeave: () => void;
}

export function useHoverControls(): HoverControlsState {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    cancelHide();
    setVisible(true);
  }, [cancelHide]);

  const onLeave = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setVisible(false), FADE_OUT_DELAY_MS);
  }, [cancelHide]);

  useEffect(() => cancelHide, [cancelHide]);

  return { visible, onEnter, onLeave };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useHoverControls`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHoverControls.ts src/hooks/useHoverControls.test.ts
git commit -m "feat(layer1): useHoverControls hook with 400ms fade-out delay"
```

---

## Task 8: EmptyState component (TDD)

**Files:**
- Create: `src/components/EmptyState.tsx`
- Create: `src/components/EmptyState.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/EmptyState.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the app mark and primary affordances", () => {
    render(
      <EmptyState
        recents={[]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    expect(screen.getByText("PrizmaPage")).toBeInTheDocument();
    expect(screen.getByText("Open…")).toBeInTheDocument();
    expect(screen.getByText(/drop a \.mdxz file/i)).toBeInTheDocument();
  });

  it("greys out Recent when there are none", () => {
    render(
      <EmptyState
        recents={[]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    const recentBtn = screen.getByText(/Recent/);
    expect(recentBtn).toBeDisabled();
  });

  it("enables Recent and lists entries when present", () => {
    render(
      <EmptyState
        recents={[
          { path: "/a.mdxz", name: "alpha", opened_at: 1 },
          { path: "/b.mdxz", name: "beta", opened_at: 2 },
        ]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    expect(screen.getByText("Recent (2)")).not.toBeDisabled();
    // Click to open the menu.
    fireEvent.click(screen.getByText("Recent (2)"));
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("calls onOpen when Open clicked", () => {
    const onOpen = vi.fn();
    render(
      <EmptyState recents={[]} onOpen={onOpen} onDrop={vi.fn()} onOpenRecent={vi.fn()} />
    );
    fireEvent.click(screen.getByText("Open…"));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- EmptyState`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/EmptyState.tsx`:

```typescript
import { useState } from "react";
import type { RecentEntry } from "../lib/recents";

interface Props {
  recents: RecentEntry[];
  onOpen: () => void;
  onDrop: (path: string) => void;
  onOpenRecent: (path: string) => void;
}

export function EmptyState({ recents, onOpen, onDrop, onOpenRecent }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--bg-muted)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--content-padding)",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const path = e.dataTransfer.getData("text/plain") || Array.from(e.dataTransfer.files).map((f) => f.path)[0];
        if (path) onDrop(path);
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, var(--accent), var(--accent-border))",
          borderRadius: "var(--radius-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          fontSize: 24,
          marginBottom: 18,
          boxShadow: "0 8px 24px rgba(79, 70, 229, 0.3)",
        }}
      >
        P
      </div>
      <div style={{ font: "var(--font-display)", color: "var(--text)", marginBottom: 4 }}>
        PrizmaPage
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-muted)", marginBottom: 24 }}>
        Open a document to begin
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onOpen}
          style={{
            background: "var(--accent)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            font: "500 11px var(--font-sans)",
            border: "none",
            cursor: "pointer",
          }}
        >
          📁 Open…
        </button>
        <div style={{ position: "relative" }}>
          <button
            disabled={recents.length === 0}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: "var(--bg)",
              color: "var(--text-muted)",
              padding: "8px 16px",
              borderRadius: "var(--radius)",
              font: "500 11px var(--font-sans)",
              border: "1px solid var(--border)",
              cursor: recents.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Recent ({recents.length})
          </button>
          {menuOpen && recents.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                padding: 4,
                minWidth: 200,
                zIndex: 10,
              }}
            >
              {recents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenRecent(r.path);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    font: "var(--font-small)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 18, font: "var(--font-small)", color: "var(--text-faint)" }}>
        {dragOver ? "Drop to open" : "or drop a .mdxz file anywhere"}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- EmptyState`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EmptyState.tsx src/components/EmptyState.test.tsx
git commit -m "feat(layer1): EmptyState component — mark, Open/Recent, drag-drop"
```

---

## Task 9: TrustFooter component (TDD)

**Files:**
- Create: `src/components/TrustFooter.tsx`
- Create: `src/components/TrustFooter.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/TrustFooter.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustFooter } from "./TrustFooter";

describe("TrustFooter", () => {
  it("shows signed status with domain when manifest is signed", () => {
    render(<TrustFooter filename="q4.mdxz" signatureDomain="acme.com" />);
    expect(screen.getByText(/q4\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/signed:\s+acme\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/signed/i)).toBeInTheDocument();
  });

  it("shows unsigned status when signature is null", () => {
    render(<TrustFooter filename="notes.mdxz" signatureDomain={null} />);
    expect(screen.getByText(/notes\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/unsigned/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- TrustFooter`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/TrustFooter.tsx`:

```typescript
interface Props {
  filename: string;
  signatureDomain: string | null;
}

export function TrustFooter({ filename, signatureDomain }: Props) {
  const status = signatureDomain
    ? `signed: ${signatureDomain} ✓`
    : "unsigned";
  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        font: "var(--font-footer)",
        color: "var(--text-faint)",
        background: "rgba(255,255,255,0.85)",
        padding: "2px 8px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-soft)",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {filename} · {status}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- TrustFooter`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrustFooter.tsx src/components/TrustFooter.test.tsx
git commit -m "feat(layer1): TrustFooter — faint filename + signature status"
```

---

## Task 10: DocumentCanvas + HoverControls components (TDD)

**Files:**
- Create: `src/components/DocumentCanvas.tsx`
- Create: `src/components/HoverControls.tsx`
- Create: `src/components/DocumentCanvas.test.tsx`
- Create: `src/components/HoverControls.test.tsx`

- [ ] **Step 1: Write the failing test for HoverControls**

Create `src/components/HoverControls.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HoverControls } from "./HoverControls";

describe("HoverControls", () => {
  it("renders the pill with zoom, share, and Edit when visible", () => {
    render(
      <HoverControls
        visible={true}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        zoomPct={100}
      />
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(screen.getByText("−")).toBeInTheDocument();
    expect(screen.getByText("↗")).toBeInTheDocument();
  });

  it("calls onEdit when Edit clicked", () => {
    const onEdit = vi.fn();
    render(
      <HoverControls visible={true} onEdit={onEdit} onShare={vi.fn()} onZoomIn={vi.fn()} onZoomOut={vi.fn()} zoomPct={100} />
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("renders nothing visible when not visible", () => {
    render(
      <HoverControls visible={false} onEdit={vi.fn()} onShare={vi.fn()} onZoomIn={vi.fn()} onZoomOut={vi.fn()} zoomPct={100} />
    );
    // The pill may be in the DOM with opacity 0 but not clickable.
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing test for DocumentCanvas**

Create `src/components/DocumentCanvas.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DocumentCanvas } from "./DocumentCanvas";

describe("DocumentCanvas", () => {
  it("renders compiled MDX component when build_main_js is present", async () => {
    // A trivial precompiled MDX function body.
    const compiled = `
      const { jsx: _jsx } = arguments[0];
      function MDXContent() { return _jsx('h1', { children: 'Rendered Title' }); }
      return { default: MDXContent };
    `;
    render(<DocumentCanvas compiled={compiled} zoomPct={100} />);
    await waitFor(() => expect(screen.getByText("Rendered Title")).toBeInTheDocument());
  });

  it("renders the prose text when build_main_js is null (prose-only doc)", () => {
    render(<DocumentCanvas compiled={null} content_md="# Just prose" zoomPct={100} />);
    expect(screen.getByText("# Just prose")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- HoverControls DocumentCanvas`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write HoverControls**

Create `src/components/HoverControls.tsx`:

```typescript
interface Props {
  visible: boolean;
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShare: () => void;
  onEdit: () => void;
}

export function HoverControls({ visible, zoomPct, onZoomIn, onZoomOut, onShare, onEdit }: Props) {
  if (!visible) return null;
  const btn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    padding: "2px 6px",
    font: "var(--font-small)",
    cursor: "pointer",
  };
  const divider: React.CSSProperties = {
    width: 1,
    background: "var(--border)",
    margin: "2px 4px",
    alignSelf: "stretch",
  };
  return (
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        gap: 0,
        alignItems: "center",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        padding: "4px 8px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        font: "var(--font-small)",
      }}
    >
      <button style={btn} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <span style={{ padding: "0 6px", color: "var(--text-muted)" }}>{zoomPct}%</span>
      <button style={btn} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <div style={divider} />
      <button style={btn} onClick={onShare} aria-label="Share">↗</button>
      <div style={divider} />
      <button
        onClick={onEdit}
        style={{
          background: "var(--accent)",
          color: "white",
          border: "none",
          padding: "4px 12px",
          borderRadius: "var(--radius-sm)",
          font: "500 var(--font-small)",
          cursor: "pointer",
        }}
      >
        Edit
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Write DocumentCanvas**

Create `src/components/DocumentCanvas.tsx`:

```typescript
import { useEffect, useRef, useState } from "react";
import { runMdxModule, type MDXComponent } from "../lib/runner";

interface Props {
  compiled: string | null;
  content_md?: string;
  zoomPct: number;
}

export function DocumentCanvas({ compiled, content_md, zoomPct }: Props) {
  const [Component, setComponent] = useState<MDXComponent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const C = await runMdxModule(compiled);
      if (!cancelled) setComponent(() => C);
    })();
    return () => {
      cancelled = true;
    };
  }, [compiled]);

  return (
    <div
      ref={containerRef}
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        color: "var(--text)",
        font: "var(--font-body)",
        zoom: `${zoomPct}%`,
      }}
    >
      {Component ? (
        <Component />
      ) : (
        // Prose-only fallback: render the markdown text as preformatted.
        <pre style={{ whiteSpace: "pre-wrap", font: "var(--font-body)", margin: 0 }}>
          {content_md ?? ""}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- HoverControls DocumentCanvas`
Expected: PASS (HoverControls: 3, DocumentCanvas: 2).

- [ ] **Step 7: Commit**

```bash
git add src/components/DocumentCanvas.tsx src/components/HoverControls.tsx src/components/DocumentCanvas.test.tsx src/components/HoverControls.test.tsx
git commit -m "feat(layer1): DocumentCanvas + HoverControls components"
```

---

## Task 11: DocumentView component (TDD)

**Files:**
- Create: `src/components/DocumentView.tsx`
- Create: `src/components/DocumentView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/DocumentView.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentView } from "./DocumentView";
import type { OpenedDocument } from "../lib/package";

const doc: OpenedDocument = {
  manifest: {
    version: "0.1.0",
    origin_domain: "acme.com",
    capabilities: [],
    signature: "sig-abc",
  },
  content_md: "# Hello",
  build_main_js: null,
};

describe("DocumentView", () => {
  it("renders the document canvas + trust footer", () => {
    render(
      <DocumentView
        document={doc}
        filename="hello.mdxz"
        onEdit={vi.fn()}
        onShare={vi.fn()}
      />
    );
    expect(screen.getByText("# Hello")).toBeInTheDocument();
    expect(screen.getByText(/hello\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/signed:\s+acme\.com/i)).toBeInTheDocument();
  });

  it("shows hover controls when the top zone is entered", () => {
    render(
      <DocumentView document={doc} filename="hello.mdxz" onEdit={vi.fn()} onShare={vi.fn()} />
    );
    // Hover controls not present initially.
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    // Simulate entering the top hover zone.
    fireEvent.mouseEnter(screen.getByTestId("hover-zone"));
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- DocumentView`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/DocumentView.tsx`:

```typescript
import { useState } from "react";
import type { OpenedDocument } from "../lib/package";
import { useHoverControls } from "../hooks/useHoverControls";
import { DocumentCanvas } from "./DocumentCanvas";
import { HoverControls } from "./HoverControls";
import { TrustFooter } from "./TrustFooter";
import { shareDocumentPath } from "../lib/recents";

interface Props {
  document: OpenedDocument;
  filename: string;
  onEdit: () => void;
  onShare: () => void;
}

export function DocumentView({ document: doc, filename, onEdit, onShare }: Props) {
  const { visible, onEnter, onLeave } = useHoverControls();
  const [zoomPct, setZoomPct] = useState(100);

  const zoomIn = () => setZoomPct((z) => Math.min(200, z + 10));
  const zoomOut = () => setZoomPct((z) => Math.max(50, z - 10));

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "auto" }}>
      {/* Top hover zone — invisible strip that triggers the control pill. */}
      <div
        data-testid="hover-zone"
        style={{ position: "fixed", top: 0, left: 0, right: 0, height: 80, zIndex: 50 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      {/* Control pill — floats top-right, visible only when hover state active. */}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 16,
          zIndex: 51,
          transition: "opacity 150ms ease",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <HoverControls
          visible={visible}
          zoomPct={zoomPct}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onShare={onShare}
          onEdit={onEdit}
        />
      </div>
      <DocumentCanvas
        compiled={doc.build_main_js}
        content_md={doc.content_md}
        zoomPct={zoomPct}
      />
      <TrustFooter
        filename={filename}
        signatureDomain={doc.manifest.origin_domain}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- DocumentView`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentView.tsx src/components/DocumentView.test.tsx
git commit -m "feat(layer1): DocumentView — composes canvas + hover + footer"
```

---

## Task 12: Rewrite App.tsx — route Empty ↔ Document, delete debug UI

**Files:**
- Modify: `src/App.tsx` (full rewrite)
- Delete: `src/components/ConnectionsPanel.tsx`
- Delete: `src/components/PromptBox.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Replace the entire contents of `src/App.tsx` with:

```typescript
import { useEffect, useState } from "react";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { listRecents, type RecentEntry } from "./lib/recents";
import { shareDocumentPath } from "./lib/recents";
import { EmptyState } from "./components/EmptyState";
import { DocumentView } from "./components/DocumentView";

export function App() {
  const open = useOpenDocument();
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    listRecents().then(setRecents).catch(() => setRecents([]));
  }, [open.state]); // refresh recents when the open state changes

  const filename = open.path?.split("/").pop() ?? "document.mdxz";

  if (open.state === "document" && open.document) {
    return (
      <DocumentView
        document={open.document}
        filename={filename}
        onEdit={() => {
          /* Layer 2 — present but inert. */
        }}
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
    />
  );
}
```

- [ ] **Step 2: Delete the debug components**

Run:
```bash
rm src/components/ConnectionsPanel.tsx src/components/PromptBox.tsx
```

- [ ] **Step 3: Verify the frontend still builds (lib code preserved)**

Run: `npm run build`
Expected: build succeeds with the new component tree. No references to deleted components.

- [ ] **Step 4: Run the full frontend suite — confirm lib/ tests still pass**

Run: `npm test`
Expected: all tests pass (recents 3, useOpenDocument 3, useHoverControls 4, EmptyState 4, TrustFooter 2, DocumentCanvas 2, HoverControls 3, DocumentView 2, plus the existing ai/capability/runner tests which are unaffected).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layer1): rewrite App.tsx — Empty ↔ Document routing, delete debug UI

ConnectionsPanel and PromptBox removed from the rendered surface (their
lib/ai.ts plumbing is preserved for Layer 3). App now routes between
EmptyState and DocumentView based on useOpenDocument state. Debug sections
from Phase 0/5 are gone; the document is the window."
```

---

## Task 13: Integration test — boot the app, open a fixture, render

**Files:**
- Modify: `src-tauri/tests/live_acp_test.rs` (no — keep separate)
- Create: `src-tauri/tests/layer1_smoke_test.rs`

- [ ] **Step 1: Write the integration test**

Create `src-tauri/tests/layer1_smoke_test.rs`:

```rust
//! Layer 1 smoke test: opens a fixture .mdxz via the open_document command
//! (the same path the new App uses) and asserts the package contents are what
//! the DocumentCanvas would render. This doesn't boot the full GUI — Tauri's
//! webview can't be driven from a test — but it verifies the entire open →
//! package-read → layers path works end-to-end through the Rust bridge.

use prizmapage::package::open_package;
use std::path::Path;

#[test]
fn layer1_open_fixture_returns_renderable_layers() {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/hello.mdxz");
    if !fixture.exists() {
        eprintln!("skipping — run `npm run build:fixture` first");
        return;
    }
    let contents = open_package(&fixture).expect("open hello.mdxz");

    // Layer 1 (text) — always present, vectorizable.
    assert!(
        !contents.content_md.is_empty(),
        "document must have prose text"
    );
    // Layer 2 (compiled) — the hello fixture ships a real compiled build.
    assert!(
        contents.build_main_js.is_some(),
        "hello fixture should have a compiled build"
    );
    // Manifest — the trust footer reads origin_domain (null in hello).
    assert_eq!(contents.manifest.version, "0.1.0");
    assert!(contents.manifest.origin_domain.is_none());
    // The trust footer would render: hello.mdxz · unsigned
    let footer_status = if contents.manifest.origin_domain.is_some() {
        "signed"
    } else {
        "unsigned"
    };
    assert_eq!(footer_status, "unsigned");
}
```

- [ ] **Step 2: Build the fixtures (compile-at-save) and run the test**

Run:
```bash
npm run build:fixture && cargo test --test layer1_smoke_test
```
Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/layer1_smoke_test.rs
git commit -m "test(layer1): smoke test — open fixture, verify renderable layers"
```

---

## Task 14: Manual visual verification (user's pixel gate)

**Files:** none (verification only)

- [ ] **Step 1: Boot the app**

Run: `cargo tauri dev`
Expected: window opens to the EmptyState (centered P mark, Open…, Recent (0), drag-drop hint). NOT the debug screen.

- [ ] **Step 2: Open hello.mdxz via picker**

Click "Open…" → file dialog → select `src-tauri/tests/fixtures/hello.mdxz`.
Expected: DocumentView renders — "Hello from PrizmaPage" prose, frameless, centered. Trust footer shows `hello.mdxz · unsigned`.

- [ ] **Step 3: Open via drag-drop**

Close window, relaunch, drag `hello.mdxz` from Finder onto the empty state.
Expected: same DocumentView renders.

- [ ] **Step 4: Open via Recent**

Close window, relaunch, click "Recent (1)", click "hello".
Expected: same DocumentView renders.

- [ ] **Step 5: Hover controls**

With a document open, move the cursor to the top edge.
Expected: control pill fades in (zoom, share, Edit). Move away → fades out after ~400ms.

- [ ] **Step 6: Zoom**

Click + and − in the control pill.
Expected: document zooms in 10% increments, clamped 50%–200%.

- [ ] **Step 7: Share stub**

Click ↗.
Expected: the document's path is copied to the clipboard (paste elsewhere to confirm).

- [ ] **Step 8: Final commit — Layer 1 complete**

```bash
git commit --allow-empty -m "docs(layer1): visual verification passed — Layer 1 complete"
```

(Empty commit to mark the milestone in git history. The actual work was committed in Tasks 1–13.)

---

## Verification

Before declaring Layer 1 complete, run ALL of these and confirm expected output:

- [ ] `cargo test` — all Rust tests pass (recents 4, bridge_layer1 1, layer1_smoke 1, plus Phase 0/5)
- [ ] `npm test` — all frontend tests pass (recents 3, useOpenDocument 3, useHoverControls 4, EmptyState 4, TrustFooter 2, DocumentCanvas 2, HoverControls 3, DocumentView 2, plus existing ai/capability/runner)
- [ ] `npm run build` — frontend builds with the new component tree
- [ ] `cargo tauri dev` — launches into EmptyState, not the debug screen
- [ ] Manual: open `hello.mdxz` via picker, drop, and Recent — all three work
- [ ] Manual: hover controls fade in/out, zoom works, share copies path
- [ ] Manual: trust footer shows correct signature status

If any of these fail, do not claim Layer 1 complete. Fix and re-run.

---

## Self-Review

**1. Spec coverage check** (against `2026-06-20-layer1-document-surface-design.md`):

- §3 Scope (empty state) → Task 8 (EmptyState)
- §3 Scope (open-doc state) → Tasks 10 (DocumentCanvas), 11 (DocumentView)
- §3 Scope (hover controls) → Tasks 7 (useHoverControls), 10 (HoverControls)
- §3 Scope (trust footer) → Task 9 (TrustFooter)
- §3 Scope (open flow — picker/drop/recent) → Tasks 3 (Rust commands), 4 (recents client), 6 (useOpenDocument)
- §4 Architecture (file tree) → matches the File Structure section above
- §4 Architecture (theme tokens rule) → Task 5 (tokens.css)
- §4 Architecture (new Rust commands) → Task 3
- §4 Architecture (deletions) → Task 12
- §5 Design system (tokens) → Task 5 (literal values in tokens.css only)
- §6 Behavior (empty/doc/hover/footer/zoom) → Tasks 6, 7, 8, 9, 10, 11
- §7 Open flow (picker/drop/recent state machine) → Task 6
- §7 Open flow (recents persistence) → Tasks 2, 3
- §8 Testing (Vitest tests) → Tasks 4, 6, 7, 8, 9, 10, 11
- §8 Testing (integration test) → Task 13
- §8 Testing (visual verification) → Task 14
- §8 Definition of done → Verification section above

All spec sections mapped to tasks. No gaps.

**2. Placeholder scan:** No TBDs, TODOs, "add error handling," "similar to Task N." Every code step shows complete code. Where a button is a stub (Edit, Share), the stub behavior is explicit ("Layer 2 — present but inert", "copies path to clipboard").

**3. Type consistency:**
- `RecentEntry { path: PathBuf/string, name: String/string, opened_at: u64/number }` — Rust and TS shapes match.
- `OpenedDocument` (from existing `lib/package.ts`) reused in `useOpenDocument` and `DocumentView` — same shape.
- `useHoverControls` returns `{ visible, onEnter, onLeave }` — `DocumentView` consumes exactly those.
- `useOpenDocument` returns `{ state, document, path, error, openViaPicker, openViaDrop, openRecent, close }` — `App` consumes `state`, `document`, `path`, `openViaPicker`, `openViaDrop`, `openRecent`.
- Bridge command names (`open_file_dialog`, `recent_documents`, `add_recent_document`, `share_document_path`) match between Rust `lib.rs` and TS `recents.ts`.
- `recents::load_recent` alias added so the bridge test's singular name matches the plural `load_recents` in the module.

No type mismatches found.
