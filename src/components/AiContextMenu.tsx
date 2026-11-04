import { useState } from "react";
import { useAiConfig } from "../hooks/useAiConfig";
import { editSelectionClean } from "../lib/aiGenerate";

interface Props {
  /// The selected text to act on.
  selection: string;
  /// Where to render (screen coords from the contextmenu event).
  top: number;
  left: number;
  /// Apply the result: replaces the selection by default.
  onApply: (result: string) => void;
  onClose: () => void;
}

const ACTIONS: { label: string; instruction: string }[] = [
  { label: "Improve writing", instruction: "Improve the clarity and flow of this text." },
  { label: "Make shorter", instruction: "Make this more concise without losing meaning." },
  { label: "Make longer", instruction: "Expand this with more detail." },
  { label: "Fix grammar", instruction: "Fix grammar, spelling, and punctuation." },
  { label: "Friendlier tone", instruction: "Rewrite in a warmer, more conversational tone." },
  { label: "More formal", instruction: "Rewrite in a more formal, professional tone." },
  { label: "Translate to Spanish", instruction: "Translate this to Spanish." },
];

/// A floating AI action menu shown on right-click over a selection, or on
/// per-paragraph hover. Runs the chosen instruction against the text and
/// applies the result (replacing the source).
export function AiContextMenu({ selection, top, left, onApply, onClose }: Props) {
  const ai = useAiConfig();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const run = async (instruction: string) => {
    if (!ai.provider) {
      setError("No provider configured.");
      return;
    }
    setLoading(instruction);
    setError("");
    try {
      const out = await editSelectionClean(ai.provider, ai.model, instruction, selection);
      onApply(out);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  // Clamp position to viewport.
  const clampedTop = Math.min(top, window.innerHeight - 280);
  const clampedLeft = Math.min(left, window.innerWidth - 220);

  return (
    <>
      {/* click-away catcher */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 270 }} />
      <div
        style={{
          position: "fixed",
          top: clampedTop,
          left: clampedLeft,
          zIndex: 271,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          padding: 4,
          minWidth: 200,
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--accent)", fontWeight: 600, padding: "4px 8px" }}>
          ✨ AI actions
        </div>
        {ACTIONS.map((a) => (
          <div
            key={a.label}
            onClick={() => run(a.instruction)}
            style={{
              padding: "6px 10px",
              cursor: loading ? "wait" : "pointer",
              fontSize: 12,
              color: "var(--text)",
              borderRadius: "var(--radius-sm)",
              opacity: loading && loading !== a.instruction ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--accent-soft)"; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {loading === a.instruction ? "…" : a.label}
          </div>
        ))}
        {error && <div style={{ fontSize: 10, color: "#dc2626", padding: "4px 8px" }}>{error}</div>}
      </div>
    </>
  );
}
