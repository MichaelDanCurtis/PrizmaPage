import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Editor } from "@tiptap/react";
import type { OpenedDocument } from "../lib/package";
import { compileMdx } from "../lib/compile";
import { serializeDoc, parseMdxToDoc, type Doc } from "../registry/serializer";
import { useEditorState } from "../hooks/useEditorState";
import { EditorTopBar } from "./EditorTopBar";
import { EditorToolbar } from "./EditorToolbar";
import { WysiwygSurface } from "./WysiwygSurface";
import { RawEditor } from "./RawEditor";
import { CodePeek } from "./CodePeek";
import { TrustFooter } from "./TrustFooter";

interface ComponentActivateEvent extends Event {
  detail: { componentName: string; jsx: string };
}

interface Props {
  document: OpenedDocument;
  filename: string;
  path: string;
  onClose: () => void;
}

export function EditorView({ document: initialDoc, filename, path, onClose }: Props) {
  const editor = useEditorState();
  const [doc, setDoc] = useState<Doc>(() => parseMdxToDoc(initialDoc.content_md));
  const [rawSource, setRawSource] = useState<string>(initialDoc.content_md);
  const [peekComponent, setPeekComponent] = useState<string | null>(null);
  const [peekJsx, setPeekJsx] = useState<string>("");
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);

  // Listen for component double-click events from node views.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as ComponentActivateEvent).detail;
      setPeekComponent(detail.componentName);
      setPeekJsx(detail.jsx);
    };
    window.addEventListener("prizma:component-activate", handler);
    return () => window.removeEventListener("prizma:component-activate", handler);
  }, []);

  const handleChange = (newDoc: Doc) => {
    setDoc(newDoc);
    editor.markDirty();
  };

  const handleToggleMode = () => {
    if (editor.mode === "wysiwyg") {
      setRawSource(serializeDoc(doc));
      editor.toggleMode();
    } else {
      try {
        const newDoc = parseMdxToDoc(rawSource);
        setDoc(newDoc);
        editor.toggleMode();
      } catch (e) {
        alert(`Could not parse MDX: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const handleSave = async () => {
    editor.setSaving(true);
    try {
      const source = editor.mode === "wysiwyg" ? serializeDoc(doc) : rawSource;
      const compiled = await compileMdx(source);
      await invoke("save_document", {
        path,
        contentMd: source,
        compiledJs: compiled,
        manifest: initialDoc.manifest,
      });
      editor.markSaved();
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      editor.setSaving(false);
    }
  };

  // Insert at cursor via the TipTap editor instance.
  const handleInsert = (template: string) => {
    if (!tiptapEditor) return;
    tiptapEditor.commands.focus();
    if (template.startsWith("<")) {
      const nameMatch = template.match(/^<(\w+)/);
      const name = nameMatch?.[1] ?? "Component";
      tiptapEditor.commands.insertContent({
        type: name,
        attrs: { jsx: template },
      });
    } else {
      tiptapEditor.commands.insertContent(template);
    }
    editor.markDirty();
  };

  const handlePeekApply = (jsx: string) => {
    // Update the currently-selected component node's attrs in TipTap.
    if (tiptapEditor && peekComponent) {
      tiptapEditor.commands.focus();
      // Find the component node in the selection and update its jsx attr.
      const { state } = tiptapEditor;
      const { $from } = state.selection;
      let nodePos = -1;
      let nodeSize = 0;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === peekComponent) {
          nodePos = $from.before(d);
          nodeSize = node.nodeSize;
          break;
        }
      }
      if (nodePos >= 0) {
        // Replace the node with updated attrs.
        tiptapEditor.commands.deleteRange({ from: nodePos, to: nodePos + nodeSize });
        tiptapEditor.commands.insertContentAt(nodePos, {
          type: peekComponent,
          attrs: { jsx },
        });
      }
    }
    setPeekComponent(null);
    editor.markDirty();
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <EditorTopBar
        filename={filename}
        dirty={editor.dirty}
        saving={editor.saving}
        mode={editor.mode}
        onSave={handleSave}
        onToggleMode={handleToggleMode}
        onClose={onClose}
      />
      {editor.mode === "wysiwyg" && <EditorToolbar editor={tiptapEditor} onInsert={handleInsert} />}
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {editor.mode === "wysiwyg" ? (
          <WysiwygSurface
            doc={doc}
            onChange={handleChange}
            onEditorReady={setTiptapEditor}
          />
        ) : (
          <RawEditor value={rawSource} onChange={(v) => { setRawSource(v); editor.markDirty(); }} />
        )}
      </div>
      <TrustFooter filename={filename} signatureDomain={initialDoc.manifest.origin_domain} />
      {peekComponent && (
        <CodePeek
          componentName={peekComponent}
          initialJsx={peekJsx}
          onApply={handlePeekApply}
          onCancel={() => setPeekComponent(null)}
        />
      )}
    </div>
  );
}
