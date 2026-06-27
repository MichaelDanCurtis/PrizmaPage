import { useState } from "react";

interface Props {
  filename: string;
  dirty: boolean;
  saving: boolean;
  mode: "wysiwyg" | "raw";
  focusEnabled: boolean;
  onSave: () => void;
  onSign: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onShowShortcuts: () => void;
  onToggleFocus: () => void;
  onOpenHistory: () => void;
  onClose: () => void;
}

export function EditorTopBar({ filename, dirty, saving, mode, focusEnabled, onSave, onSign, onExportPdf, onExportHtml, onExportMarkdown, onToggleMode, onOpenSettings, onShowShortcuts, onToggleFocus, onOpenHistory, onClose }: Props) {
  const [exportOpen, setExportOpen] = useState(false);
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
          onClick={onOpenHistory}
          title="Version history"
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
          📋
        </button>
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
        <div className="no-print" style={{ position: "relative" }}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            title="Export"
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
          {exportOpen && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, zIndex: 200, minWidth: 150, fontFamily: "var(--font-sans)" }}>
              {[
                { label: "PDF / Print", fn: onExportPdf },
                { label: "HTML", fn: onExportHtml },
                { label: "Markdown", fn: onExportMarkdown },
              ].map((opt) => (
                <div
                  key={opt.label}
                  onClick={() => { setExportOpen(false); opt.fn(); }}
                  style={{ padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "var(--text)", borderRadius: "var(--radius-sm)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </div>
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
