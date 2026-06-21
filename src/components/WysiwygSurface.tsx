import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { listComponents } from "../registry/ComponentRegistry";
import { makeComponentNode } from "../registry/componentNode";
import { docFromJson, type Doc } from "../registry/serializer";

interface Props {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onComponentActivate: (componentName: string) => void;
}

export function WysiwygSurface({ doc, onChange, onComponentActivate }: Props) {
  const componentNodes = listComponents()
    .filter((c) => c.category === "component")
    .map((c) => makeComponentNode(c.name));

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Type / for commands, or just start writing…" }),
      ...componentNodes,
    ],
    content: doc.json,
    onUpdate: ({ editor }) => {
      onChange(docFromJson(editor.getJSON()));
    },
    onSelectionUpdate: ({ editor }) => {
      const node = editor.state.selection.$from.node();
      if (node && listComponents().some((c) => c.name === node.type.name)) {
        onComponentActivate(node.type.name);
      }
    },
  });

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(doc.json);
    }
  }, [doc, editor]);

  return (
    <div
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        color: "var(--text)",
        font: "var(--font-body)",
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
