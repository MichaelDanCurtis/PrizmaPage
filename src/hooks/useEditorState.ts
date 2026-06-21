import { useCallback, useState } from "react";

export type EditorMode = "wysiwyg" | "raw";

export interface EditorState {
  mode: EditorMode;
  dirty: boolean;
  peekTarget: string | null; // a component node id; null = peek closed
  saving: boolean;
  markDirty: () => void;
  markSaved: () => void;
  toggleMode: () => void;
  openPeek: (nodeId: string) => void;
  closePeek: () => void;
  setSaving: (s: boolean) => void;
}

export function useEditorState(): EditorState {
  const [mode, setMode] = useState<EditorMode>("wysiwyg");
  const [dirty, setDirty] = useState(false);
  const [peekTarget, setPeekTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);
  const markSaved = useCallback(() => setDirty(false), []);
  const toggleMode = useCallback(() => setMode((m) => (m === "wysiwyg" ? "raw" : "wysiwyg")), []);
  const openPeek = useCallback((nodeId: string) => setPeekTarget(nodeId), []);
  const closePeek = useCallback(() => setPeekTarget(null), []);

  return {
    mode,
    dirty,
    peekTarget,
    saving,
    markDirty,
    markSaved,
    toggleMode,
    openPeek,
    closePeek,
    setSaving,
  };
}
