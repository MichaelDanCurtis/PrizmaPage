import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  vaultList,
  vaultCreateNote,
  vaultRename,
  vaultDelete,
  getStoredVaultPath,
  setStoredVaultPath,
  type VaultEntry,
} from "../lib/vault";

/// Holds the vault path + entries, and the operations that mutate them.
/// The vault path persists in localStorage; entries reload whenever the path
/// changes or after a mutating op (create/rename/delete/file-in).
export function useVault() {
  const [vaultPath, setVaultPath] = useState<string | null>(getStoredVaultPath());
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!vaultPath) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      setEntries(await vaultList(vaultPath));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [vaultPath]);

  useEffect(() => {
    reload();
  }, [reload]);

  const chooseVault = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string" && picked) {
      setStoredVaultPath(picked);
      setVaultPath(picked);
    }
  }, []);

  const clearVault = useCallback(() => {
    setStoredVaultPath(null);
    setVaultPath(null);
    setEntries([]);
  }, []);

  const createNote = useCallback(
    async (title: string): Promise<string | null> => {
      if (!vaultPath) return null;
      const path = await vaultCreateNote(vaultPath, title);
      await reload();
      return path;
    },
    [vaultPath, reload]
  );

  const rename = useCallback(
    async (from: string, newName: string) => {
      await vaultRename(from, newName);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (path: string) => {
      await vaultDelete(path);
      await reload();
    },
    [reload]
  );

  // Derived: recent notes (files only, sorted by modified desc, top 6).
  const recent = entries
    .filter((e) => !e.is_folder)
    .sort((a, b) => b.modified - a.modified)
    .slice(0, 6);

  // Derived: note count (files only).
  const noteCount = entries.filter((e) => !e.is_folder).length;

  return {
    vaultPath,
    entries,
    recent,
    noteCount,
    loading,
    reload,
    chooseVault,
    clearVault,
    createNote,
    rename,
    remove,
  };
}
