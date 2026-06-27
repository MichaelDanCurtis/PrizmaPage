import { useEffect, useState } from "react";
import { listComments, addComment, resolveComment, clearComments, type Comment } from "../lib/commentsStore";

interface Props {
  docPath: string;
  selection: string | null;
}

export function CommentsPanel({ docPath, selection }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  const refresh = () => setComments(listComments(docPath));
  useEffect(refresh, [docPath]);

  const submit = () => {
    if (!draft.trim()) return;
    addComment(docPath, { anchor: selection ?? "(whole document)", body: draft.trim() });
    setDraft("");
    refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)" }}>Comments</span>
        {comments.length > 0 && (
          <button onClick={() => { clearComments(docPath); refresh(); }} style={{ marginLeft: "auto", fontSize: 9, background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer" }}>clear</button>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={selection ? `Comment on "${selection.slice(0, 24)}${selection.length > 24 ? "…" : ""}"` : "Add a comment"}
        rows={2}
        style={{ width: "100%", boxSizing: "border-box", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 11, color: "var(--text)", background: "var(--bg)", resize: "vertical" }}
      />
      <button onClick={submit} disabled={!draft.trim()} style={{ alignSelf: "flex-start", fontSize: 10, padding: "3px 10px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer", opacity: draft.trim() ? 1 : 0.5 }}>
        Add comment
      </button>
      {comments.length === 0 && <div style={{ fontSize: 10, color: "var(--text-faint)" }}>No comments yet.</div>}
      {comments.slice().reverse().map((c) => (
        <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 6, opacity: c.resolved ? 0.5 : 1 }}>
          <div style={{ fontSize: 9, color: "var(--text-faint)", marginBottom: 2 }}>{c.author} · on "{c.anchor.slice(0, 30)}{c.anchor.length > 30 ? "…" : ""}"</div>
          <div style={{ fontSize: 11, color: "var(--text)" }}>{c.body}</div>
          <button onClick={() => { resolveComment(docPath, c.id); refresh(); }} style={{ marginTop: 4, fontSize: 9, background: "none", border: "none", color: "var(--accent)", cursor: "pointer" }}>
            {c.resolved ? "↺ reopen" : "✓ resolve"}
          </button>
        </div>
      ))}
    </div>
  );
}
