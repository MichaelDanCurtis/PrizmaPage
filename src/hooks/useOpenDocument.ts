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
