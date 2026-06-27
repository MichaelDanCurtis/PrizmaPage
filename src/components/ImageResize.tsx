import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useRef } from "react";

/// An Image extension with a persisted `width` attr and a corner-drag resize
/// handle. The width round-trips through the editor JSON (it is NOT emitted to
/// the MDX text `![alt](src)` in v1 — editor-only; documented scope).
function ImageView({ node, updateAttributes }: any) {
  const { src, alt, width } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = imgRef.current?.offsetWidth ?? width ?? 300;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(40, Math.round(startW + (ev.clientX - startX)));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <NodeViewWrapper style={{ display: "inline-block", position: "relative", maxWidth: "100%" }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{ width: width ? `${width}px` : "auto", maxWidth: "100%", display: "block" }}
      />
      <span
        onMouseDown={startResize}
        title="Drag to resize"
        style={{
          position: "absolute",
          right: -6,
          bottom: -6,
          width: 14,
          height: 14,
          background: "var(--accent)",
          border: "2px solid var(--bg)",
          borderRadius: "50%",
          cursor: "nwse-resize",
        }}
      />
    </NodeViewWrapper>
  );
}

export const ImageResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attrs: any) => (attrs.width ? { style: `width: ${attrs.width}px` } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
