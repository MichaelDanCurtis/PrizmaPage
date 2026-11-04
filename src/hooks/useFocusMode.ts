import { useCallback, useState } from "react";
const KEY = "prizma.editor.focus";
export function useFocusMode() {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(KEY) === "1");
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  return { enabled, toggle };
}
