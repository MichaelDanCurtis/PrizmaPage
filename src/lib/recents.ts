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

/// Reveal the document in the system file manager (Finder on macOS) — the
/// primary share entry point. From there the user can AirDrop/Message/Mail.
export function revealDocument(path: string): Promise<void> {
  return invoke("reveal_document", { path });
}

/// Copy the document file to a chosen destination (Save a copy…).
export function copyDocument(src: string, dst: string): Promise<void> {
  return invoke("copy_document", { src, dst });
}

/// Returns the absolute path to the bundled welcome.mdxz (first-run intro doc).
export function welcomePath(): Promise<string> {
  return invoke<string>("welcome_document_path");
}

/// Create a new empty `.mdxz` document at the given path. Returns the path so
/// the caller can open it (straight into the editor). The Rust side writes a
/// minimal three-layer package; nothing is executable until the author adds
/// components and saves.
export function newDocument(path: string): Promise<string> {
  return invoke<string>("new_document", { path });
}
