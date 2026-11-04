import { describe, it, expect } from "vitest";
import { slugify } from "./anchorLinks";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("strips non-word chars", () => {
    expect(slugify("A, B & C!")).toBe("a-b-c");
  });
  it("collapses whitespace", () => {
    expect(slugify("  multiple   spaces  ")).toBe("multiple-spaces");
  });
  it("handles empty", () => {
    expect(slugify("")).toBe("");
  });
});
