import { useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";

/// Highlighted code editor using the "backdrop + transparent textarea" trick:
/// a `<pre>` renders the syntax-highlighted HTML, a transparent `<textarea>`
/// sits on top for editing. Both share identical metrics so the caret lines up.
///
/// `language` is a Prism language id (e.g. "jsx", "javascript"). Falls back to
/// plain text if the grammar isn't loaded.
export function highlightCode(code: string, language: string): string {
  const grammar = Prism.languages[language] ?? Prism.languages.jsx;
  if (!grammar) return escapeHtml(code);
  try {
    return Prism.highlight(code, grammar, language in Prism.languages ? language : "jsx");
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  language?: string;
  onScroll?: (scrollTop: number) => void;
  registerScrollSync?: (el: HTMLTextAreaElement | null) => void;
}

/// A self-contained highlighted editor: highlight backdrop + transparent
/// textarea, with synchronized scrolling. Used by CodePeek.
export function CodeHighlight({
  value,
  onChange,
  language = "jsx",
  registerScrollSync,
}: Props) {
  const html = useMemo(() => highlightCode(value, language), [value, language]);

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex" }}>
      {/* Highlighted backdrop */}
      <pre
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          margin: 0,
          padding: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: "1.5",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "var(--editor-text)",
          pointerEvents: "none",
          overflow: "auto",
        }}
        dangerouslySetInnerHTML={{ __html: html + "\n" }}
      />
      {/* Transparent textarea on top */}
      <textarea
        ref={registerScrollSync ?? null}
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const ta = e.currentTarget;
          const pre = ta.parentElement?.querySelector("pre");
          if (pre) pre.scrollTop = ta.scrollTop;
        }}
        style={{
          position: "absolute",
          inset: 0,
          margin: 0,
          padding: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: "1.5",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "transparent",
          color: "transparent",
          caretColor: "var(--editor-text)",
          border: "1px solid var(--editor-border)",
          borderRadius: "var(--radius-sm)",
          resize: "none",
          outline: "none",
          overflow: "auto",
        }}
      />
    </div>
  );
}
