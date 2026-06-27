import { useState } from "react";
import {
  getMode,
  setMode,
  getAccent,
  setAccent,
  getTokenOverrides,
  setTokenOverrides,
  resetAllTokens,
  type ThemeMode,
} from "../theme/themeStore";
import { TokenEditor } from "./TokenEditor";

const ACCENT_PRESETS = [
  "#4f46e5", "#0ea5e9", "#059669", "#ea580c",
  "#dc2626", "#7c3aed", "#db2777", "#0d9488",
];

export function AppearanceTab() {
  const [mode, setModeState] = useState<ThemeMode>(getMode());
  const [accent, setAccentState] = useState<string | null>(getAccent());
  const [overrides, setOverridesState] = useState<Record<string, string>>(getTokenOverrides());

  const changeMode = (m: ThemeMode) => {
    setMode(m);
    setModeState(m);
  };

  const changeAccent = (hex: string | null) => {
    setAccent(hex);
    setAccentState(hex);
  };

  const changeOverride = (name: string, value: string) => {
    const next = { ...overrides, [name]: value };
    setTokenOverrides(next);
    setOverridesState(next);
  };

  const reset = () => {
    resetAllTokens();
    setAccentState(null);
    setOverridesState({});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
          Theme mode
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {(["light", "dark", "high-contrast", "system"] as ThemeMode[]).map((m) => (
            <label key={m} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--text)", cursor: "pointer", textTransform: "capitalize" }}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => changeMode(m)} aria-label={m} />
              {m}
            </label>
          ))}
        </div>
      </section>

      <section>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Accent color</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {ACCENT_PRESETS.map((hex) => (
            <button
              key={hex}
              onClick={() => changeAccent(hex)}
              aria-label={`accent ${hex}`}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: accent === hex ? "2px solid var(--text)" : "2px solid transparent",
                background: hex,
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
            Custom
            <input type="color" value={accent ?? "#4f46e5"} onChange={(e) => changeAccent(e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
          </label>
          {accent && (
            <button onClick={() => changeAccent(null)} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              reset
            </button>
          )}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>Tokens (advanced)</div>
          <button onClick={reset} style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
            Reset to defaults
          </button>
        </div>
        <TokenEditor overrides={overrides} onChange={changeOverride} />
      </section>
    </div>
  );
}
