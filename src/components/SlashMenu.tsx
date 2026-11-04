import { listComponents } from "../registry/ComponentRegistry";

interface Props {
  query: string;
  onSelect: (insertTemplate: string) => void;
  onClose: () => void;
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

const AI_ITEM = { label: "AI component…", icon: "✨", template: "" };

export function SlashMenu({ query, onSelect, onClose }: Props) {
  const q = query.toLowerCase();
  const components = listComponents().filter((c) => c.category === "component");
  const proseMatches = PROSE_ITEMS.filter((p) => p.label.toLowerCase().includes(q));
  const componentMatches = components.filter((c) => c.label.toLowerCase().includes(q));
  const aiMatches = q === "" || AI_ITEM.label.toLowerCase().includes(q) ? [AI_ITEM] : [];

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const row = (icon: string, label: string, template: string) => (
    <div
      role="option"
      key={label}
      onClick={() => onSelect(template)}
      style={{
        padding: "5px 10px",
        cursor: "pointer",
        borderRadius: "var(--radius-sm)",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        color: label.includes("AI") ? "var(--accent)" : "var(--text)",
        fontWeight: label.includes("AI") ? 500 : 400,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleKey}
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
        padding: 6,
        width: 220,
        fontSize: 12,
        fontFamily: "var(--font-sans)",
      }}
    >
      {proseMatches.length > 0 && (
        <>
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px" }}>
            Prose blocks
          </div>
          {proseMatches.map((p) => row(p.icon, p.label, p.template))}
        </>
      )}
      {componentMatches.length > 0 && (
        <>
          <div style={{ color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, padding: "4px 8px 2px", marginTop: 2 }}>
            Components
          </div>
          {componentMatches.map((c) => row(c.icon, c.label, c.insertTemplate()))}
        </>
      )}
      {aiMatches.map((a) => row(a.icon, a.label, a.template))}
    </div>
  );
}
