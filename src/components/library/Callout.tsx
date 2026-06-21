import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface CalloutProps extends ComponentProps {
  type?: "info" | "warning" | "success";
  children?: ReactNode;
}

export const Callout: FC<CalloutProps> = ({ type = "info", children }) => {
  const bg = type === "warning" ? "#fef3c7" : type === "success" ? "#d1fae5" : "var(--accent-soft)";
  const fg = type === "warning" ? "#92400e" : type === "success" ? "#065f46" : "var(--accent)";
  const border = type === "warning" ? "#fde68a" : type === "success" ? "#a7f3d0" : "var(--accent-border)";
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        color: fg,
        font: "var(--font-body)",
        margin: "12px 0",
      }}
    >
      {children}
    </div>
  );
};
