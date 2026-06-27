import { SHORTCUTS } from "../lib/shortcuts";

const GROUPS = [...new Set(SHORTCUTS.map((s) => s.group))];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 460, maxWidth: "92vw", maxHeight: "82vh", overflow: "auto", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14 }}>Keyboard shortcuts</div>
        {GROUPS.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", marginBottom: 6 }}>{g}</div>
            {SHORTCUTS.filter((s) => s.group === g).map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text)", padding: "3px 0" }}>
                <span>{s.description}</span>
                <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", background: "var(--bg-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "1px 6px" }}>{s.keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
