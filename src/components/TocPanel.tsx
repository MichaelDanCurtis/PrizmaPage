import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface Props {
  editor: Editor | null;
}

/// Extracts headings from the live TipTap doc, with their ProseMirror positions
/// so a click can scroll the editor to them. Updates on every doc change.
function extractHeadings(editor: Editor): TocItem[] {
  const items: TocItem[] = [];
  let pos = 0;
  editor.state.doc.descendants((node, p) => {
    if (node.type.name === "heading") {
      items.push({
        id: `h-${p}`,
        level: node.attrs.level as number,
        text: node.textContent,
        pos: p,
      });
    }
    return true;
  });
  return items;
}

/// The Word-style live outline. Lives in the nav pane's "Outline" tab.
export function TocPanel({ editor }: Props) {
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!editor) return;
    const update = () => setItems(extractHeadings(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  if (items.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 4px" }}>No headings yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item, i) => (
        <div
          key={i}
          onClick={() => {
            // Jump the editor to the heading. A small nudge into the block.
            editor?.chain().focus().setTextSelection(item.pos + 1).run();
          }}
          style={{
            paddingLeft: 4 + (item.level - 1) * 12,
            paddingRight: 4,
            paddingTop: 3,
            paddingBottom: 3,
            cursor: "pointer",
            borderRadius: "var(--radius-sm)",
            fontSize: item.level === 1 ? 12 : 11,
            fontWeight: item.level === 1 ? 600 : 400,
            color: item.level === 1 ? "var(--text)" : "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {item.text || "(empty heading)"}
        </div>
      ))}
    </div>
  );
}
