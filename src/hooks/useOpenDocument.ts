import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openDocument, grantDeclaredCapabilities, type OpenedDocument, type Manifest } from "../lib/package";
import { addRecent, newDocument } from "../lib/recents";
import type { Capability } from "../lib/capability";

export type OpenState = "empty" | "loading" | "document" | "editing";

export interface PendingConsent {
  doc: OpenedDocument;
  path: string;
}

export interface OpenDocumentState {
  state: OpenState;
  document: OpenedDocument | null;
  path: string | null;
  error: string | null;
  /// Non-null when a doc has been read but is awaiting capability consent.
  pendingConsent: PendingConsent | null;
  openViaPicker: () => Promise<void>;
  openViaDrop: (path: string) => Promise<void>;
  openRecent: (path: string) => Promise<void>;
  /// Grant the user-approved capability subset and open the pending doc.
  confirmConsent: (capabilities: Capability[]) => Promise<void>;
  /// Cancel the consent prompt; nothing is granted, return to empty.
  cancelConsent: () => void;
  createNew: () => Promise<void>;
  importMarkdown: () => Promise<void>;
  openEditor: () => void;
  closeEditor: () => void;
  close: () => void;
}

/// Read a .mdxz and register it in recents. Does NOT grant capabilities —
/// the caller decides what to grant (consent prompt or empty set).
async function readDoc(path: string): Promise<OpenedDocument> {
  const doc = await openDocument(path);
  await addRecent(path);
  return doc;
}

export function useOpenDocument(): OpenDocumentState {
  const [state, setState] = useState<OpenState>("empty");
  const [document, setDocument] = useState<OpenedDocument | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConsent, setPendingConsent] = useState<PendingConsent | null>(null);

  /// After a doc is read: if it declares capabilities, hold it for consent;
  /// otherwise grant nothing (empty capabilities) and open the viewer.
  const finalizeOpen = useCallback((doc: OpenedDocument, p: string) => {
    if (doc.manifest.capabilities && doc.manifest.capabilities.length > 0) {
      setPendingConsent({ doc, path: p });
      setState("empty"); // stay "empty" until consent resolves; modal overlays
    } else {
      setDocument(doc);
      setPath(p);
      setState("document");
    }
  }, []);

  const doOpen = useCallback(async (p: string) => {
    setState("loading");
    setError(null);
    try {
      const doc = await readDoc(p);
      finalizeOpen(doc, p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("empty");
    }
  }, [finalizeOpen]);

  const openViaPicker = useCallback(async () => {
    const picked = await openDialog({ filters: [{ name: "PrizmaPage document", extensions: ["mdxz"] }] });
    if (typeof picked === "string" && picked) {
      await doOpen(picked);
    }
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

  const confirmConsent = useCallback(
    async (capabilities: Capability[]) => {
      const pending = pendingConsent;
      if (!pending) return;
      // Grant only the user-approved subset.
      const filteredManifest: Manifest = { ...pending.doc.manifest, capabilities };
      try {
        await grantDeclaredCapabilities(filteredManifest);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setDocument(pending.doc);
      setPath(pending.path);
      setPendingConsent(null);
      setState("document");
    },
    [pendingConsent]
  );

  const cancelConsent = useCallback(() => {
    setPendingConsent(null);
    setState("empty");
  }, []);

  const createNew = useCallback(async () => {
    const picked = await saveDialog({
      defaultPath: "untitled.mdxz",
      filters: [{ name: "PrizmaPage document", extensions: ["mdxz"] }],
    });
    if (typeof picked !== "string" || !picked) return;
    setState("loading");
    setError(null);
    try {
      await newDocument(picked);
      // A brand-new doc has no declared capabilities → open straight to editor.
      const doc = await readDoc(picked);
      setDocument(doc);
      setPath(picked);
      setState("editing");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("empty");
    }
  }, []);

  /// Import a `.md`/`.markdown`/`.txt` file as a new (unsaved) document. Parses
  /// the markdown via the serializer and opens it in the editor with path=null.
  const importMarkdown = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const input = globalThis.document.createElement("input");
      input.type = "file";
      input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(); return; }
        try {
          const text = await file.text();
          const doc: OpenedDocument = {
            manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
            content_md: text,
            build_main_js: null,
          };
          setDocument(doc);
          setPath(null);
          setPendingConsent(null);
          setState("editing");
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setState("empty");
        }
        resolve();
      };
      input.click();
    });
  }, []);

  const close = useCallback(() => {
    setDocument(null);
    setPath(null);
    setError(null);
    setState("empty");
  }, []);

  const openEditor = useCallback(() => {
    setState("editing");
  }, []);

  const closeEditor = useCallback(() => {
    setState("document");
  }, []);

  return {
    state,
    document,
    path,
    error,
    pendingConsent,
    openViaPicker,
    openViaDrop,
    openRecent,
    confirmConsent,
    cancelConsent,
    createNew,
    importMarkdown,
    openEditor,
    closeEditor,
    close,
  };
}
