import { useEffect, useState } from "react";
import { vaultListVersions, vaultRestoreVersion, type VersionEntry } from "../lib/history";

interface Props {
  vaultPath: string;
  docPath: string;
  onRestored: () => void;
  onClose: () => void;
}

/// Format a unix-seconds timestamp into a readable label.
function fmtTs(ts: number): string {
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return `unix:${ts}`;
  }
}

export function HistoryPanel({ vaultPath, docPath, onRestored, onClose }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    vaultListVersions(vaultPath, docPath)
      .then((v) => { if (!cancelled) setVersions(v); })
      .catch(() => { if (!cancelled) setVersions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vaultPath, docPath]);

  const restore = async (v: VersionEntry) => {
    if (!window.confirm(`Restore the version from ${fmtTs(v.ts)}? The current document will be overwritten (snapshotted first).`)) return;
    setBusy(v.path);
    try {
      await vaultRestoreVersion(v.path, docPath);
      onRestored();
      onClose();
    } catch (e) {
      alert(`Restore failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 460, maxWidth: "92vw", maxHeight: "70vh", overflow: "auto", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Version history</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
        {loading && <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading…</div>}
        {!loading && versions.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No saved versions yet. Versions are captured each time you save.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {versions.map((v) => (
            <div key={v.path} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>{fmtTs(v.ts)}</span>
              <button
                onClick={() => restore(v)}
                disabled={busy === v.path}
                style={{ fontSize: 11, padding: "3px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", opacity: busy === v.path ? 0.5 : 1 }}
              >
                {busy === v.path ? "…" : "Restore"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
