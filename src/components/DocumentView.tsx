import { useState } from "react";
import type { OpenedDocument } from "../lib/package";
import { useHoverControls } from "../hooks/useHoverControls";
import { DocumentCanvas } from "./DocumentCanvas";
import { HoverControls } from "./HoverControls";
import { TrustFooter } from "./TrustFooter";

interface Props {
  document: OpenedDocument;
  filename: string;
  onEdit: () => void;
  onShare: () => void;
}

export function DocumentView({ document: doc, filename, onEdit, onShare }: Props) {
  const { visible, onEnter, onLeave } = useHoverControls();
  const [zoomPct, setZoomPct] = useState(100);

  const zoomIn = () => setZoomPct((z) => Math.min(200, z + 10));
  const zoomOut = () => setZoomPct((z) => Math.max(50, z - 10));

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
          onEdit={onEdit}
        />
      </div>
      <DocumentCanvas
        compiled={doc.build_main_js}
        contentMd={doc.content_md}
        zoomPct={zoomPct}
      />
      <TrustFooter
        filename={filename}
        signatureDomain={doc.manifest.origin_domain}
      />
    </div>
  );
}
