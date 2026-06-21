import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { OpenedDocument } from "../lib/package";
import { compileMdx } from "../lib/compile";
import { serializeDoc, parseMdxToDoc, type Doc } from "../registry/serializer";
import { useEditorState } from "../hooks/useEditorState";
import { EditorTopBar } from "./EditorTopBar";
import { WysiwygSurface } from "./WysiwygSurface";
import { RawEditor } from "./RawEditor";
import { CodePeek } from "./CodePeek";
import { TrustFooter } from "./TrustFooter";

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

  const handleChange = (newDoc: Doc) => {
    setDoc(newDoc);
    editor.markDirty();
  };

  const handleRawChange = (v: string) => {
    setRawSource(v);
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

  const handleInsert = (template: string) => {
    if (editor.mode !== "wysiwyg") return;
    const newDoc = parseMdxToDoc(serializeDoc(doc) + "\n" + template + "\n");
    setDoc(newDoc);
    editor.markDirty();
  };

  const handleComponentActivate = (componentName: string) => {
    setPeekComponent(componentName);
    setPeekJsx(`<${componentName} />`);
  };

  const handlePeekApply = (jsx: string) => {
    const source = serializeDoc(doc).replace(`<${peekComponent} />`, jsx);
    setDoc(parseMdxToDoc(source));
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
        onInsert={handleInsert}
        onClose={onClose}
      />
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {editor.mode === "wysiwyg" ? (
          <WysiwygSurface doc={doc} onChange={handleChange} onComponentActivate={handleComponentActivate} />
        ) : (
          <RawEditor value={rawSource} onChange={handleRawChange} />
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
