import { useCallback, useState } from "react";

const KEY = "prizma.editor.spellcheck";

/// Toggle + persist the editor's native spellcheck. The boolean is read
/// on mount and reflected onto the ProseMirror element's `spellcheck` attr
/// by WysiwygSurface.
export function useSpellcheck() {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(KEY) !== "0");
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  return { enabled, toggle };
}
