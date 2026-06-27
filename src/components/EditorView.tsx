import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { Editor } from "@tiptap/react";
import type { OpenedDocument } from "../lib/package";
import { compileMdx } from "../lib/compile";
import { serializeDoc, parseMdxToDoc, type Doc } from "../registry/serializer";
import { topBlockInsertPos } from "../registry/blockInsert";
import { useEditorState } from "../hooks/useEditorState";
import { EditorTopBar } from "./EditorTopBar";
import { EditorToolbar } from "./EditorToolbar";
import { WysiwygSurface } from "./WysiwygSurface";
import { RawEditor } from "./RawEditor";
import { CodePeek } from "./CodePeek";
import { TrustFooter } from "./TrustFooter";
import { AiComponentDialog } from "./AiComponentDialog";
import { SettingsModal } from "./SettingsModal";
import { McpServerStatus } from "./McpServerStatus";
import { AiPanel } from "./AiPanel";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { signingGenerateKeypair, signingSign } from "../lib/signing";
import { computeStats, type DocStats } from "../lib/docStats";
import { DocStatsBar } from "./DocStatsBar";
import { CollapsiblePane } from "./CollapsiblePane";
import { FileTree } from "./FileTree";
import { BacklinksPanel } from "./BacklinksPanel";
import { TocPanel } from "./TocPanel";
import { GraphView } from "./GraphView";
import { SearchModal } from "./SearchModal";
import { CommandPalette } from "./CommandPalette";
import { useVault } from "../hooks/useVault";

interface ComponentActivateEvent extends Event {
  detail: { componentName: string; jsx: string };
}

interface Props {
  document: OpenedDocument;
  filename: string;
  path: string;
  onClose: () => void;
  /// Open a different note from the file tree (bubbles to App's open.openRecent).
  onOpenNote?: (path: string) => void;
}

