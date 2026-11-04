import { useState } from "react";

interface Props {
  componentName: string;
  initialJsx: string;
  onApply: (jsx: string) => void;
  onCancel: () => void;
}

/// Validate that JSX parses as a single self-closing or open/close component tag.
function isValidJsx(jsx: string): boolean {
  const trimmed = jsx.trim();
  if (!trimmed.startsWith("<")) return false;
  if (trimmed.endsWith("/>")) {
    return /^<\w+(\s+\w+="[^"]*")*\s*\/>$/.test(trimmed);
  }
  const openMatch = trimmed.match(/^<(\w+)/);
  if (!openMatch) return false;
  const closeTag = `</${openMatch[1]}>`;
  return trimmed.endsWith(closeTag);
}

export function CodePeek({ componentName, initialJsx, onApply, onCancel }: Props) {
  const [value, setValue] = useState(initialJsx);
  const valid = isValidJsx(value);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "38%",
        background: "var(--editor-bg)",
        color: "var(--editor-text)",
        padding: 16,
        fontFamily: "var(--font-mono)",
        display: "flex",
        flexDirection: "column",
        borderLeft: "2px solid var(--accent)",
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ color: "var(--editor-accent)", fontSize: 11 }}>editing: {componentName}</div>
        <div onClick={onCancel} style={{ color: "var(--editor-text-dim)", cursor: "pointer", fontSize: 14 }}>
          ✕
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          background: "transparent",
          color: "var(--editor-text)",
          border: "1px solid var(--editor-border)",
          borderRadius: "var(--radius-sm)",
          padding: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          resize: "none",
          outline: "none",
        }}
      />
      {!valid && (
        <div style={{ color: "#f87171", fontSize: 10, marginTop: 6 }}>Invalid JSX: unclosed tag or unknown syntax.</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          onClick={() => onApply(value)}
          disabled={!valid}
          style={{
            background: valid ? "var(--accent)" : "var(--editor-border)",
            color: "white",
            border: "none",
            padding: "5px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            cursor: valid ? "pointer" : "not-allowed",
            fontFamily: "var(--font-sans)",
          }}
        >
          Apply
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "var(--editor-border)",
            color: "var(--editor-text)",
            border: "none",
            padding: "5px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
