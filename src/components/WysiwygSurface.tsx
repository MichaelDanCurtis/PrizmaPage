import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { ImageResize } from "./ImageResize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { DragHandle } from "@tiptap/extension-drag-handle";
import { useEffect, useRef, useState } from "react";
import { listComponents } from "../registry/ComponentRegistry";
import { ComponentNode } from "../registry/componentNode";
import { docFromJson, type Doc } from "../registry/serializer";
import { parseMdxToDoc } from "../registry/serializer";
import { topBlockInsertPos } from "../registry/blockInsert";
import { classifyPaste } from "../lib/smartPaste";
import { useInlineCompletion } from "../hooks/useInlineCompletion";
import { CompletionHint } from "./CompletionHint";
import { AiContextMenu } from "./AiContextMenu";
import { SlashMenu } from "./SlashMenu";

interface Props {
  doc: Doc;
  onChange: (doc: Doc) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
  /// Called when the user picks "AI component…" from the slash menu. EditorView
  /// opens the AiComponentDialog.
  onAiComponent?: () => void;
  /// Reflects onto the ProseMirror element's `spellcheck` attribute.
  spellcheck?: boolean;
}

export function WysiwygSurface({ doc, onChange, onEditorReady, onAiComponent, spellcheck = true }: Props) {
  // Slash menu state.
  const [slashOpen, setSlashOpen] = useState(false);
  const [aiMenu, setAiMenu] = useState<{ top: number; left: number; text: string } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      ImageResize,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      DragHandle.configure({
        // Subtle handle styled via the .drag-handle class in editor-content.css.
      }),
      Placeholder.configure({ placeholder: "Type / for commands, or just start writing…" }),
      ComponentNode,
    ],
    content: doc.json,
    // Native browser spellcheck on the editable surface. The attribute is
    // also kept in sync reactively by the effect below.
    editorProps: {
      attributes: {
        spellcheck: spellcheck ? "true" : "false",
      },
      handlePaste: (view, event) => {
        const cd = event.clipboardData;
        if (!cd) return false;
        const text = cd.getData("text/plain");
        const html = cd.getData("text/html") || null;
        const { empty } = view.state.selection;
        const strategy = classifyPaste({ text, html, hasSelection: !empty });

        if (strategy === "link") {
          // Select text, paste URL → wrap selection as a link.
          event.preventDefault();
          const mark = view.state.schema.marks.link.create({ href: text.trim() });
          view.dispatch(view.state.tr.addMark(view.state.selection.from, view.state.selection.to, mark));
          return true;
        }
        if (strategy === "markdown") {
          // Convert markdown text into nodes (best-effort; per-block so one
          // rejected block doesn't abort the whole paste).
          event.preventDefault();
          const parsed = parseMdxToDoc(text).json.content ?? [];
          let tr = view.state.tr;
          const at = view.state.selection.from;
          // Insert as a slice replacing the (collapsed or selected) range.
          for (const block of parsed) {
            try {
              const node = view.state.schema.nodeFromJSON(block);
              tr = tr.insert(tr.mapping.map(at), node);
            } catch {
              // skip a block the schema rejects
            }
          }
          view.dispatch(tr);
          return true;
        }
        return false; // html/plain → TipTap default handling
      },
    },
    onUpdate: ({ editor }) => {
      onChange(docFromJson(editor.getJSON()));
    },
  });

  // Keep the ProseMirror element's spellcheck attribute in sync with the prop
  // (TipTap does not recreate the editor on prop changes).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.setAttribute("spellcheck", spellcheck ? "true" : "false");
  }, [editor, spellcheck]);

  // Inline AI completion (debounced; Tab to accept).
  const inline = useInlineCompletion(editor);

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
    // Empty template is the "AI component…" affordance.
    if (template === "") {
      setSlashOpen(false);
      onAiComponent?.();
      return;
    }
    editor.commands.focus();
    if (template.startsWith("<")) {
      const nameMatch = template.match(/^<(\w+)/);
      const name = nameMatch?.[1] ?? "Component";
      // Components are block-level; if the cursor is inside a list/blockquote
      // insert after that container instead of nesting inside it.
      const insertPos = topBlockInsertPos(editor.state);
      const node = {
        type: "component",
        attrs: { _name: name, _jsx: template },
      };
      if (insertPos === null) {
        editor.commands.insertContent(node);
      } else {
        editor.commands.insertContentAt(insertPos, node);
      }
    } else {
      editor.commands.insertContent(template);
    }
    setSlashOpen(false);
  };

  return (
    <div
      onContextMenu={(e) => {
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        if (empty) return;
        e.preventDefault();
        const text = editor.state.doc.textBetween(from, to, " ");
        setAiMenu({ top: e.clientY, left: e.clientX, text });
      }}
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
      {inline.suggestion && inline.coords && editor && (
        <CompletionHint
          suggestion={inline.suggestion}
          coords={inline.coords}
          onAccept={inline.accept}
          onDismiss={inline.dismiss}
        />
      )}
      {aiMenu && editor && (
        <AiContextMenu
          selection={aiMenu.text}
          top={aiMenu.top}
          left={aiMenu.left}
          onApply={(result) => {
            // Replace the current selection with the AI result.
            const { from, to } = editor.state.selection;
            editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run();
          }}
          onClose={() => setAiMenu(null)}
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


