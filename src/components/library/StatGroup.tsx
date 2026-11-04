import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

/// A larger feature card with a title, body text, and optional accent.
/// Useful for landing-page-style sections inside a document.
interface FeatureCardProps extends ComponentProps {
  title?: string;
  emoji?: string;
  children?: ReactNode;
}

export const FeatureCard: FC<FeatureCardProps> = ({ title = "Title", emoji = "✨", children }) => (
  <div
    style={{
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: 16,
      margin: "12px 0",
      background: "var(--bg)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>{title}</span>
    </div>
    <div style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, font: "var(--font-body)" }}>
      {children}
    </div>
  </div>
);

/// A row of StatCards grouped together for dashboards.
/// `stats` is a JSON string of `[{ label, value }]`.
interface StatGroupProps extends ComponentProps {
  stats?: string; // JSON: [{label, value}]
}

interface Stat {
  label: string;
  value: string;
}

function parseStats(stats: string | undefined): Stat[] {
  if (!stats) return [{ label: "Label", value: "0" }];
  try {
    const parsed = JSON.parse(stats);
    if (Array.isArray(parsed) && parsed.every((s) => "label" in s && "value" in s)) {
      return parsed as Stat[];
    }
  } catch {
    /* fall through */
  }
  return [{ label: "Label", value: "0" }];
}

export const StatGroup: FC<StatGroupProps> = ({ stats }) => {
  const items = parseStats(stats);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "12px 0" }}>
      {items.map((s, i) => (
        <div
          key={i}
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            minWidth: 120,
            flex: "1 1 120px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: 6,
            }}
          >
            {s.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
};
