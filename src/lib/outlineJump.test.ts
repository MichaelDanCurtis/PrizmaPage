import { describe, it, expect } from "vitest";
import { filterHeadings, type Heading } from "./outlineJump";

const hs: Heading[] = [
  { level: 1, text: "Intro", pos: 1 },
  { level: 2, text: "Setup", pos: 50 },
  { level: 2, text: "Usage", pos: 100 },
  { level: 1, text: "Conclusion", pos: 200 },
];

describe("filterHeadings", () => {
  it("returns all for empty query", () => {
    expect(filterHeadings(hs, "").length).toBe(4);
  });
  it("case-insensitive substring match", () => {
    expect(filterHeadings(hs, "usage").map((h) => h.text)).toEqual(["Usage"]);
  });
  it("matches multiple (Setup, Usage, Conclusion all contain 's' or 'u'...)", () => {
    // 'u' matches Setup, Usage, Conclusion → 3
    expect(filterHeadings(hs, "u").length).toBe(3);
  });
  it("returns empty for no match", () => {
    expect(filterHeadings(hs, "zzz")).toEqual([]);
  });
});
