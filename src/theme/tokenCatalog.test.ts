import { describe, it, expect } from "vitest";
import { TOKEN_CATALOG, getDefaults } from "./tokenCatalog";

describe("tokenCatalog", () => {
  it("every entry has name, group, type, default", () => {
    for (const t of TOKEN_CATALOG) {
      expect(t.name.startsWith("--")).toBe(true);
      expect(["color", "number", "string", "font"]).toContain(t.type);
      expect(["Color", "Type", "Spacing & shape"]).toContain(t.group);
      expect(typeof t.default).toBe("string");
      expect(t.default.length).toBeGreaterThan(0);
    }
  });

  it("getDefaults returns a name→value map matching every entry", () => {
    const d = getDefaults();
    for (const t of TOKEN_CATALOG) {
      expect(d[t.name]).toBe(t.default);
    }
  });

  it("includes the core tokens (--accent, --bg, --text)", () => {
    const names = TOKEN_CATALOG.map((t) => t.name);
    expect(names).toContain("--accent");
    expect(names).toContain("--bg");
    expect(names).toContain("--text");
  });
});
