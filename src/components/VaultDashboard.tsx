import { useState } from "react";
import type { VaultEntry } from "../lib/vault";

interface Props {
  vaultPath: string;
  noteCount: number;
  recent: VaultEntry[];
  loading: boolean;
  onNewNote: () => void;
  /// SP8: create today's daily note (YYYY-MM-DD.mdxz in Daily/).
  onNewDailyNote: () => void;
  /// SP8: count of unfiled memories in Memories/ folder.
  memoryCount: number;
  /// SP8: open the "save a memory" dialog.
  onSaveMemory: () => void;
  onOpenNote: (path: string) => void;
  onOpenSingleFile: () => void;
  /// SP9: open the workflow canvas.
  onOpenWorkflows: () => void;
  onChangeVault: () => void;
  onOpenSettings: () => void;
}

const btn: React.CSSProperties = {
  border: "1px solid var(--border)",
  padding: "8px 16px",
  borderRadius: "var(--radius)",
  font: "500 11px var(--font-sans)",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  ...btn,
  background: "var(--accent)",
  color: "white",
  border: "none",
};

/// The centered dashboard shown on launch when a vault is set. (Vault home = B.)
/// Vault name, counts, recent notes, and the big entry-point actions.
export function VaultDashboard({
  vaultPath,
  noteCount,
  recent,
  loading,
  onNewNote,
  onNewDailyNote,
  memoryCount,
  onSaveMemory,
  onOpenNote,
  onOpenSingleFile,
  onOpenWorkflows,
  onChangeVault,
  onOpenSettings,
}: Props) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const vaultName = vaultPath.split("/").pop() ?? "vault";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--bg-muted)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--content-padding)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: "linear-gradient(135deg, var(--accent), var(--accent-border))",
          borderRadius: "var(--radius-xl)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 700,
          fontSize: 24,
          marginBottom: 18,
          boxShadow: "0 8px 24px rgba(79, 70, 229, 0.3)",
        }}
      >
        P
      </div>
      <div style={{ font: "var(--font-display)", color: "var(--text)", marginBottom: 4 }}>
        {vaultName}
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-muted)", marginBottom: 24 }}>
        {loading ? "Loading…" : `${noteCount} note${noteCount === 1 ? "" : "s"}`}
      </div>

      {!loading && recent.length > 0 && (
        <div style={{ marginBottom: 20, maxWidth: 460, width: "100%" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-faint)",
              marginBottom: 8,
            }}
          >
            Recent
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recent.map((r) => (
              <button
                key={r.path}
                onClick={() => onOpenNote(r.path)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  font: "var(--font-small)",
                  color: "var(--text)",
                }}
              >
                <span>{r.name.replace(/\.mdxz$/, "")}</span>
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                  {timeAgo(r.modified)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button style={primaryBtn} onClick={onNewNote}>
          ✨ New note
        </button>
        <button style={btn} onClick={onNewDailyNote} title="Create today's daily note">
          📅 Today
        </button>
        <button style={btn} onClick={() => setBrowseOpen(true)}>
          📁 Browse vault
        </button>
        <button style={btn} onClick={onOpenSingleFile}>
          📄 Open single file
        </button>
        <button style={btn} onClick={onOpenWorkflows} title="Build and run document workflows">
          ⚡ Workflows
        </button>
        <button style={btn} onClick={onSaveMemory} title="Save a memory to Memories/">
          🧠 Save memory
        </button>
      </div>
      {memoryCount > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--accent)" }}>
          📥 {memoryCount} memor{memoryCount === 1 ? "y" : "ies"} in Memories/
        </div>
      )}
      <div style={{ marginTop: 20, display: "flex", gap: 14 }}>
        <button
          onClick={onChangeVault}
          style={{ background: "transparent", border: "none", font: "var(--font-small)", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
        >
          Change vault
        </button>
        <button
          onClick={onOpenSettings}
          style={{ background: "transparent", border: "none", font: "var(--font-small)", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
        >
          Settings
        </button>
      </div>

      {browseOpen && (
        <BrowseModal recent={recent} onClose={() => setBrowseOpen(false)} onOpen={onOpenNote} />
      )}
    </div>
  );
}

/// A simple browse modal — flat list of all notes in the vault. (The full file
/// tree comes in the editor layout; the dashboard browse is a quick picker.)
function BrowseModal({ recent, onClose, onOpen }: { recent: VaultEntry[]; onClose: () => void; onOpen: (p: string) => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.2)", width: 420, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto", padding: 16 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>Browse vault</div>
        {recent.length === 0 && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No notes yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {recent.map((r) => (
            <button
              key={r.path}
              onClick={() => { onOpen(r.path); onClose(); }}
              style={{ background: "transparent", border: "none", textAlign: "left", padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", font: "var(--font-small)", color: "var(--text)" }}
            >
              {r.name.replace(/\.mdxz$/, "")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(unixSec * 1000).toLocaleDateString();
}
