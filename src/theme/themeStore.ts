import { DARK_OVERRIDES, HIGH_CONTRAST_OVERRIDES, getDefaults } from "./tokenCatalog";

export type ThemeMode = "light" | "dark" | "high-contrast" | "system";

const MODE_KEY = "prizma.theme.mode";
const ACCENT_KEY = "prizma.theme.accent";
const TOKENS_KEY = "prizma.theme.tokens";

/// Blend two hex colors. weight 0 → a, 1 → b.
export function mixHex(a: string, b: string, weight: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * weight);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * weight);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * weight);
  return "#" + [r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/// accent at ~0.1 opacity over the current bg.
export function deriveAccentSoft(accent: string, bg: string): string {
  return mixHex(bg, accent, 0.1);
}
/// accent at ~0.3 opacity over the current bg.
export function deriveAccentBorder(accent: string, bg: string): string {
  return mixHex(bg, accent, 0.3);
}

/// Apply a partial token map to :root as inline CSS variables.
export function applyTokens(tokens: Record<string, string>): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
}

function clearAllTokenVars(): void {
  const root = document.documentElement;
  // Remove only the vars we own.
  for (const k of Object.keys(getDefaults())) {
    root.style.removeProperty(k);
  }
}

function effectiveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode === "dark" ? "dark" : "light";
}

/// Read localStorage and apply everything. Call once before React mounts.
export function loadTheme(): void {
  const mode = (localStorage.getItem(MODE_KEY) as ThemeMode) || "light";
  if (mode === "high-contrast") {
    document.documentElement.setAttribute("data-theme", "high-contrast");
    clearAllTokenVars();
    const tokens: Record<string, string> = { ...HIGH_CONTRAST_OVERRIDES };
    const accent = localStorage.getItem(ACCENT_KEY);
    if (accent) tokens["--accent"] = accent;
    applyTokens(tokens);
    return;
  }
  const eff = effectiveMode(mode);
  document.documentElement.setAttribute("data-theme", eff);

  // Start from defaults + dark overrides if dark.
  const tokens: Record<string, string> = {};
  if (eff === "dark") Object.assign(tokens, DARK_OVERRIDES);

  const accent = localStorage.getItem(ACCENT_KEY);
  if (accent) {
    tokens["--accent"] = accent;
    const bg = tokens["--bg"] || getDefaults()["--bg"];
    tokens["--accent-soft"] = deriveAccentSoft(accent, bg);
    tokens["--accent-border"] = deriveAccentBorder(accent, bg);
  }

  const overridesRaw = localStorage.getItem(TOKENS_KEY);
  if (overridesRaw) {
    try {
      Object.assign(tokens, JSON.parse(overridesRaw));
    } catch {
      /* ignore corrupt overrides */
    }
  }

  clearAllTokenVars();
  applyTokens(tokens);
}

export function setMode(mode: ThemeMode): void {
  localStorage.setItem(MODE_KEY, mode);
  loadTheme();
}

export function setAccent(hex: string | null): void {
  if (hex) localStorage.setItem(ACCENT_KEY, hex);
  else localStorage.removeItem(ACCENT_KEY);
  loadTheme();
}

export function setTokenOverrides(overrides: Record<string, string>): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(overrides));
  loadTheme();
}

export function resetAllTokens(): void {
  localStorage.removeItem(ACCENT_KEY);
  localStorage.removeItem(TOKENS_KEY);
  loadTheme();
}

export function getMode(): ThemeMode {
  return (localStorage.getItem(MODE_KEY) as ThemeMode) || "light";
}
export function getAccent(): string | null {
  return localStorage.getItem(ACCENT_KEY);
}
export function getTokenOverrides(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  } catch {
    return {};
  }
}

/// React to OS theme changes when in system mode.
export function watchSystemMode(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getMode() === "system") {
      loadTheme();
      cb();
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
