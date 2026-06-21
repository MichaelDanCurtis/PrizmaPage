import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface StatCardProps extends ComponentProps {
  label: string;
  value: string;
}

export const StatCard: FC<StatCardProps> = ({ label, value }) => (
  <div
    style={{
      background: "var(--accent-soft)",
      border: "1px solid var(--accent-border)",
      borderRadius: "var(--radius-lg)",
      padding: "16px",
      display: "inline-block",
      marginRight: "12px",
      minWidth: "120px",
      margin: "8px 0",
    }}
  >
    <div
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "1.2px",
        textTransform: "uppercase",
        color: "var(--accent)",
        marginBottom: "6px",
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)" }}>{value}</div>
  </div>
);
