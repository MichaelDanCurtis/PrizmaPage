import { useState } from "react";

interface Props {
  onSave: (title: string, content: string, tags: string[]) => Promise<void>;
  onClose: () => void;
}

const field: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  color: "var(--text)",
  background: "var(--bg)",
  fontFamily: "var(--font-sans)",
};

export function MemoryDialog({ onSave, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      await onSave(title.trim(), content, tagList);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "var(--font-sans)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0 16px 48px rgba(0,0,0,0.25)", width: 480, maxWidth: "92vw", maxHeight: "82vh", overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Save a memory</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={field} autoFocus />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What do you want to remember?" rows={6} style={{ ...field, fontFamily: "var(--font-sans)", resize: "vertical" }} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" style={field} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ fontSize: 12, padding: "6px 14px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving} style={{ fontSize: 12, padding: "6px 14px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", opacity: !title.trim() || saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save memory"}
          </button>
        </div>
      </div>
    </div>
  );
}
