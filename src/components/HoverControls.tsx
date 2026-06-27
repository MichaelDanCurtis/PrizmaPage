import { useState } from "react";
import { ShareMenu } from "./ShareMenu";

interface Props {
  visible: boolean;
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShare: () => void;     // reveal in file manager
  onSaveCopy: () => void;  // save-a-copy
  onCopyPath: () => void;  // copy path
  onFileInVault: () => void; // SP1: file into vault
  onPrint: () => void;     // print / export to PDF
  onEdit: () => void;
}

export function HoverControls({ visible, zoomPct, onZoomIn, onZoomOut, onShare, onSaveCopy, onCopyPath, onFileInVault, onPrint, onEdit }: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  if (!visible) return null;
  const btn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    padding: "2px 6px",
    font: "var(--font-small)",
    cursor: "pointer",
  };
  const divider: React.CSSProperties = {
    width: 1,
    background: "var(--border)",
    margin: "2px 4px",
    alignSelf: "stretch",
  };
  const runShare = (fn: () => void) => {
    setShareOpen(false);
    fn();
  };
  return (
    <div style={{ position: "relative", marginLeft: "auto", display: "flex", gap: 0, alignItems: "center", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)", padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", font: "var(--font-small)" }}>
      <button style={btn} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <span style={{ padding: "0 6px", color: "var(--text-muted)" }}>{zoomPct}%</span>
      <button style={btn} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <div style={divider} />
      <button style={btn} onClick={() => setShareOpen((v) => !v)} aria-label="Share">↗</button>
      {shareOpen && (
        <ShareMenu
          onShare={() => runShare(onShare)}
          onSaveCopy={() => runShare(onSaveCopy)}
          onCopyPath={() => runShare(onCopyPath)}
          onFileInVault={() => runShare(onFileInVault)}
        />
      )}
      <button style={btn} onClick={onPrint} aria-label="Print / Export PDF" title="Print / Export PDF">🖨</button>
      <div style={divider} />
      <button onClick={onEdit} style={{ background: "var(--accent)", color: "white", border: "none", padding: "4px 12px", borderRadius: "var(--radius-sm)", font: "500 var(--font-small)", cursor: "pointer" }}>
        Edit
      </button>
    </div>
  );
}
