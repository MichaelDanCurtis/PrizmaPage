# Real Sharing — Design

> **Roadmap position:** Sub-project 4 of 7.

## 1. Goal

Replace the path-to-clipboard stub with real sharing. A user viewing a `.mdxz` clicks Share and gets the file into another person's hands: via the macOS share sheet (AirDrop, Messages, Mail) when available, with fallbacks to "Copy file path" and "Save a copy" for environments without a share sheet.

## 2. Approach

Two Rust commands:

- `share_document(path)` — on macOS, opens `NSSharingServicePicker` with the file URL (the native share sheet: AirDrop, Messages, Mail, Notes, etc.). On other platforms or failure, reveals the file in the file manager (`opener::reveal`).
- `save_copy_as(src_path)` — frontend drives a save dialog, then Rust copies the file to the chosen destination.

The viewer's Share button opens a small popover with three options:
1. **Share…** (system share sheet)
2. **Save a copy…** (save-as dialog)
3. **Copy path** (the current behavior, retained for convenience)

## 3. macOS share sheet via objc

macOS doesn't expose NSSharingServicePicker through a Tauri plugin. Use the `objc2` crate (or a minimal `objc` FFI) to invoke it. To keep deps minimal and avoid platform-conditional complexity in this phase, the implementation calls `open_in_browser`-style reveal as the universal fallback and uses `tauri-plugin-opener`'s reveal for the file. The full native share sheet is a documented refinement; this phase delivers "reveal + save-a-copy + copy-path" — concrete, working sharing.

## 4. Files

- Rust: add `share_document` (reveal in Finder) + `copy_document` (to a chosen path). Modify lib.rs.
- Frontend: `ShareMenu.tsx` popover with the three options; wire into HoverControls' Share button.

## 5. Testing

- Rust unit: `copy_document` round-trips (writes a temp, copies, reads back identical bytes).
- Visual: Share popover shows three options; each invokes the right command.

## 6. Non-goals

- Native NSSharingServicePicker (deferred to a refinement — reveal+save-copy+path covers sharing).
- Cloud-upload sharing (Drive/Dropbox).
- Share-to-specific-contact targeting.
