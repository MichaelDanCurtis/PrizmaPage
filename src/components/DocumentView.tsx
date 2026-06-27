import { useState, useEffect } from "react";
import type { OpenedDocument } from "../lib/package";
import { getDocSetting, setDocSetting } from "../lib/docSettings";
import { useHoverControls } from "../hooks/useHoverControls";
import { signingVerify, type VerifyResult } from "../lib/signing";
import { DocumentCanvas } from "./DocumentCanvas";
import { HoverControls } from "./HoverControls";
import { TrustFooter } from "./TrustFooter";

interface Props {
  document: OpenedDocument;
  filename: string;
  path: string;
  onEdit: () => void;
  onShare: () => void;     // reveal in file manager
  onSaveCopy: () => void;  // save-a-copy dialog
  onCopyPath: () => void;  // copy path to clipboard
  onFileInVault: () => void; // SP1: file this viewed doc into the vault
  onPrint: () => void;     // print / export to PDF
}

export function DocumentView({ document: doc, filename, path, onEdit, onShare, onSaveCopy, onCopyPath, onFileInVault, onPrint }: Props) {
  const { visible, onEnter, onLeave } = useHoverControls();
  const [zoomPct, setZoomPct] = useState(() => getDocSetting(path).zoom);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  // Verify the package signature at open. Unsigned docs (the common case)
  // resolve to "unsigned"; signed docs show the keyid.
  useEffect(() => {
    let cancelled = false;
    signingVerify(path)
      .then((r) => { if (!cancelled) setVerifyResult(r); })
      .catch(() => { if (!cancelled) setVerifyResult({ state: "unsigned" }); });
    return () => { cancelled = true; };
  }, [path]);

  const persistZoom = (z: number) => { setDocSetting(path, { zoom: z }); };
  const zoomIn = () => setZoomPct((z) => { const n = Math.min(200, z + 10); persistZoom(n); return n; });
  const zoomOut = () => setZoomPct((z) => { const n = Math.max(50, z - 10); persistZoom(n); return n; });

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", overflow: "auto" }}>
      {/* Top hover zone — invisible strip that triggers the control pill. */}
      <div
        data-testid="hover-zone"
        style={{ position: "fixed", top: 0, left: 0, right: 0, height: 80, zIndex: 50 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
      {/* Control pill — floats top-right, visible only when hover state active. */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          top: 12,
          right: 16,
          zIndex: 51,
          transition: "opacity 150ms ease",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <HoverControls
          visible={visible}
          zoomPct={zoomPct}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onShare={onShare}
          onSaveCopy={onSaveCopy}
          onCopyPath={onCopyPath}
          onFileInVault={onFileInVault}
          onPrint={onPrint}
          onEdit={onEdit}
        />
      </div>
      <DocumentCanvas
        compiled={doc.build_main_js}
        contentMd={doc.content_md}
        zoomPct={zoomPct}
      />
      <div className="no-print">
        <TrustFooter
          filename={filename}
          originDomain={doc.manifest.origin_domain}
          verifyResult={verifyResult}
        />
      </div>
    </div>
  );
}
