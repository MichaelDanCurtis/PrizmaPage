import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { filterHeadings, type Heading } from "../lib/outlineJump";

interface Props { editor: Editor | null; onJump: (pos: number) => void; onClose: () => void; }

export function OutlineJump({ editor, onJump, onClose }: Props) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const headings: Heading[] = useMemo(() => {
    if (!editor) return [];
    const out: Heading[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        out.push({ level: node.attrs.level, text: node.textContent, pos });
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, q]); // re-derive when the query changes (cheap)

  const filtered = filterHeadings(headings, q);
  const go = (h: Heading) => { onJump(h.pos); onClose(); };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120, zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 480, maxWidth: "92vw", maxHeight: "60vh", overflow: "auto", padding: 12 }}>
        <input ref={inputRef} value={q} placeholder="Jump to heading…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && filtered[0]) go(filtered[0]); }} style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, color: "var(--text)", background: "var(--bg)", marginBottom: 8 }} />
        {filtered.map((h, i) => (
          <div key={i} onClick={() => go(h)} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 13, color: "var(--text)", paddingLeft: 10 + (h.level - 1) * 12, borderRadius: "var(--radius-sm)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            {h.text}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)" }}>No matching headings.</div>}
      </div>
    </div>
  );
}
