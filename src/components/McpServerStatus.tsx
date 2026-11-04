import { useState } from "react";

interface Props {
  docPath: string;
}

/// A compact panel in the editor showing the document is available as an MCP
/// server (editor-mode only). External agents connect by spawning the binary
/// with `mcp-server --doc <path>`.
export function McpServerStatus({ docPath }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cmd = `prizmapage mcp-server --doc "${docPath}"`;

  const copy = () => {
    navigator.clipboard?.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-soft)",
        padding: "6px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bg-muted)",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        color: "var(--text-muted)",
      }}
    >
      <span style={{ color: "#059669" }}>●</span>
      <span>MCP server ready (editor mode)</span>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent)",
          cursor: "pointer",
          fontSize: 11,
          textDecoration: "underline",
          padding: 0,
        }}
      >
        {expanded ? "hide" : "connect"}
      </button>
      {expanded && (
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flex: 1, maxWidth: "60%" }}>
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              background: "var(--bg)",
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {cmd}
          </code>
          <button
            onClick={copy}
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              padding: "3px 8px",
              borderRadius: "var(--radius-sm)",
              fontSize: 10,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {copied ? "✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
