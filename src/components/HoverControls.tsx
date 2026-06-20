interface Props {
  visible: boolean;
  zoomPct: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onShare: () => void;
  onEdit: () => void;
}

export function HoverControls({ visible, zoomPct, onZoomIn, onZoomOut, onShare, onEdit }: Props) {
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
  return (
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        gap: 0,
        alignItems: "center",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
        padding: "4px 8px",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        font: "var(--font-small)",
      }}
    >
      <button style={btn} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <span style={{ padding: "0 6px", color: "var(--text-muted)" }}>{zoomPct}%</span>
      <button style={btn} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <div style={divider} />
      <button style={btn} onClick={onShare} aria-label="Share">↗</button>
      <div style={divider} />
      <button
        onClick={onEdit}
        style={{
          background: "var(--accent)",
          color: "white",
          border: "none",
          padding: "4px 12px",
          borderRadius: "var(--radius-sm)",
          font: "500 var(--font-small)",
          cursor: "pointer",
        }}
      >
        Edit
      </button>
    </div>
  );
}
