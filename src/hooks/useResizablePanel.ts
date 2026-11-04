import { useCallback, useEffect, useRef, useState } from "react";

/// Drag-to-resize + collapse for a docked panel. The drag handle sits on the
/// panel's left edge (right-docked panel). Persists the width.
export function useResizablePanel(storageKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    const n = saved ? Number(saved) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaultWidth;
  });
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useRef(false);

  const onPointerDown = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      // Right-docked panel: width = window.innerWidth - e.clientX (minus margin)
      const w = window.innerWidth - e.clientX - 16;
      setWidth(Math.min(max, Math.max(min, w)));
    };
    const up = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(storageKey, String(width));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [storageKey, min, max, width]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return { width, collapsed, onPointerDown, toggle };
}
