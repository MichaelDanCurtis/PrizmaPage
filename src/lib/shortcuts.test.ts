import { describe, it, expect } from "vitest";
import { SHORTCUTS } from "./shortcuts";

describe("shortcuts", () => {
  it("every entry has a group, keys, and description", () => {
    for (const s of SHORTCUTS) {
      expect(s.group.length).toBeGreaterThan(0);
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });
  it("includes the core ones", () => {
    const all = SHORTCUTS.map(s => s.keys).join(" ");
    expect(all).toMatch(/Cmd\+S/i);        // save
    expect(all).toMatch(/Cmd\+F/i);        // find
    expect(/Cmd\+\//.test(all)).toBe(true); // shortcuts help
    expect(all).toMatch(/Cmd\+Shift\+O/i); // outline jump
  });
});
