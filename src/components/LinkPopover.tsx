import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
import { slugify } from "../lib/anchorLinks";

interface Props {
  editor: Editor | null;
}

/// A bubble menu that appears when the caret is inside a link mark. Edits the
/// href over the full mark range, or removes the link. Complements the
/// existing "add link" toolbar affordance.
export function LinkPopover({ editor }: Props) {
  const [href, setHref] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (editor.isActive("link")) {
        const h = editor.getAttributes("link").href;
        setHref(typeof h === "string" ? h : "");
        setOpen(true);
      } else {
        setOpen(false);
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor || !open) return null;

  const apply = () => {
    if (href.trim()) {
      editor.chain().extendMarkRange("link").setLink({ href: href.trim() }).focus().run();
    } else {
      editor.chain().extendMarkRange("link").unsetLink().focus().run();
      setOpen(false);
    }
  };
  const remove = () => {
    editor.chain().extendMarkRange("link").unsetLink().focus().run();
    setOpen(false);
  };

  // Headings available for cross-reference (anchor) links.
  const headings = useMemo(() => {
    if (!editor) return [];
    const out: { text: string; slug: string }[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        out.push({ text: node.textContent, slug: slugify(node.textContent) });
      }
    });
    return out;
  }, [editor, open]);

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={() => open}
      pluginKey="prizma-link-popover"
    >
      <div className="no-print" style={{ display: "flex", gap: 4, alignItems: "center", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 4, fontFamily: "var(--font-sans)" }}>
        <input
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          placeholder="https://"
          style={{ width: 180, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text)", background: "var(--bg)" }}
        />
        <button onClick={apply} style={{ fontSize: 11, padding: "3px 8px", background: "var(--accent)", color: "white", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Apply</button>
        {headings.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) setHref(`#${e.target.value}`); }}
            title="Link to a heading in this document"
            style={{ fontSize: 11, maxWidth: 120, padding: "3px 4px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text-muted)" }}
          >
            <option value="">§ heading…</option>
            {headings.map((h, i) => <option key={i} value={h.slug}>{h.text.slice(0, 30)}</option>)}
          </select>
        )}
        <button onClick={remove} title="Remove link" style={{ fontSize: 11, padding: "3px 8px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>✕</button>
      </div>
    </BubbleMenu>
  );
}
