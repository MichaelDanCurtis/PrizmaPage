import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface BadgeProps extends ComponentProps {
  label?: string;
  color?: "accent" | "green" | "amber" | "red" | "gray";
}

const COLORS: Record<NonNullable<BadgeProps["color"]>, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  green: { bg: "#d1fae5", fg: "#065f46" },
  amber: { bg: "#fef3c7", fg: "#92400e" },
  red: { bg: "#fee2e2", fg: "#991b1b" },
  gray: { bg: "var(--bg-muted)", fg: "var(--text-muted)" },
};

/// Inline pill label. Useful inside paragraphs or as status markers.
export const Badge: FC<BadgeProps> = ({ label = "New", color = "accent" }) => {
  const c = COLORS[color] ?? COLORS.accent;
  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.fg,
        padding: "1px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-sans)",
        lineHeight: "1.4",
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
};
