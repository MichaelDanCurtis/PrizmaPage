import { describe, it, expect } from "vitest";
import { LANGUAGES } from "./languages";

describe("LANGUAGES", () => {
  it("includes the common languages", () => {
    expect(LANGUAGES).toContain("text");
    expect(LANGUAGES).toContain("typescript");
    expect(LANGUAGES).toContain("rust");
  });
  it("has no duplicates", () => {
    expect(new Set(LANGUAGES).size).toBe(LANGUAGES.length);
  });
  it("every entry is a non-empty lowercase string", () => {
    for (const l of LANGUAGES) {
      expect(l.length).toBeGreaterThan(0);
      expect(l).toBe(l.toLowerCase());
    }
  });
});
