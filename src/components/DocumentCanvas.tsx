import { useEffect, useState } from "react";
import { runMdxModule, type MDXComponent } from "../lib/runner";
import { compileMdx } from "../lib/compile";

interface Props {
  compiled: string | null;
  contentMd?: string;
  zoomPct: number;
}

/// The viewer never shows raw markdown as <pre> text. If a precompiled
/// build (layer 2) is present we run it; otherwise we compile the prose
/// (layer 1) on the fly so every document renders as proper HTML.
export function DocumentCanvas({ compiled, contentMd, zoomPct }: Props) {
  const [Component, setComponent] = useState<MDXComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer the stored build; fall back to compiling layer 1 live.
        const build = compiled ?? (contentMd ? await compileMdx(contentMd) : null);
        const C = await runMdxModule(build);
        if (!cancelled) {
          setComponent(() => C);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compiled, contentMd]);

  return (
    <div
      className="prose"
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        zoom: `${zoomPct}%`,
      }}
    >
      {error ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            font: "var(--font-mono)",
            margin: 0,
            color: "#b91c1c",
            background: "#fef2f2",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </pre>
      ) : Component ? (
        <Component />
      ) : null}
    </div>
  );
}
