import { useEffect, useState } from "react";
import { vaultSearch, type SearchResult } from "../lib/vault";

interface Props {
  vaultPath: string;
  onClose: () => void;
  onOpen: (path: string) => void;
}

/// Cmd+Shift+F full-text search across the vault. Modal with a search input
/// and live results (snippet per match).
export function SearchModal({ vaultPath, onClose, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      vaultSearch(vaultPath, query)
        .then((r) => { setResults(r); setLoading(false); })
        .catch(() => { setResults([]); setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [query, vaultPath]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 80,
        zIndex: 250,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          width: 560,
          maxWidth: "92vw",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, borderBottom: "1px solid var(--border-soft)" }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault…"
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {loading && <div style={{ fontSize: 12, color: "var(--text-faint)", padding: 8 }}>Searching…</div>}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-faint)", padding: 8 }}>No matches.</div>
          )}
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => { onOpen(r.path); onClose(); }}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                {r.snippet}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
