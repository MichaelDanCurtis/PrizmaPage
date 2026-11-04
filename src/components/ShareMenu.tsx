import { useState } from "react";

interface Props {
  onShare: () => void;   // reveal in file manager (system share entry)
  onSaveCopy: () => void; // save-a-copy dialog
  onCopyPath: () => void; // copy path to clipboard
  onFileInVault: () => void; // SP1: file into vault
}

/// A small popover with three sharing affordances, anchored under the Share
/// button. Closes after any action.
export function ShareMenu({ onShare, onSaveCopy, onCopyPath, onFileInVault }: Props) {
  const row = (icon: string, label: string, action: () => void) => (
    <div
      onClick={() => action()}
      style={{
        padding: "7px 12px",
        cursor: "pointer",
        display: "flex",
        gap: 8,
        alignItems: "center",
        color: "var(--text)",
        font: "var(--font-small)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: 4,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: 4,
        minWidth: 180,
        zIndex: 100,
      }}
    >
      {row("📤", "Reveal in Finder", onShare)}
      {row("📥", "File in vault…", onFileInVault)}
      {row("💾", "Save a copy…", onSaveCopy)}
      {row("📋", "Copy path", onCopyPath)}
    </div>
  );
}
