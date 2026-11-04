/// The editable surface of the theme. The Settings token editor is generated
/// from this list — there is no second hard-coded list. Defaults MUST match
/// the values in tokens.css (the test suite does not cross-check, so keep them
/// in sync manually; a future task can parse tokens.css at build time).

export type TokenType = "color" | "number" | "string" | "font";
export type TokenGroup = "Color" | "Type" | "Spacing & shape";

export interface TokenEntry {
  name: string; // "--accent"
  label: string; // "Accent"
  group: TokenGroup;
  type: TokenType;
  default: string;
}

export const TOKEN_CATALOG: TokenEntry[] = [
  // Color
  { name: "--accent", label: "Accent", group: "Color", type: "color", default: "#4f46e5" },
  { name: "--accent-soft", label: "Accent soft", group: "Color", type: "color", default: "#eef2ff" },
  { name: "--accent-border", label: "Accent border", group: "Color", type: "color", default: "#c7d2fe" },
  { name: "--bg", label: "Background", group: "Color", type: "color", default: "#ffffff" },
  { name: "--bg-muted", label: "Background muted", group: "Color", type: "color", default: "#fafafa" },
  { name: "--text", label: "Text", group: "Color", type: "color", default: "#0f172a" },
  { name: "--text-muted", label: "Text muted", group: "Color", type: "color", default: "#64748b" },
  { name: "--text-faint", label: "Text faint", group: "Color", type: "color", default: "#94a3b8" },
  { name: "--border", label: "Border", group: "Color", type: "color", default: "#e5e7eb" },
  { name: "--border-soft", label: "Border soft", group: "Color", type: "color", default: "#f1f5f9" },
  // Type
  { name: "--font-sans", label: "Sans font", group: "Type", type: "font", default: '-apple-system, "Inter", system-ui, sans-serif' },
  { name: "--font-mono", label: "Mono font", group: "Type", type: "font", default: '"SF Mono", "JetBrains Mono", monospace' },
  { name: "--font-display", label: "Display", group: "Type", type: "string", default: "700 26px/1.2 var(--font-sans)" },
  { name: "--font-h2", label: "Heading 2", group: "Type", type: "string", default: "600 18px/1.3 var(--font-sans)" },
  { name: "--font-body", label: "Body", group: "Type", type: "string", default: "400 16px/1.7 var(--font-sans)" },
  { name: "--font-small", label: "Small", group: "Type", type: "string", default: "400 13px/1.5 var(--font-sans)" },
  // Spacing & shape
  { name: "--radius-sm", label: "Radius sm", group: "Spacing & shape", type: "number", default: "4" },
  { name: "--radius", label: "Radius", group: "Spacing & shape", type: "number", default: "7" },
  { name: "--radius-lg", label: "Radius lg", group: "Spacing & shape", type: "number", default: "8" },
  { name: "--radius-xl", label: "Radius xl", group: "Spacing & shape", type: "number", default: "14" },
  { name: "--content-width", label: "Content width", group: "Spacing & shape", type: "number", default: "680" },
  { name: "--content-padding", label: "Content padding", group: "Spacing & shape", type: "number", default: "32" },
];

/// Dark-mode overrides for color tokens. Type/spacing tokens are shared.
export const DARK_OVERRIDES: Record<string, string> = {
  "--accent-soft": "#1e1b4b",
  "--accent-border": "#3730a3",
  "--bg": "#0d1117",
  "--bg-muted": "#161b22",
  "--text": "#e6edf3",
  "--text-muted": "#8b949e",
  "--text-faint": "#6e7681",
  "--border": "#30363d",
  "--border-soft": "#21262d",
};

/// High-contrast accessibility overrides: black/white, thick borders, vivid accent.
export const HIGH_CONTRAST_OVERRIDES: Record<string, string> = {
  "--accent-soft": "#000000",
  "--accent-border": "#000000",
  "--bg": "#ffffff",
  "--bg-muted": "#f0f0f0",
  "--text": "#000000",
  "--text-muted": "#000000",
  "--text-faint": "#333333",
  "--border": "#000000",
  "--border-soft": "#000000",
};

export function getDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of TOKEN_CATALOG) out[t.name] = t.default;
  return out;
}
