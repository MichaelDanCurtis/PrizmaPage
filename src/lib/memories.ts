import { invoke } from "@tauri-apps/api/core";

/// Deposit a memory note in <vault>/Memories/. SP8.
export function vaultCreateMemory(vaultPath: string, title: string, content: string, tags: string[]): Promise<string> {
  return invoke<string>("vault_create_memory", { vaultPath, title, content, tags });
}
