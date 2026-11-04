import { TOKEN_CATALOG } from "../theme/tokenCatalog";

interface Props {
  overrides: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

const GROUPS = ["Color", "Type", "Spacing & shape"] as const;

export function TokenEditor({ overrides, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {GROUPS.map((group) => (
        <div key={group}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", marginBottom: 6 }}>
            {group}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TOKEN_CATALOG.filter((t) => t.group === group).map((t) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 130, color: "var(--text-muted)" }}>{t.label}</span>
                {t.type === "color" ? (
                  <input
                    type="color"
                    value={overrides[t.name] ?? t.default}
                    onChange={(e) => onChange(t.name, e.target.value)}
                    style={{ width: 28, height: 20, border: "1px solid var(--border)", background: "none", cursor: "pointer", padding: 0 }}
                  />
                ) : (
                  <input
                    type="text"
                    value={overrides[t.name] ?? t.default}
                    onChange={(e) => onChange(t.name, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "3px 6px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: 11,
                      fontFamily: t.type === "font" ? "var(--font-mono)" : "var(--font-sans)",
                      color: "var(--text)",
                      background: "var(--bg)",
                    }}
                  />
                )}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
