import { useEffect, useState } from "react";
import { runMdxModule, type MDXComponent } from "../lib/runner";

interface Props {
  compiled: string | null;
  contentMd?: string;
  zoomPct: number;
}

export function DocumentCanvas({ compiled, contentMd, zoomPct }: Props) {
  const [Component, setComponent] = useState<MDXComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const C = await runMdxModule(compiled);
      if (!cancelled) setComponent(() => C);
    })();
    return () => {
      cancelled = true;
    };
  }, [compiled]);

  return (
    <div
      style={{
        maxWidth: "var(--content-width)",
        margin: "0 auto",
        padding: "var(--content-padding)",
        color: "var(--text)",
        font: "var(--font-body)",
        zoom: `${zoomPct}%`,
      }}
    >
      {Component ? (
        <Component />
      ) : (
        // Prose-only fallback: render the markdown text as preformatted.
        <pre style={{ whiteSpace: "pre-wrap", font: "var(--font-body)", margin: 0 }}>
          {contentMd ?? ""}
        </pre>
      )}
    </div>
  );
}
