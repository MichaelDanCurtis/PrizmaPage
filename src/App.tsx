import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { useVault } from "./hooks/useVault";
import { listRecents, shareDocumentPath, revealDocument, copyDocument, welcomePath, type RecentEntry } from "./lib/recents";
import { vaultFileIn, getStoredVaultPath, vaultCreateNote } from "./lib/vault";
import { getTemplate } from "./lib/templates";
import { TemplatePicker } from "./components/TemplatePicker";
import { printDocument } from "./lib/print";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { registerLibrary } from "./components/library";
import { EmptyState } from "./components/EmptyState";
import { VaultDashboard } from "./components/VaultDashboard";
import { DocumentView } from "./components/DocumentView";
import { EditorView } from "./components/EditorView";
import { SettingsModal } from "./components/SettingsModal";
import { ConsentModal } from "./components/ConsentModal";
import { WorkflowCanvas } from "./components/WorkflowCanvas";
import { useAiConfig } from "./hooks/useAiConfig";

// Register the starter component library once at module load.
registerLibrary();

export function App() {
  const open = useOpenDocument();
  const vault = useVault();
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const templateTarget = useRef<"note" | null>(null);
  const ai = useAiConfig();

  useEffect(() => {
    listRecents().then(setRecents).catch(() => setRecents([]));
  }, [open.state]);

  const filename = open.path?.split("/").pop() ?? "document.mdxz";
  const hasVault = vault.vaultPath !== null;

  if (open.state === "editing" && open.document) {
    return (
      <EditorView
        document={open.document}
        filename={filename}
        path={open.path ?? ""}
        onClose={open.closeEditor}
        onOpenNote={(p) => open.openRecent(p)}
      />
    );
  }

  if (open.state === "document" && open.document) {
    return (
      <DocumentView
        document={open.document}
        filename={filename}
        path={open.path ?? ""}
        onEdit={open.openEditor}
        onShare={() => { if (open.path) revealDocument(open.path).catch(() => {}); }}
        onSaveCopy={async () => {
          if (!open.path) return;
          const dst = await saveDialog({ defaultPath: filename, filters: [{ name: "PrizmaPage document", extensions: ["mdxz"] }] });
          if (typeof dst === "string" && dst) copyDocument(open.path, dst).catch((e) => alert(`Copy failed: ${e}`));
        }}
        onCopyPath={() => { if (open.path) shareDocumentPath(open.path).catch(() => {}); }}
        onFileInVault={() => { void handleFileIn(open.path ?? ""); }}
        onPrint={() => printDocument()}
      />
    );
  }

  const handleFileIn = async (srcPath: string) => {
    if (!srcPath || !hasVault) return;
    const mode = window.confirm("Move into vault? Cancel to copy instead.") ? "move" : "copy";
    try {
      const newPath = await vaultFileIn(srcPath, vault.vaultPath!, mode);
      vault.reload();
      if (window.confirm(`Filed in vault as ${newPath.split("/").pop()}. Open it in the editor?`)) {
        open.openRecent(newPath).then(() => open.openEditor());
      }
    } catch (e) {
      alert(`File in vault failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // New note from a template: open the picker, then create + seed the note.
  const handleNewNote = () => {
    if (!vault.vaultPath) return;
    templateTarget.current = "note";
    setTemplatePickerOpen(true);
  };

  // Seed a just-created note with a template body via the save pipeline
  // (author-time content, like any other edit).
  const seedNote = async (path: string, mdx: string) => {
    const { compileMdx } = await import("./lib/compile");
    const compiled = await compileMdx(mdx);
    await invoke("save_document", {
      path,
      contentMd: mdx,
      compiledJs: compiled,
      manifest: { version: 1, capabilities: [], origin_domain: null, signature: null },
    });
  };

  const handlePickTemplate = async (templateId: string) => {
    const tmpl = getTemplate(templateId);
    setTemplatePickerOpen(false);
    if (templateTarget.current === "note" && vault.vaultPath) {
      const title = window.prompt("Note title", tmpl && templateId !== "blank" ? tmpl.title : "Untitled");
      if (!title) return;
      const path = await vaultCreateNote(vault.vaultPath, title);
      await seedNote(path, tmpl?.body ?? "# Untitled\n\n");
      vault.reload();
      await open.openRecent(path);
      open.openEditor();
    }
    templateTarget.current = null;
  };

  // SP8: daily note — YYYY-MM-DD.mdxz in Daily/, opens straight to editor.
  const handleNewDailyNote = async () => {
    if (!vault.vaultPath) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dailyDir = `${vault.vaultPath}/Daily`;
    const { vaultCreateNote } = await import("./lib/vault");
    const path = await vaultCreateNote(dailyDir, today);
    vault.reload();
    await open.openRecent(path);
    open.openEditor();
  };

  // SP8: count memories in Memories/ folder.
  const memoryCount = vault.entries.filter(
    (e) => !e.is_folder && e.path.includes("/Memories/")
  ).length;

  return (
    <>
      {hasVault ? (
        <VaultDashboard
          vaultPath={vault.vaultPath!}
          noteCount={vault.noteCount}
          recent={vault.recent}
          loading={vault.loading}
          onNewNote={handleNewNote}
          onNewDailyNote={handleNewDailyNote}
          memoryCount={memoryCount}
          onOpenNote={(p) => open.openRecent(p)}
          onOpenSingleFile={() => open.openViaPicker()}
          onOpenWorkflows={() => setWorkflowOpen(true)}
          onChangeVault={() => vault.chooseVault()}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <EmptyState
          recents={recents}
          onOpen={open.openViaPicker}
          onNew={open.createNew}
          onDrop={open.openViaDrop}
          onOpenRecent={open.openRecent}
          onOpenWelcome={() => {
            welcomePath().then((p) => open.openRecent(p)).catch(() => {});
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {/* Always-available "Choose vault" affordance when no vault set */}
      {!hasVault && (
        <button
          onClick={() => vault.chooseVault()}
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent)",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            font: "500 11px var(--font-sans)",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
          }}
        >
          📁 Choose a vault folder
        </button>
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {templatePickerOpen && (
        <TemplatePicker onPick={handlePickTemplate} onClose={() => setTemplatePickerOpen(false)} />
      )}
      {workflowOpen && (
        <WorkflowCanvas
          vaultPath={vault.vaultPath}
          provider={ai.provider}
          model={ai.model}
          onClose={() => setWorkflowOpen(false)}
        />
      )}
      {open.pendingConsent && (
        <ConsentModal
          manifest={open.pendingConsent.doc.manifest}
          filename={open.pendingConsent.path.split("/").pop() ?? "document.mdxz"}
          onGrant={(caps) => { void open.confirmConsent(caps); }}
          onCancel={open.cancelConsent}
        />
      )}
    </>
  );
}
