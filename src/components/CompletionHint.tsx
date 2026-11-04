import { useEffect } from "react";

interface Props {
  suggestion: string;
  coords: { top: number; left: number };
  onAccept: () => void;
  onDismiss: () => void;
}

/// The floating greyed hint showing the AI's inline completion, positioned at
/// the cursor. Tab accepts; any other visible key dismisses (handled here via
/// a window keydown that stops propagation for Tab).
export function CompletionHint({ suggestion, coords, onAccept, onDismiss }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        onAccept();
      } else if (e.key.length === 1 || e.key === "Escape" || e.key === "Enter") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onAccept, onDismiss]);

  // Truncate long suggestions for display; full text is inserted on accept.
  const display = suggestion.length > 80 ? suggestion.slice(0, 80) + "…" : suggestion;

  return (
    <div
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "3px 8px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        color: "var(--text-faint)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        pointerEvents: "none",
        zIndex: 60,
        maxWidth: 420,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      <span style={{ color: "var(--accent)", fontSize: 10, marginRight: 6 }}>Tab↹</span>
      {display}
    </div>
  );
}
