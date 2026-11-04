import { useState } from "react";
import type { RecentEntry } from "../lib/recents";

interface Props {
  recents: RecentEntry[];
  onOpen: () => void;
  onDrop: (path: string) => void;
  onOpenRecent: (path: string) => void;
  onOpenWelcome: () => void;
}

export function EmptyState({ recents, onOpen, onDrop, onOpenRecent, onOpenWelcome }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const path =
          e.dataTransfer.getData("text/plain") ||
          Array.from(e.dataTransfer.files).map((f) => (f as File & { path?: string }).path)[0];
        if (path) onDrop(path);
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
        PrizmaPage
      </div>
      <div style={{ font: "var(--font-small)", color: "var(--text-muted)", marginBottom: 24 }}>
        Open a document to begin
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onOpen}
          style={{
            background: "var(--accent)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            font: "500 11px var(--font-sans)",
            border: "none",
            cursor: "pointer",
          }}
        >
          📁 Open…
        </button>
        <div style={{ position: "relative" }}>
          <button
            disabled={recents.length === 0}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              background: "var(--bg)",
              color: "var(--text-muted)",
              padding: "8px 16px",
              borderRadius: "var(--radius)",
              font: "500 11px var(--font-sans)",
              border: "1px solid var(--border)",
              cursor: recents.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Recent ({recents.length})
          </button>
          {menuOpen && recents.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                padding: 4,
                minWidth: 200,
                zIndex: 10,
              }}
            >
              {recents.map((r) => (
                <button
                  key={r.path}
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenRecent(r.path);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: "6px 8px",
                    borderRadius: "var(--radius-sm)",
                    font: "var(--font-small)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 18, font: "var(--font-small)", color: "var(--text-faint)" }}>
        {dragOver ? "Drop to open" : "or drop a .mdxz file anywhere"}
      </div>
      <button
        onClick={onOpenWelcome}
        style={{
          marginTop: 20,
          background: "transparent",
          border: "none",
          font: "var(--font-small)",
          color: "var(--accent)",
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        First time? Read the welcome document
      </button>
    </div>
  );
}
