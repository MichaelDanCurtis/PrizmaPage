import { BubbleMenu } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";

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
        <button onClick={remove} title="Remove link" style={{ fontSize: 11, padding: "3px 8px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>✕</button>
      </div>
    </BubbleMenu>
  );
}
