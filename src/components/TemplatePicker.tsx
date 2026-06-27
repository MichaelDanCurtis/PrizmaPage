import { TEMPLATES } from "../lib/templates";

interface Props {
  onPick: (templateId: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ onPick, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 460, maxWidth: "92vw", maxHeight: "82vh", overflow: "auto", padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Choose a template</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {TEMPLATES.map((t) => {
            const summary = t.body.split("\n").slice(1).join(" ").trim().slice(0, 60);
            return (
              <button
                key={t.id}
                onClick={() => onPick(t.id)}
                style={{
                  textAlign: "left", background: "var(--bg-muted)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "10px 12px", cursor: "pointer", fontFamily: "var(--font-sans)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {summary || "Start from scratch"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
