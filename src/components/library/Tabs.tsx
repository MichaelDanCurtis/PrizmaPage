import { useState } from "react";
import type { FC } from "react";
import type { ComponentProps } from "../../registry/ComponentRegistry";

/// A simple interactive tabs component.
///
/// `tabs` is a JSON string of `[{ label, body }]`. Each tab's body is plain
/// text shown when its label is clicked. (Rich children would require a richer
/// node model; plain text is enough for the starter library.)
interface TabItem {
  label: string;
  body: string;
}

interface TabsProps extends ComponentProps {
  tabs?: string; // JSON: [{label, body}]
}

function parseTabs(tabs: string | undefined): TabItem[] {
  if (!tabs) return [{ label: "Tab 1", body: "First tab content." }, { label: "Tab 2", body: "Second tab content." }];
  try {
    const parsed = JSON.parse(tabs);
    if (Array.isArray(parsed) && parsed.every((t) => "label" in t && "body" in t)) {
      return parsed as TabItem[];
    }
  } catch {
    /* fall through */
  }
  return [{ label: "Tab 1", body: "First tab content." }, { label: "Tab 2", body: "Second tab content." }];
}

export const Tabs: FC<TabsProps> = ({ tabs }) => {
  const items = parseTabs(tabs);
  const [active, setActive] = useState(0);
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        margin: "12px 0",
      }}
    >
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}>
        {items.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: active === i ? "2px solid var(--accent)" : "2px solid transparent",
              color: active === i ? "var(--accent)" : "var(--text-muted)",
              padding: "8px 16px",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: active === i ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "12px 16px", color: "var(--text)", font: "var(--font-body)", fontSize: 14, lineHeight: 1.6 }}>
        {items[active]?.body}
      </div>
    </div>
  );
};
