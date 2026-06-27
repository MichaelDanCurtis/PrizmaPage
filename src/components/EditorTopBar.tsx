interface Props {
  filename: string;
  dirty: boolean;
  saving: boolean;
  mode: "wysiwyg" | "raw";
  focusEnabled: boolean;
  onSave: () => void;
  onSign: () => void;
  onExport: () => void;
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onShowShortcuts: () => void;
  onToggleFocus: () => void;
  onClose: () => void;
}

export function EditorTopBar({ filename, dirty, saving, mode, focusEnabled, onSave, onSign, onExport, onToggleMode, onOpenSettings, onShowShortcuts, onToggleFocus, onClose }: Props) {
  return (
    <div
      style={{
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>📄 {filename}</div>
      {dirty && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>· edited</div>}
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        {focusEnabled && (
          <button
            onClick={onToggleFocus}
            title="Exit focus mode (Cmd+.)"
            className="no-print"
            style={{
              background: "var(--accent)",
              color: "white",
              border: "none",
              padding: "4px 12px",
              borderRadius: "var(--radius)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            ← Exit focus
          </button>
        )}
        {!focusEnabled && (
          <>
        <button
          onClick={onToggleFocus}
          title="Focus mode (Cmd+.)"
          className="no-print"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 8px",
          }}
        >
          🎯
        </button>
        <button
          onClick={onOpenSettings}
          title="Settings"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 8px",
          }}
        >
          ⚙
        </button>
        <button
          onClick={onShowShortcuts}
          title="Keyboard shortcuts (Cmd+/)"
          className="no-print"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 8px",
          }}
        >
          ?
        </button>
        <button
          onClick={onExport}
          title="Export to PDF / Print"
          className="no-print"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "4px 8px",
          }}
        >
          🖨
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            background: "var(--accent)",
            color: "white",
            border: "none",
            padding: "4px 14px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            fontWeight: 500,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onSign}
          title="Sign this document with your key"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            padding: "4px 10px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          🔑
        </button>
        <button
          onClick={onToggleMode}
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            padding: "4px 12px",
            borderRadius: "var(--radius)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {mode === "wysiwyg" ? "Raw" : "Write"}
        </button>
          </>
        )}
        <div onClick={onClose} style={{ color: "var(--text-faint)", cursor: "pointer", padding: "4px 8px", fontSize: 14 }}>
          ✕
        </div>
      </div>
    </div>
  );
}
