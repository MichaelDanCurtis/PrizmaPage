import { invoke } from "@tauri-apps/api/core";

export interface VaultEntry {
  name: string;
  path: string;
  is_folder: boolean;
  modified: number; // unix seconds
}

export function vaultList(vaultPath: string): Promise<VaultEntry[]> {
  return invoke<VaultEntry[]>("vault_list", { vaultPath });
}

export function vaultCreateNote(vaultPath: string, title: string): Promise<string> {
  return invoke<string>("vault_create_note", { vaultPath, title });
}

export function vaultRename(from: string, newName: string): Promise<string> {
  return invoke<string>("vault_rename", { from, newName });
}

export function vaultDelete(path: string): Promise<void> {
  return invoke("vault_delete", { path });
}

export function vaultFileIn(src: string, vaultPath: string, mode: "copy" | "move"): Promise<string> {
  return invoke<string>("vault_file_in", { src, vaultPath, mode });
}

export interface SearchResult {
  path: string;
  name: string;
  snippet: string;
}

export function vaultSearch(vaultPath: string, query: string): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("vault_search", { vaultPath, query });
}

const VAULT_PATH_KEY = "prizma.vault.path";

export function getStoredVaultPath(): string | null {
  return localStorage.getItem(VAULT_PATH_KEY);
}

export function setStoredVaultPath(path: string | null): void {
  if (path) localStorage.setItem(VAULT_PATH_KEY, path);
  else localStorage.removeItem(VAULT_PATH_KEY);
}
