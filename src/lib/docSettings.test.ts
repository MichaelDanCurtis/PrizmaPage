import { describe, it, expect, beforeEach } from "vitest";
import { getDocSetting, setDocSetting, DOC_DEFAULTS, type DocSettings } from "./docSettings";

beforeEach(() => localStorage.clear());

describe("docSettings", () => {
  it("returns defaults for an unset doc", () => {
    expect(getDocSetting("/a.mdxz")).toEqual(DOC_DEFAULTS);
  });

  it("persists per-doc settings", () => {
    setDocSetting("/a.mdxz", { zoom: 150, goal: 500 });
    expect(getDocSetting("/a.mdxz")).toEqual({ zoom: 150, goal: 500 });
    // other doc unaffected
    expect(getDocSetting("/b.mdxz")).toEqual(DOC_DEFAULTS);
  });

  it("merges partial updates", () => {
    setDocSetting("/a.mdxz", { zoom: 120, goal: 0 });
    setDocSetting("/a.mdxz", { goal: 300 });
    expect(getDocSetting("/a.mdxz").zoom).toBe(120);
    expect(getDocSetting("/a.mdxz").goal).toBe(300);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("prizma.doc./a.mdxz", "{bad");
    expect(getDocSetting("/a.mdxz")).toEqual(DOC_DEFAULTS);
  });
});
