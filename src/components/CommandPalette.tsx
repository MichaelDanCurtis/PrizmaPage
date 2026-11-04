import { useEffect, useState } from "react";
import { useAiConfig } from "../hooks/useAiConfig";
import { generateDocumentClean, editSelectionClean } from "../lib/aiGenerate";

interface Props {
  /// Current selection text, or null (whole-doc mode).
  selection: string | null;
  /// Full document text (for whole-doc actions).
  documentText: string;
  onClose: () => void;
  /// Apply the AI's result. For selection mode replaces the selection; for
  /// doc mode replaces or appends (the palette offers the choice inline).
  onApply: (result: string, mode: "replace" | "insert" | "replace-selection" | "append") => void;
  onOpenSettings: () => void;
}

const PRESETS: { label: string; icon: string; instruction: string; scope: "any" | "doc" | "selection" }[] = [
  { label: "Summarize", icon: "📝", instruction: "Summarize this document in 3 bullet points.", scope: "doc" },
  { label: "Find action items", icon: "✓", instruction: "List every action item, task, or TODO mentioned.", scope: "doc" },
  { label: "Rewrite friendlier", icon: "😊", instruction: "Rewrite this in a warmer, more conversational tone.", scope: "any" },
  { label: "Make shorter", icon: "✂", instruction: "Make this more concise without losing meaning.", scope: "any" },
  { label: "Fix grammar", icon: "📚", instruction: "Fix grammar, spelling, and punctuation. Return only the corrected text.", scope: "any" },
  { label: "Extract key dates", icon: "📅", instruction: "List every date or deadline mentioned.", scope: "doc" },
  { label: "Outline", icon: "🗂", instruction: "Create a hierarchical outline of this document's structure.", scope: "doc" },
];

/// Cmd+K palette: quick AI actions on the whole doc or selection, plus
/// free-text instructions. Reuses the existing generate/edit AI bridge.
export function CommandPalette({ selection, documentText, onClose, onApply, onOpenSettings }: Props) {
  const ai = useAiConfig();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mode = selection ? "selection" : "doc";
  const filtered = PRESETS.filter(
    (p) => (p.scope === "any" || p.scope === mode) && p.label.toLowerCase().includes(query.toLowerCase())
  );

  const runInstruction = async (instruction: string) => {
    if (!ai.provider) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const out =
        mode === "selection"
          ? await editSelectionClean(ai.provider, ai.model, instruction, selection!)
          : await generateDocumentClean(ai.provider, ai.model, instruction + "\n\nDocument:\n" + documentText);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 80,
        zIndex: 260,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 520,
          maxWidth: "92vw",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && query.trim()) runInstruction(query.trim());
            }}
            placeholder={mode === "selection" ? "Ask AI to edit the selection…" : "Ask AI about this document…"}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {ai.loading ? (
            <div style={{ fontSize: 12, color: "var(--text-faint)", padding: 8 }}>Loading…</div>
          ) : !ai.provider ? (
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8 }}>No AI provider configured.</div>
              <button onClick={onOpenSettings} style={{ fontSize: 11, background: "var(--accent)", color: "white", border: "none", padding: "4px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                Open Settings →
              </button>
            </div>
          ) : loading ? (
            <div style={{ fontSize: 12, color: "var(--text-faint)", padding: 8 }}>Working…</div>
          ) : error ? (
            <div style={{ fontSize: 12, color: "#dc2626", padding: 8 }}>{error}</div>
          ) : result ? (
            <div style={{ padding: 8 }}>
              <pre style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", background: "var(--bg-muted)", padding: 10, borderRadius: "var(--radius)", margin: 0, maxHeight: 240, overflow: "auto" }}>
                {result}
              </pre>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {mode === "selection" ? (
                  <>
                    <button onClick={() => { onApply(result, "replace-selection"); onClose(); }} style={applyBtn}>Replace selection</button>
                    <button onClick={() => { onApply(result, "insert"); onClose(); }} style={applyBtn}>Insert after</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { onApply(result, "replace"); onClose(); }} style={applyBtn}>Replace doc</button>
                    <button onClick={() => { onApply(result, "append"); onClose(); }} style={applyBtn}>Append</button>
                  </>
                )}
                <button onClick={() => setResult(null)} style={{ ...applyBtn, background: "var(--bg-muted)", color: "var(--text-muted)" }}>Back</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", padding: "4px 8px" }}>
                {mode === "selection" ? "Selection actions" : "Document actions"}
              </div>
              {filtered.map((p) => (
                <div
                  key={p.label}
                  onClick={() => runInstruction(p.instruction)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 13 }}>{p.icon}</span>
                  <span style={{ fontSize: 12, color: "var(--text)" }}>{p.label}</span>
                </div>
              ))}
              {query.trim() && !filtered.some((p) => p.label.toLowerCase() === query.toLowerCase()) && (
                <div
                  onClick={() => runInstruction(query.trim())}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer", borderRadius: "var(--radius-sm)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 13 }}>✨</span>
                  <span style={{ fontSize: 12, color: "var(--accent)" }}>Ask: "{query.trim()}"</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const applyBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  padding: "5px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: 11,
  cursor: "pointer",
};