export function EditorView({ document: initialDoc, filename, path, onClose, onOpenNote }: Props) {
  const editor = useEditorState();
  const [doc, setDoc] = useState<Doc>(() => parseMdxToDoc(initialDoc.content_md));
  const [rawSource, setRawSource] = useState<string>(initialDoc.content_md);
  const [peekComponent, setPeekComponent] = useState<string | null>(null);
  const [peekJsx, setPeekJsx] = useState<string>("");
  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const [stats, setStats] = useState<DocStats>(() => computeStats(serializeDoc(doc)));
  const panel = useResizablePanel("prizma.ai.panelWidth", 320, 240, 480);
  // SP2: collapsible file tree + nav panes. Widths persist in localStorage.
  const vault = useVault();
  const [filesOpen, setFilesOpen] = useState(() => localStorage.getItem("prizma.pane.files") !== "0");
  const [filesWidth] = useState(() => Number(localStorage.getItem("prizma.pane.filesWidth")) || 180);
  const [navOpen, setNavOpen] = useState(() => localStorage.getItem("prizma.pane.nav") !== "0");
  const [navWidth] = useState(() => Number(localStorage.getItem("prizma.pane.navWidth")) || 200);
  const [navTab, setNavTab] = useState<"outline" | "backlinks" | "graph">("outline");
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const toggleFiles = () => {
    const next = !filesOpen;
    setFilesOpen(next);
    localStorage.setItem("prizma.pane.files", next ? "1" : "0");
  };
  const toggleNav = () => {
    const next = !navOpen;
    setNavOpen(next);
    localStorage.setItem("prizma.pane.nav", next ? "1" : "0");
  };
  const toggleAi = () => setAiPanelOpen((v) => !v);

  // Cmd+1/2/3 toggle each pane; Cmd+Shift+F opens vault search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "1") { e.preventDefault(); toggleFiles(); }
        else if (e.key === "2") { e.preventDefault(); toggleNav(); }
        else if (e.key === "3") { e.preventDefault(); toggleAi(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // Keep a ref to handleSave so the Cmd+S listener (bound once) always calls
  // the latest version that closes over current state.
  const handleSaveRef = useRef<() => void>(() => {});

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

  // Track the editor's text selection for the AI panel's Selection mode.
  useEffect(() => {
    if (!tiptapEditor) return;
    const update = () => {
      const { from, to, empty } = tiptapEditor.state.selection;
      if (empty) {
        setSelection(null);
        return;
      }
      setSelection(tiptapEditor.state.doc.textBetween(from, to, " "));
    };
    tiptapEditor.on("selectionUpdate", update);
    return () => {
      tiptapEditor.off("selectionUpdate", update);
    };
  }, [tiptapEditor]);

  // Recompute document statistics (words/chars/reading time) on every editor
  // update. Cheap O(n); the update event fires on every edit.
  useEffect(() => {
    if (!tiptapEditor) return;
    const recompute = () => {
      const text = tiptapEditor.state.doc.textBetween(0, tiptapEditor.state.doc.content.size, " ");
      setStats(computeStats(text));
    };
    recompute();
    tiptapEditor.on("update", recompute);
    return () => {
      tiptapEditor.off("update", recompute);
    };
  }, [tiptapEditor]);

  const selectionStats: DocStats | null = selection ? computeStats(selection) : null;

  // Cmd/Ctrl+S → save the document (prevent the browser's save-page dialog).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
  // Sync the save ref on every render so the Cmd+S listener (bound once) calls
  // the latest closure of handleSave.
  handleSaveRef.current = handleSave;

  // Sign the document: reuse a stored keyid, or generate a new keypair first.
  const handleSign = async () => {
    try {
      let keyid = localStorage.getItem("prizma.signing.keyid");
      if (!keyid) {
        const info = await signingGenerateKeypair();
        keyid = info.keyid;
        localStorage.setItem("prizma.signing.keyid", keyid);
      }
      // Save first so the on-disk package is current, then sign it.
      await handleSave();
      await signingSign(path, keyid);
      alert(`Signed with key ${keyid.slice(0, 8)}.`);
    } catch (e) {
      alert(`Sign failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Insert at cursor via the TipTap editor instance.
  const handleInsert = (template: string) => {
    if (!tiptapEditor) return;
    // Empty template is the "AI component…" affordance from the slash/+ menus.
    if (template === "") {
      setAiDialogOpen(true);
      return;
    }
    tiptapEditor.commands.focus();
    if (template.startsWith("<")) {
      const nameMatch = template.match(/^<(\w+)/);
      const name = nameMatch?.[1] ?? "Component";
      // Components are block-level. If the cursor sits inside a container that
      // can't hold a block (e.g. a list item), find the position immediately
      // AFTER that container and insert there as a top-level block.
      const insertPos = topBlockInsertPos(tiptapEditor.state);
      const node = {
        type: "component",
        attrs: { _name: name, _jsx: template },
      };
      if (insertPos === null) {
        tiptapEditor.commands.insertContent(node);
      } else {
        tiptapEditor.commands.insertContentAt(insertPos, node);
      }
    } else {
      tiptapEditor.commands.insertContent(template);
    }
    editor.markDirty();
  };

  // AI-generated component: insert the returned JSX as a component node.
  const handleAiInsert = (jsx: string) => {
    setAiDialogOpen(false);
    if (!tiptapEditor) return;
    tiptapEditor.commands.focus();
    const nameMatch = jsx.match(/^<(\w+)/);
    const name = nameMatch?.[1] ?? "Component";
    const insertPos = topBlockInsertPos(tiptapEditor.state);
    const node = { type: "component", attrs: { _name: name, _jsx: jsx } };
    if (insertPos === null) {
      tiptapEditor.commands.insertContent(node);
    } else {
      tiptapEditor.commands.insertContentAt(insertPos, node);
    }
    editor.markDirty();
  };

  // Insert an image from a file picker as a data URL (keeps the .mdxz
  // self-contained — no external file references).
  const handleInsertImage = async () => {
    if (!tiptapEditor) return;
    const picked = await openDialog({
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      multiple: false,
    });
    if (typeof picked !== "string" || !picked) return;
    try {
      const res = await fetch(picked);
      const blob = await res.blob();
      if (blob.size > 2 * 1024 * 1024) {
        if (!window.confirm("Image is larger than 2MB. Embed anyway?")) return;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      tiptapEditor.chain().focus().setImage({ src: dataUrl }).run();
      editor.markDirty();
    } catch (e) {
      alert(`Could not read image: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Apply AI-generated MDX per the chosen landing mode.
  const handleAiApply = (
    mdx: string,
    mode: "replace" | "insert" | "append" | "replace-selection" | "insert-after"
  ) => {
    if (!tiptapEditor) return;
    tiptapEditor.commands.focus();
    const parsed = parseMdxToDoc(mdx).json.content ?? [];
    if (mode === "replace") {
      tiptapEditor.commands.setContent(parsed);
    } else if (mode === "append") {
      tiptapEditor.commands.setContent([
        ...((tiptapEditor.getJSON().content as unknown[]) ?? []),
        ...parsed,
      ]);
    } else if (mode === "insert" || mode === "insert-after") {
      tiptapEditor.commands.insertContent(parsed);
    } else if (mode === "replace-selection") {
      const { from, to } = tiptapEditor.state.selection;
      tiptapEditor.chain().deleteRange({ from, to }).insertContentAt(from, parsed).run();
    }
    editor.markDirty();
  };

  const handlePeekApply = (jsx: string) => {
    // Update the currently-selected component node's attrs in TipTap.
    // The node type is the generic "component"; the actual component name
    // lives in its _name attr, so match on attrs._name, not type.name.
    if (tiptapEditor && peekComponent) {
      tiptapEditor.commands.focus();
      const { state } = tiptapEditor;
      const { $from } = state.selection;
      let nodePos = -1;
      let nodeSize = 0;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === "component" && node.attrs?._name === peekComponent) {
          nodePos = $from.before(d);
          nodeSize = node.nodeSize;
          break;
        }
      }
      if (nodePos >= 0) {
        tiptapEditor.commands.deleteRange({ from: nodePos, to: nodePos + nodeSize });
        tiptapEditor.commands.insertContentAt(nodePos, {
          type: "component",
          attrs: { _name: peekComponent, _jsx: jsx },
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
        onSign={handleSign}
        onToggleMode={handleToggleMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onClose={onClose}
      />
      {editor.mode === "wysiwyg" && <EditorToolbar editor={tiptapEditor} onInsert={handleInsert} onInsertImage={handleInsertImage} />}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* File tree pane (vault) */}
        {vault.vaultPath && (
          <CollapsiblePane
            title="Files"
            side="left"
            collapsed={!filesOpen}
            width={filesWidth}
            onToggle={toggleFiles}
            background="var(--bg-muted)"
          >
            <FileTree
              entries={vault.entries}
              activePath={path}
              onOpen={(p) => onOpenNote?.(p)}
              onRename={vault.rename}
              onDelete={vault.remove}
              onNewNote={async (folder) => {
                const title = window.prompt("Note title", "Untitled");
                if (title) {
                  const vp = folder || vault.vaultPath!;
                  const { vaultCreateNote } = await import("../lib/vault");
                  await vaultCreateNote(vp, title);
                  vault.reload();
                }
              }}
            />
          </CollapsiblePane>
        )}
        {/* Nav pane (TOC/Backlinks — content in SP4; shell here) */}
        <CollapsiblePane
          title={navTab === "outline" ? "Outline" : navTab === "backlinks" ? "Backlinks" : "Graph"}
          side="left"
          collapsed={!navOpen}
          width={navWidth}
          onToggle={toggleNav}
        >
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <button
              onClick={() => setNavTab("outline")}
              style={{
                fontSize: 9, padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                background: navTab === "outline" ? "var(--accent)" : "transparent",
                color: navTab === "outline" ? "white" : "var(--text-muted)",
                fontWeight: navTab === "outline" ? 600 : 400,
              }}
            >
              Outline
            </button>
            <button
              onClick={() => setNavTab("backlinks")}
              style={{
                fontSize: 9, padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                background: navTab === "backlinks" ? "var(--accent)" : "transparent",
                color: navTab === "backlinks" ? "white" : "var(--text-muted)",
                fontWeight: navTab === "backlinks" ? 600 : 400,
              }}
            >
              Backlinks
            </button>
            <button
              onClick={() => setNavTab("graph")}
              style={{
                fontSize: 9, padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                background: navTab === "graph" ? "var(--accent)" : "transparent",
                color: navTab === "graph" ? "white" : "var(--text-muted)",
                fontWeight: navTab === "graph" ? 600 : 400,
              }}
            >
              Graph
            </button>
          </div>
          {navTab === "outline" ? (
            <TocPanel editor={tiptapEditor} />
          ) : navTab === "backlinks" ? (
            <BacklinksPanel
              currentName={filename.replace(/\.mdxz$/, "")}
              notePaths={vault.entries.filter((e) => !e.is_folder).map((e) => e.path)}
              onOpen={(p) => onOpenNote?.(p)}
            />
          ) : (
            <GraphView
              entries={vault.entries}
              activePath={path}
              onOpen={(p) => onOpenNote?.(p)}
            />
          )}
        </CollapsiblePane>
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {editor.mode === "wysiwyg" ? (
            <WysiwygSurface
              doc={doc}
              onChange={handleChange}
              onEditorReady={setTiptapEditor}
              onAiComponent={() => setAiDialogOpen(true)}
            />
          ) : (
            <RawEditor value={rawSource} onChange={(v) => { setRawSource(v); editor.markDirty(); }} />
          )}
        </div>
        {/* AI pane */}
        <CollapsiblePane
          title="AI ✨"
          side="right"
          collapsed={!aiPanelOpen}
          width={panel.width}
          onToggle={toggleAi}
          background="var(--bg-muted)"
        >
          <AiPanel
            selection={selection}
            onApply={handleAiApply}
            onCollapse={toggleAi}
            onOpenSettings={() => setSettingsOpen(true)}
            width={panel.width}
            vaultPath={vault.vaultPath}
          />
        </CollapsiblePane>
      </div>
      <DocStatsBar stats={stats} selectionStats={selectionStats} />
      <TrustFooter filename={filename} originDomain={initialDoc.manifest.origin_domain} verifyResult={null} />
      <McpServerStatus docPath={path} />
      {peekComponent && (
        <CodePeek
          componentName={peekComponent}
          initialJsx={peekJsx}
          onApply={handlePeekApply}
          onCancel={() => setPeekComponent(null)}
        />
      )}
      {aiDialogOpen && (
        <AiComponentDialog onInsert={handleAiInsert} onClose={() => setAiDialogOpen(false)} />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {searchOpen && vault.vaultPath && (
        <SearchModal
          vaultPath={vault.vaultPath}
          onClose={() => setSearchOpen(false)}
          onOpen={(p) => onOpenNote?.(p)}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          selection={selection}
          documentText={editor.mode === "wysiwyg" ? serializeDoc(doc) : rawSource}
          onClose={() => setPaletteOpen(false)}
          onApply={handleAiApply}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
    </div>
  );
}
