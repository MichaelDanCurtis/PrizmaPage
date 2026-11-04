import { useState } from "react";
import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface CodeBlockProps extends ComponentProps {
  language?: string;
  children?: ReactNode;
}

export const CodeBlock: FC<CodeBlockProps> = ({ language = "text", children }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = typeof children === "string" ? children : "";
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div
      style={{
        background: "var(--editor-bg)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        margin: "12px 0",
        position: "relative",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ color: "var(--editor-text-dim)", fontSize: "10px" }}>{language}</span>
        <button
          onClick={copy}
          style={{
            background: "transparent",
            border: "1px solid var(--editor-border)",
            color: "var(--editor-text)",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "10px",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ margin: 0, color: "var(--editor-text)", fontSize: "12px", whiteSpace: "pre-wrap" }}>
        {children}
      </pre>
    </div>
  );
};
