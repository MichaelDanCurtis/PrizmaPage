import { useCallback, useEffect, useRef, useState } from "react";

const FADE_OUT_DELAY_MS = 400;

export interface HoverControlsState {
  visible: boolean;
  onEnter: () => void;
  onLeave: () => void;
}

export function useHoverControls(): HoverControlsState {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    cancelHide();
    setVisible(true);
  }, [cancelHide]);

  const onLeave = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setVisible(false), FADE_OUT_DELAY_MS);
  }, [cancelHide]);

  useEffect(() => cancelHide, [cancelHide]);

  return { visible, onEnter, onLeave };
}
