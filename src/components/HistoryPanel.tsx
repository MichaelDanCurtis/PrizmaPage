import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { vaultListVersions, vaultRestoreVersion, type VersionEntry } from "../lib/history";
import { diffLines, type DiffLine } from "../lib/diff";

interface Props {
  vaultPath: string;
  docPath: string;
  currentContent: string;
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

export function HistoryPanel({ vaultPath, docPath, currentContent, onRestored, onClose }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);

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

  const compare = async (v: VersionEntry) => {
    setBusy(v.path);
    try {
      const opened = await invoke<{ content_md: string }>("open_document", { path: v.path });
      setDiff(diffLines(opened.content_md, currentContent));
    } catch (e) {
      alert(`Compare failed: ${e instanceof Error ? e.message : String(e)}`);
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
                onClick={() => compare(v)}
                disabled={busy === v.path}
                title="Compare this version with the current document"
                style={{ fontSize: 11, padding: "3px 10px", background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", opacity: busy === v.path ? 0.5 : 1 }}
              >
                Compare
              </button>
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
        {diff && (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Diff vs current</span>
              <button onClick={() => setDiff(null)} style={{ marginLeft: "auto", fontSize: 10, background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer" }}>close</button>
            </div>
            <pre style={{ margin: 0, maxHeight: 240, overflow: "auto", fontSize: 11, lineHeight: 1.5, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {diff.map((d, idx) => (
                <span key={idx} style={{ display: "block", color: d.type === "add" ? "#059669" : d.type === "del" ? "#dc2626" : "var(--text-muted)", background: d.type === "add" ? "rgba(5,150,105,0.08)" : d.type === "del" ? "rgba(220,38,38,0.08)" : "transparent" }}>
                  {d.type === "add" ? "+ " : d.type === "del" ? "- " : "  "}{d.text}
                </span>
              ))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
