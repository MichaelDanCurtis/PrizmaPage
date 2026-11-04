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

/// Returns the absolute path to the bundled welcome.mdxz (first-run intro doc).
export function welcomePath(): Promise<string> {
  return invoke<string>("welcome_document_path");
}
