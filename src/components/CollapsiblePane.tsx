import type { ReactNode } from "react";

interface Props {
  title: string;
  side: "left" | "right";
  collapsed: boolean;
  width: number;
  onToggle: () => void;
  children: ReactNode;
  background?: string;
  className?: string;
}

/// A docked editor pane that collapses to its own title rotated 90° with a
/// small margin around it. Click the rotated title to reopen at its width.
/// `side` determines which way the title rotates (left panes read top-down on
/// the left edge; the right pane reads bottom-up on the right edge) and which
/// edge the collapsed strip hugs.
export function CollapsiblePane({
  title,
  side,
  collapsed,
  width,
  onToggle,
  children,
  background,
  className,
}: Props) {
  if (collapsed) {
    return (
      <div
        onClick={onToggle}
        className={className}
        title={`Show ${title}`}
        style={{
          width: 26,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 4px",
          background: background ?? "var(--bg-muted)",
          borderRight: side === "left" ? "1px solid var(--border)" : "none",
          borderLeft: side === "right" ? "1px solid var(--border)" : "none",
          transition: "background 100ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = background ?? "var(--bg-muted)")}
      >
        <span
          style={{
            transform: side === "left" ? "rotate(-90deg)" : "rotate(90deg)",
            whiteSpace: "nowrap",
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            color: "var(--text-muted)",
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          {title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        background: background ?? "var(--bg)",
        borderRight: side === "left" ? "1px solid var(--border)" : "none",
        borderLeft: side === "right" ? "1px solid var(--border)" : "none",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 10px",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        <span
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "var(--text-faint)",
            fontWeight: 600,
          }}
        >
          {title}
        </span>
        <button
          onClick={onToggle}
          title={`Hide ${title}`}
          style={{
            marginLeft: "auto",
            background: "var(--bg-muted)",
            border: "none",
            color: "var(--text-faint)",
            width: 16,
            height: 16,
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {side === "left" ? "‹" : "›"}
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>{children}</div>
    </div>
  );
}
