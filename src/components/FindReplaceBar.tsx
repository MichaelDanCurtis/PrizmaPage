import { useEffect, useRef } from "react";

interface Props {
  findText: string;
  replaceText: string;
  onFindChange: (v: string) => void;
  onReplaceChange: (v: string) => void;
  matchCount: number;
  matchIndex: number; // 0-based current match
  onNext: () => void;
  onPrev: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: "3px 6px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  width: 180,
};

const btn = (): React.CSSProperties => ({
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  padding: "3px 8px",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
});

export function FindReplaceBar({ findText, replaceText, onFindChange, onReplaceChange, matchCount, matchIndex, onNext, onPrev, onReplaceOne, onReplaceAll, onClose }: Props) {
  const findRef = useRef<HTMLInputElement>(null);
  useEffect(() => { findRef.current?.focus(); findRef.current?.select(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = matchCount === 0 ? "0 results" : `${matchIndex + 1} / ${matchCount}`;

  return (
    <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 12px", borderBottom: "1px solid var(--border-soft)", background: "var(--bg-muted)", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input ref={findRef} value={findText} placeholder="Find" onChange={(e) => onFindChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? onPrev() : onNext(); } }} style={inputStyle} />
        <span style={{ fontSize: 11, color: "var(--text-faint)", minWidth: 70 }}>{shown}</span>
        <button title="Previous" onClick={onPrev} style={btn()}>↑</button>
        <button title="Next" onClick={onNext} style={btn()}>↓</button>
        <button title="Close" onClick={onClose} style={{ ...btn(), marginLeft: "auto" }}>✕</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input value={replaceText} placeholder="Replace" onChange={(e) => onReplaceChange(e.target.value)} style={inputStyle} />
        <button title="Replace" onClick={onReplaceOne} style={btn()}>Replace</button>
        <button title="Replace all" onClick={onReplaceAll} style={btn()}>All</button>
      </div>
    </div>
  );
}
