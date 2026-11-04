import type { FC, ReactNode } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

interface QuoteProps extends ComponentProps {
  author?: string;
  children?: ReactNode;
}

/// A pull-quote — a large, emphasized quote with an attribution line.
/// Distinct from a markdown blockquote (which is a prose construct).
export const Quote: FC<QuoteProps> = ({ author = "", children }) => (
  <blockquote
    style={{
      borderLeft: "4px solid var(--accent)",
      margin: "16px 0",
      padding: "4px 0 4px 20px",
      color: "var(--text)",
      fontSize: 18,
      lineHeight: 1.5,
      fontStyle: "italic",
      font: "var(--font-body)",
    }}
  >
    {children}
    {author && (
      <footer
        style={{
          marginTop: 8,
          fontSize: 13,
          fontStyle: "normal",
          color: "var(--text-muted)",
          fontWeight: 500,
        }}
      >
        — {author}
      </footer>
    )}
  </blockquote>
);
