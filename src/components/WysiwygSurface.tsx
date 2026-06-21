import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import { listComponents } from "../registry/ComponentRegistry";
import { ComponentNode } from "../registry/componentNode";
import { docFromJson, type Doc } from "../registry/serializer";
import { SlashMenu } from "./SlashMenu";

interface Props {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function WysiwygSurface({ doc, onChange, onEditorReady }: Props) {
  // Slash menu state.
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type / for commands, or just start writing…" }),
      ComponentNode,
    ],
    content: doc.json,
    onUpdate: ({ editor }) => {
      onChange(docFromJson(editor.getJSON()));
    },
  });

  // Wire slash menu to "/" keystroke via editor's handleKeyDown.
  useEffect(() => {
    if (!editor) return;
    onEditorReady?.(editor);

    // Override keydown to detect "/" at start of empty line or after space.
    const originalKeyDown = editor.options.editorProps.handleKeyDown;
    editor.options.editorProps.handleKeyDown = (view, event) => {
      if (event.key === "/" && !slashOpen) {
        const { state } = view;
        const { $from } = state.selection;
        const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
        // Open slash menu if "/" is typed at start of empty line or after whitespace.
        if (textBefore === "" || textBefore.endsWith(" ")) {
          slashRangeRef.current = {
            from: state.selection.from,
            to: state.selection.from,
          };
          setSlashQuery("");
          setSlashOpen(true);
          // Prevent the "/" from being typed — we'll handle it.
          event.preventDefault();
          return true;
        }
      } else if (slashOpen) {
        if (event.key === "Escape") {
          setSlashOpen(false);
          return true;
        }
        if (event.key === "Backspace") {
          if (slashQuery.length === 0) {
            setSlashOpen(false);
          } else {
            setSlashQuery(slashQuery.slice(0, -1));
          }
          event.preventDefault();
          return true;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setSlashQuery(slashQuery + event.key);
          event.preventDefault();
          return true;
        }
        if (event.key === "Enter") {
          // Confirm selection — the SlashMenu handles the actual insert via onSelect.
          event.preventDefault();
          return true;
        }
      }
      return originalKeyDown?.(view, event) ?? false;
    };

    return () => {
      editor.options.editorProps.handleKeyDown = originalKeyDown;
    };
  }, [editor, slashOpen, slashQuery, onEditorReady]);

  // Re-set content when the doc prop changes externally (e.g. raw toggle).
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const current = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(doc.json);
      if (current !== incoming) {
        editor.commands.setContent(doc.json);
      }
    }
  }, [doc, editor]);

  const handleSlashSelect = (template: string) => {
    if (!editor || !slashRangeRef.current) return;
    // Delete the "/" if it was typed, then insert the template.
    editor.commands.focus();
    // For prose templates (start with ##, -, >, etc.), insert as text and let
    // TipTap's markdown shortcuts convert. For component templates, insert as
    // a node.
    if (template.startsWith("<")) {
      // Component — insert as a generic "component" node with _name + _jsx attrs.
      const nameMatch = template.match(/^<(\w+)/);
      const name = nameMatch?.[1] ?? "Component";
      editor.commands.insertContent({
        type: "component",
        attrs: { _name: name, _jsx: template },
      });
    } else {
      editor.commands.insertContent(template);
    }
    setSlashOpen(false);
  };

  return (
    <div
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        color: "var(--text)",
        font: "var(--font-body)",
        position: "relative",
      }}
    >
      <EditorContent editor={editor} />
      {slashOpen && editor && (
        <SlashMenuPopup
          query={slashQuery}
          onSelect={handleSlashSelect}
          onClose={() => setSlashOpen(false)}
          editor={editor}
        />
      )}
    </div>
  );
}

/// Positions the SlashMenu near the current cursor position.
function SlashMenuPopup({
  query,
  onSelect,
  onClose,
  editor,
}: {
  query: string;
  onSelect: (t: string) => void;
  onClose: () => void;
  editor: ReturnType<typeof useEditor>;
}) {
  // Get cursor coords from TipTap's view.
  const coords = editor!.view.coordsAtPos(editor!.state.selection.from);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: "fixed",
    left: coords.left,
    top: coords.bottom + 6,
    zIndex: 50,
  });

  useEffect(() => {
    const c = editor!.view.coordsAtPos(editor!.state.selection.from);
    setStyle({ position: "fixed", left: c.left, top: c.bottom + 6, zIndex: 50 });
  }, [editor]);

  return (
    <div style={style}>
      <SlashMenu query={query} onSelect={onSelect} onClose={onClose} />
    </div>
  );
}


