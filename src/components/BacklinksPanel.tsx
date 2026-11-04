import { useEffect, useState } from "react";
import type { Backlink } from "../lib/backlinks";
import { findBacklinks } from "../lib/backlinks";

interface Props {
  /// The current note's display name (without .mdxz).
  currentName: string;
  /// All .mdxz paths in the vault to scan.
  notePaths: string[];
  onOpen: (path: string) => void;
}

/// Lists notes in the vault that link to the current note. Lives in the nav
/// pane's "Backlinks" tab.
export function BacklinksPanel({ currentName, notePaths, onOpen }: Props) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    findBacklinks(currentName, notePaths)
      .then((bl) => { if (!cancelled) { setBacklinks(bl); setLoading(false); } })
      .catch(() => { if (!cancelled) { setBacklinks([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [currentName, notePaths.join(",")]);

  if (loading) {
    return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 4px" }}>Scanning vault…</div>;
  }

  if (backlinks.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 4px" }}>No backlinks.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {backlinks.map((bl, i) => (
        <div
          key={i}
          onClick={() => onOpen(bl.sourcePath)}
          style={{
            cursor: "pointer",
            padding: "6px 8px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-muted)",
            border: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 2 }}>
            ← {bl.sourceName}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>
            {bl.context}
          </div>
        </div>
      ))}
    </div>
  );
}
