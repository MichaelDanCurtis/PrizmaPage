import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

/// Mermaid is dynamically imported so the heavy lib (≈700KB) only loads when a
/// document actually contains a Diagram. Keeps the initial bundle lean.
let mermaidReady: Promise<typeof import("mermaid").default> | null = null;
async function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict", // no HTML/clicks in diagram output
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

interface DiagramProps extends ComponentProps {
  /// The Mermaid diagram source. Passed as children text:
  ///   <Diagram>graph TD; A-->B</Diagram>
  children?: string;
}

/// A render-only Mermaid diagram component. The diagram source is plain text
/// (Mermaid's own DSL) — no arbitrary code execution. securityLevel: "strict"
/// disables any HTML/click handlers in the rendered SVG.
///
/// The component is registered with an open/close insert template so the
/// serializer stores the diagram source as children text.
export const Diagram: FC<DiagramProps> = ({ children }) => {
  const source = typeof children === "string" ? children.trim() : "";
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!source) {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;
        // Mermaid v11: parse then render to SVG.
        const id = "mmd-" + Math.random().toString(36).slice(2, 9);
        const { svg } = await mermaid.render(id, source);
        if (cancelled) return;
        if (hostRef.current) {
          hostRef.current.innerHTML = svg;
          // Make the SVG responsive.
          const svgEl = hostRef.current.querySelector("svg");
          if (svgEl) {
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
          }
        }
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  return (
    <div
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        margin: "12px 0",
        textAlign: "center",
        overflowX: "auto",
        fontFamily: "var(--font-sans)",
      }}
    >
      {loading && (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Rendering diagram…</div>
      )}
      {error && (
        <div
          style={{
            color: "#dc2626",
            fontSize: 12,
            textAlign: "left",
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
          }}
        >
          Diagram error: {error}
        </div>
      )}
      <div ref={hostRef} style={{ display: loading || error ? "none" : "block" }} />
    </div>
  );
};
