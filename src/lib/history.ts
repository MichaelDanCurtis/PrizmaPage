import { invoke } from "@tauri-apps/api/core";

export interface VersionEntry {
  path: string;
  ts: number; // unix seconds
  label: string;
}

/// Write a timestamped snapshot of the doc to <vault>/.versions/. Returns the path.
export function vaultSnapshot(vaultPath: string, docPath: string, contentMd: string, compiledJs: string): Promise<string> {
  return invoke<string>("vault_snapshot", { vaultPath, docPath, contentMd, compiledJs });
}

/// List version snapshots for a document (newest first).
export function vaultListVersions(vaultPath: string, docPath: string): Promise<VersionEntry[]> {
  return invoke<VersionEntry[]>("vault_list_versions", { vaultPath, docPath });
}

/// Restore a version: copy the snapshot over the live document path.
export function vaultRestoreVersion(src: string, dst: string): Promise<void> {
  return invoke<void>("vault_restore_version", { src, dst });
}
