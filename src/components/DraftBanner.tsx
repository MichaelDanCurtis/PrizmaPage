interface Props { onRestore: () => void; onDiscard: () => void; }

export function DraftBanner({ onRestore, onDiscard }: Props) {
  return (
    <div className="no-print" style={{ padding: "6px 14px", background: "var(--accent-soft)", borderBottom: "1px solid var(--accent-border)", display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "var(--text)", fontFamily: "var(--font-sans)" }}>
      <span>⚠ Unsaved draft found for this document.</span>
      <button onClick={onRestore} style={{ fontSize: 11, padding: "3px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Restore</button>
      <button onClick={onDiscard} style={{ fontSize: 11, padding: "3px 10px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Discard</button>
    </div>
  );
}
