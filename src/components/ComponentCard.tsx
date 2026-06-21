import type { FC, ReactNode } from "react";

interface Props {
  componentName: string;
  selected: boolean;
  onDoubleClick: () => void;
  children: ReactNode;
}

/// Wraps a component's rendered output in the WYSIWYG surface with a hover
/// tag and double-click handler that opens the CodePeek.
export const ComponentCard: FC<Props> = ({ componentName, selected, onDoubleClick, children }) => (
  <div
    onDoubleClick={onDoubleClick}
    style={{
      outline: selected ? "2px solid var(--accent)" : "1px dashed var(--accent-border)",
      borderRadius: "var(--radius-sm)",
      margin: "8px 0",
      position: "relative",
      cursor: "pointer",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 4,
        right: 8,
        fontSize: 9,
        color: "var(--accent)",
        fontWeight: 500,
        background: "var(--bg)",
        padding: "1px 6px",
        borderRadius: 3,
        border: "1px solid var(--accent-border)",
        zIndex: 1,
        pointerEvents: "none",
      }}
    >
      {componentName}
    </div>
    {children}
  </div>
);
