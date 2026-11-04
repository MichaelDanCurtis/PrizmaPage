import { useEffect, useRef, useState } from "react";
import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";
import { renderD2 } from "../../lib/d2";

interface D2Props extends ComponentProps {
  /// The D2 diagram source as children text: <D2>x -> y</D2>
  children?: string;
}

/// A render-only D2 diagram. Renders by shelling out to the `d2` binary (via
/// the Rust bridge). If d2 is not installed, shows the source in a code block
/// with an install hint — no execution surface, ever.
export const D2: FC<D2Props> = ({ children }) => {
  const source = typeof children === "string" ? children.trim() : "";
  const hostRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!source) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    renderD2(source)
      .then((out) => {
        if (!cancelled) {
          setSvg(out);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
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
      {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Rendering D2…</div>}
      {error && (
        <div style={{ textAlign: "left" }}>
          <div style={{ color: "#b45309", fontSize: 12, marginBottom: 8 }}>{error}</div>
          <pre
            style={{
              background: "var(--editor-bg)",
              color: "var(--editor-text)",
              padding: 10,
              borderRadius: "var(--radius-sm)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {source}
          </pre>
        </div>
      )}
      <div
        ref={hostRef}
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        style={{ display: loading || error ? "none" : "block" }}
      />
    </div>
  );
};
