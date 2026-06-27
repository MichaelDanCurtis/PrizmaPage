import { useMemo } from "react";

interface Props {
  html: string;
  onPrint: () => void;
  onClose: () => void;
}

/// A print preview modal: renders the export-styled HTML in a sandboxed iframe
/// with a Print button that triggers window.print(). Lets the user see what
/// will export before committing.
export function PrintPreview({ html, onPrint, onClose }: Props) {
  const srcDoc = useMemo(() => html, [html]);
  return (
    <div onClick={onClose} className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 760, maxWidth: "94vw", height: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Print preview</span>
          <button onClick={onPrint} style={{ marginLeft: 16, fontSize: 12, padding: "5px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius)", cursor: "pointer" }}>🖨 Print / Save PDF</button>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <iframe title="print-preview" srcDoc={srcDoc} style={{ flex: 1, border: "none", background: "white" }} />
      </div>
    </div>
  );
}
