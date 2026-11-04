import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface DrawioProps extends ComponentProps {
  /// The draw.io XML (mxfile or mxGraphModel) as children text.
  children?: string;
}

/// A render-only draw.io diagram. The full mxGraph renderer is large; v1 shows
/// the diagram's text labels in a styled placeholder and offers "Open in
/// draw.io" which opens the XML in app.diagrams.net (render-only, no execution
/// in our sandbox). No new execution surface.
export const Drawio: FC<DrawioProps> = ({ children }) => {
  const xml = typeof children === "string" ? children.trim() : "";
  // Extract label texts from the XML for a readable placeholder.
  const labels: string[] = [];
  const labelRe = /value="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(xml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (text) labels.push(text);
  }

  const openInDrawio = () => {
    // Encode the XML into the URL fragment the way diagrams.net expects.
    const encoded = encodeURIComponent(xml);
    const url = `https://app.diagrams.net/?#R${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        margin: "12px 0",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>📊</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>draw.io diagram</span>
        <button
          onClick={openInDrawio}
          style={{
            marginLeft: "auto",
            background: "var(--accent)",
            color: "white",
            border: "none",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Open in draw.io ↗
        </button>
      </div>
      {labels.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {labels.slice(0, 12).map((l, i) => (
            <span
              key={i}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                padding: "3px 8px",
                borderRadius: "var(--radius-sm)",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              {l}
            </span>
          ))}
          {labels.length > 12 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>+{labels.length - 12} more</span>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>No labels found in XML.</div>
      )}
    </div>
  );
};
