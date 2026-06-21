import { useEffect, useState } from "react";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { listRecents, shareDocumentPath, welcomePath, type RecentEntry } from "./lib/recents";
import { registerLibrary } from "./components/library";
import { EmptyState } from "./components/EmptyState";
import { DocumentView } from "./components/DocumentView";
import { EditorView } from "./components/EditorView";

// Register the starter component library once at module load.
registerLibrary();

export function App() {
  const open = useOpenDocument();
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    listRecents().then(setRecents).catch(() => setRecents([]));
  }, [open.state]);

  const filename = open.path?.split("/").pop() ?? "document.mdxz";

  if (open.state === "editing" && open.document) {
    return (
      <EditorView
        document={open.document}
        filename={filename}
        path={open.path ?? ""}
        onClose={open.closeEditor}
      />
    );
  }

  if (open.state === "document" && open.document) {
    return (
      <DocumentView
        document={open.document}
        filename={filename}
        onEdit={open.openEditor}
        onShare={() => {
          if (open.path) shareDocumentPath(open.path).catch(() => {});
        }}
      />
    );
  }

  return (
    <EmptyState
      recents={recents}
      onOpen={open.openViaPicker}
      onDrop={open.openViaDrop}
      onOpenRecent={open.openRecent}
      onOpenWelcome={() => {
        welcomePath()
          .then((p) => open.openRecent(p))
          .catch(() => {});
      }}
    />
  );
}
