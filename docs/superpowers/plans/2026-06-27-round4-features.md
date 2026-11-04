# Round 4 — Implementation Plan

> superpowers:subagent-driven-development or executing-plans. Checkbox tracking.

**Goal:** Five features: SP8 memories UI, drag-to-reorder blocks, inline image resize, link editor popover, version history. Four frontend + small Rust additions (memories, snapshots).

**Spec:** `docs/superpowers/specs/2026-06-27-round4-features-design.md`
**Baseline:** tsc clean; 221 tests; cargo build green.

---

## Phase 1: SP8 Memories creation

### Task 1.1: vault_create_memory Rust command + test

**Files:** `src-tauri/src/lib.rs`, `src-tauri/tests/vault_test.rs`

- [ ] **Step 1: Write failing Rust test**

Append to `src-tauri/tests/vault_test.rs`:
```rust
#[test]
fn vault_create_memory_writes_a_readable_memory() {
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    let state = AppState::test();
    let path = vault_create_memory(
        state::AppState, // adapt to the real signature
        vault.clone(),
        "My memory".into(),
        "some content".into(),
        vec!["tag1".into()],
    ).expect("create memory");
    assert!(path.to_string_lossy().contains("Memories"));
    // Re-open and read content.md
    let opened = crate::package::open_document(&path).unwrap();
    assert!(opened.content_md.contains("My memory"));
    assert!(opened.content_md.contains("some content"));
}
```
(Adapt the AppState import to match how other tests in this file obtain a State/app context — check the existing `vault_create_note` test pattern first.)

- [ ] **Step 2: Run — FAIL** (`cargo test --test vault_test`)

- [ ] **Step 3: Implement the command**

In `src-tauri/src/lib.rs`, near the other vault commands, add (mirroring `mcp_server.rs`'s `vault.remember`):
```rust
/// Deposit a memory note in <vault>/Memories/. Reuses the mcp_server remember
/// logic so users (not only agents) can save memories. Returns the path.
#[tauri::command]
fn vault_create_memory(
    vault_path: std::path::PathBuf,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<std::path::PathBuf, String> {
    let memories_dir = vault_path.join("Memories");
    std::fs::create_dir_all(&memories_dir).map_err(|e| e.to_string())?;
    let safe: String = title.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' }).collect::<String>().trim().to_string();
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let filename = format!("{}-{}.mdxz", if safe.is_empty() { "memory" } else { &safe }, timestamp);
    let path = memories_dir.join(&filename);
    let note_content = format!(
        "# {title}\n\n**Tags:** {}  \n**Deposited:** unix:{timestamp}\n\n---\n\n{content}\n",
        tags.join(", "),
    );
    let m = crate::manifest::Manifest {
        version: "0.1.0".into(),
        origin_domain: Some("memory".into()),
        capabilities: vec![],
        signature: None,
    };
    crate::save::save_document(&path, &note_content, "return { default: () => null }", &m).map_err(|e| e.to_string())?;
    Ok(path)
}
```
(Verify the `Manifest` struct path — `crate::manifest::Manifest` vs `Manifest`; match the existing `vault_create_note` usage.) Register it in `invoke_handler`.

- [ ] **Step 4: Run — PASS**. Commit.
```bash
git add src-tauri/src/lib.rs src-tauri/tests/vault_test.rs
git commit -m "feat(vault): vault_create_memory command (SP8 — user-created memories)"
```

### Task 1.2: MemoryDialog + bridge + wire into VaultDashboard

**Files:** `src/lib/memories.ts`, `src/components/MemoryDialog.tsx` (+ test), `src/components/VaultDashboard.tsx`, `src/App.tsx`, `index.html`

- [ ] **Step 1: Bridge** — `src/lib/memories.ts`:
```typescript
import { invoke } from "@tauri-apps/api/core";
export function vaultCreateMemory(vaultPath: string, title: string, content: string, tags: string[]): Promise<string> {
  return invoke<string>("vault_create_memory", { vaultPath, title, content, tags });
}
```
- [ ] **Step 2: Mock** — add to `index.html` switch: `case 'vault_create_memory': return Promise.resolve('/mock/Memories/memory.mdxz');`
- [ ] **Step 3: MemoryDialog** — a modal with title/content/tags inputs + Save → calls `vaultCreateMemory`.
- [ ] **Step 4: Test** — MemoryDialog renders fields; Save calls the bridge with the right args (mock the bridge).
- [ ] **Step 5: Wire** — `VaultDashboard` "Save memory" button → App opens the dialog → on save, `vault.reload()` and close.
- [ ] **Step 6: tsc + tests + commit.**

## Phase 2: Drag-to-reorder blocks

### Task 2.1: Install + register drag-handle extension

- [ ] `npm install @tiptap/extension-drag-handle@^2.27.2`; verify v2.27.2.
- [ ] Register in `WysiwygSurface` (it's a plugin that adds a handle to hovered nodes). Style the handle via its `tippyOptions`/CSS class.
- [ ] tsc + tests + visual (drag a block, confirm order changes) + commit.

## Phase 3: Inline image resize

### Task 3.1: ImageResize NodeView

- [ ] Create `src/components/ImageResize.tsx` — a TipTap NodeView extension extending Image with a `width` attr + corner-drag handle. Register in `WysiwygSurface` (replace the bare `Image`).
- [ ] Serializer: add width to the image case as a data attribute (editor-only round-trip via JSON; MDX text emits `![alt](src)` unchanged — documented scope).
- [ ] Test: the extension sets `width` attr on resize (unit-test the attr round-trip on a parsed image node).
- [ ] tsc + tests + commit.

## Phase 4: Link editor popover

### Task 4.1: LinkPopover via BubbleMenu

- [ ] `npm install @tiptap/extension-bubble-menu@^2.27.2` (if not present).
- [ ] `src/components/LinkPopover.tsx` — a BubbleMenu shown when `editor.isActive("link")`; editable href field + Apply (`editor.chain().extendMarkRange("link").setLink({href})`) + Remove (`unsetLink`).
- [ ] Register in EditorView (needs the editor instance).
- [ ] Test: popover shows when caret in link; Apply re-sets; Remove unsets (mock editor).
- [ ] tsc + tests + commit.

## Phase 5: Version history

### Task 5.1: Rust snapshot commands + tests

- [ ] Add `vault_snapshot`, `vault_list_versions`, `vault_restore_version` to `lib.rs` (snapshots in `<vault>/.versions/`); register. Tests in `vault_test.rs` (snapshot round-trip; list; restore copies back).
- [ ] cargo test green; commit.

### Task 5.2: HistoryPanel + bridge + wire

- [ ] `src/lib/history.ts` bridge; `src/components/HistoryPanel.tsx` (+ test); wire snapshot-on-save into EditorView's `handleSave` (only when a vault is set); 📋 button in EditorTopBar opens the panel; restore seeds the editor.
- [ ] Mocks in index.html.
- [ ] tsc + tests + commit.

## Final Verification
- [ ] tsc clean; npm test all pass (221 baseline + new); cargo test + build green.
- [ ] Headless walkthrough: memory saved (count++), block dragged, image resized, link edited/removed, snapshot listed/restored.

## Self-Review Notes
- Rust command signatures must match the existing AppState/State pattern — read `vault_create_note` before writing.
- Image width in JSON only (not MDX text) — documented; a future markdown-attr task can emit it.
- Snapshot-on-save runs only with a vault; non-vault single-file docs skip it (no `<vault>` to write to).
