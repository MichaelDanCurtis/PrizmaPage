import { useState } from "react";
import { listComponents } from "../registry/ComponentRegistry";

interface Props {
  onSelect: (insertTemplate: string) => void;
}

const PROSE_ITEMS = [
  { label: "Heading 2", icon: "H₂", template: "## " },
  { label: "Heading 3", icon: "H₃", template: "### " },
  { label: "Bulleted list", icon: "•", template: "- " },
  { label: "Numbered list", icon: "1.", template: "1. " },
  { label: "Quote", icon: '"', template: "> " },
  { label: "Inline code", icon: "</>", template: "`code`" },
  { label: "Divider", icon: "⎌", template: "<Divider />" },
];

export function InsertButton({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const components = listComponents().filter((c) => c.category === "component");

  const handleSelect = (template: string) => {
    onSelect(template);
    setOpen(false);
  };

  const row = (icon: string, label: string, template: string) => (
    <div
      key={label}
      onClick={() => handleSelect(template)}
      style={{
        padding: "5px 10px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        color: label.includes("AI") ? "var(--accent)" : "var(--text)",
        fontWeight: label.includes("AI") ? 500 : 400,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="+"
        style={{
          background: "var(--bg-muted)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
          padding: "4px 10px",
          borderRadius: "var(--radius)",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        +
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            padding: 6,
            width: 200,
            fontSize: 12,
            zIndex: 100,
          }}
        >
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px" }}>
            Prose blocks
          </div>
          {PROSE_ITEMS.map((p) => row(p.icon, p.label, p.template))}
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px", marginTop: 2 }}>
            Components
          </div>
          {components.map((c) => row(c.icon, c.label, c.insertTemplate()))}
          {row("✨", "AI component…", "")}
        </div>
      )}
    </div>
  );
}
