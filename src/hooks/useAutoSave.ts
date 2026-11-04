import { useCallback, useEffect, useRef } from "react";

interface Args { dirty: boolean; enabled: boolean; save: () => void; delayMs?: number; }

/// Schedules a debounced save `delayMs` after each edit notification, but only
/// when `enabled` and `dirty`. Call `notifyEdit()` on every editor change.
export function useAutoSave({ dirty, enabled, save, delayMs = 3000 }: Args) {
  const timer = useRef<number | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const notifyEdit = useCallback(() => {
    if (!enabled || !dirty) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveRef.current(); }, delayMs);
  }, [enabled, dirty, delayMs]);

  // Reset the debounce when dirty flips to false (just saved).
  useEffect(() => {
    if (!dirty && timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, [dirty]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  return { notifyEdit };
}
