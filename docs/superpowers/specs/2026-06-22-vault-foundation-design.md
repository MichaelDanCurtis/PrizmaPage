# Vault Foundation — Design (SP1)

> **Roadmap position:** SP1 of 10 (PrizmaPage v3 "Vault & Intelligence").

## 1. Goal

Introduce the vault: a chosen folder of `.mdxz` files the editor treats as a workspace. On launch, the app shows a centered dashboard for the vault (name, counts, recent, big actions). A file tree browses/creates/renames/deletes notes. From viewer mode, a "File in vault…" action copies or moves a standalone `.mdxz` into the vault folder. Single-document opening remains fully supported as a first-class path — the vault is home, not a requirement.

**Viewer mode is unchanged.** All vault concepts live in editor/empty-state. A recipient opening a shared `.mdxz` never sees vault UI.

## 2. Rust commands

- `vault_set_path(path)` — store the vault folder in settings (`prizma.vault.path` in localStorage on the frontend, but the path is also passed to Rust for file ops).
- `vault_list(path)` → `Vec<VaultEntry { name, path, is_folder, modified: u64 }>` — recursively list `.mdxz` files and folders under the vault, with mtimes for "recent."
- `vault_create_note(vault_path, title)` → writes an empty `.mdxz` (reuses `new_document` logic) at `<vault>/<Title>.mdxz`, returns the path.
- `vault_rename(from, to)` / `vault_delete(path)` — file ops with folder-awareness (delete a folder recurses).
- `vault_file_in(src, vault_path, mode)` where mode is "copy" | "move" — the viewer→vault bridge. Returns the new in-vault path.

Existing `new_document` is reused for create-note (it already writes a minimal empty `.mdxz`).

## 3. Frontend

- **`useVault` hook** — loads/holds the vault path + entries; refresh on focus/creation/rename/delete.
- **`VaultDashboard`** (replaces `EmptyState` when a vault is set) — centered: vault name, counts (notes, unfiled, recent), action buttons (New note, Browse vault, Open single file), inline recent list. If no vault set yet, a "Choose vault folder" prompt.
- **`FileTree`** component — recursive tree, expand/collapse folders, active highlight, create/rename/delete via context menu, double-click to open.
- **`EmptyState` retained** for the "no vault set" case, with an added "Choose vault folder" button (and the existing Open/New/Settings still work — single-file path is unchanged).
- **App routing** — `empty` state shows `VaultDashboard` (if vault set) or `EmptyState` (if not). `document`/`editing` states unchanged.
- **Viewer "File in vault…"** — new entry in the `ShareMenu` (or a dedicated button in `HoverControls`): opens a small dialog (copy/move), calls `vault_file_in`, then offers to open the in-vault copy in the editor.

## 4. Testing

- Rust unit: `vault_list` returns entries with correct names/types; `vault_create_note` writes a readable `.mdxz`; `vault_file_in` copy/move round-trips; rename/delete work.
- Frontend: `useVault` loads entries; `VaultDashboard` renders counts + recent; `FileTree` renders recursively and calls open on double-click.
- Visual: dashboard shows on launch; file tree navigates; creating a note opens it in the editor; filing a viewed doc lands it in the vault.

## 5. Non-goals

- Wikilinks/backlinks/graph (SP3/4).
- TOC pane layout changes (SP2).
- Search (SP4).
- The "Memories/" and "Daily/" conventions are established in SP8.
