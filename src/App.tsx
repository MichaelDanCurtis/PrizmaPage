import { useEffect, useState } from "react";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { listRecents, shareDocumentPath, type RecentEntry } from "./lib/recents";
import { EmptyState } from "./components/EmptyState";
import { DocumentView } from "./components/DocumentView";

export function App() {
  const open = useOpenDocument();
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  useEffect(() => {
    listRecents().then(setRecents).catch(() => setRecents([]));
  }, [open.state]); // refresh recents when the open state changes

  const filename = open.path?.split("/").pop() ?? "document.mdxz";

  if (open.state === "document" && open.document) {
    return (
      <DocumentView
        document={open.document}
        filename={filename}
        onEdit={() => {
          /* Layer 2 — present but inert. */
        }}
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
    />
  );
}
