import { describe, it, expect } from "vitest";
import { isUrl, isLikelyMarkdown, classifyPaste } from "./smartPaste";

describe("smartPaste", () => {
  it("isUrl detects URLs", () => {
    expect(isUrl("https://example.com")).toBe(true);
    expect(isUrl("http://foo.bar/baz")).toBe(true);
    expect(isUrl("not a url")).toBe(false);
    expect(isUrl("see below")).toBe(false);
  });

  it("isLikelyMarkdown detects markdown signals", () => {
    expect(isLikelyMarkdown("# heading")).toBe(true);
    expect(isLikelyMarkdown("- item\n- item2")).toBe(true);
    expect(isLikelyMarkdown("1. ordered")).toBe(true);
    expect(isLikelyMarkdown("**bold**")).toBe(true);
    expect(isLikelyMarkdown("`code`")).toBe(true);
    expect(isLikelyMarkdown("[link](http://x)")).toBe(true);
    expect(isLikelyMarkdown("just a plain sentence.")).toBe(false);
  });

  it("caps markdown conversion at 4KB", () => {
    const big = "# h\n" + "x".repeat(5000);
    expect(isLikelyMarkdown(big)).toBe(false); // over cap → treated as plain
  });

  it("classifies URL-over-selection as link", () => {
    expect(classifyPaste({ text: "https://x.com", html: null, hasSelection: true })).toBe("link");
  });

  it("classifies markdown plain-text as markdown", () => {
    expect(classifyPaste({ text: "# hi\n- a", html: null, hasSelection: false })).toBe("markdown");
  });

  it("classifies HTML as html (defer to TipTap)", () => {
    expect(classifyPaste({ text: "x", html: "<p>x</p>", hasSelection: false })).toBe("html");
  });

  it("classifies plain text as plain", () => {
    expect(classifyPaste({ text: "hello there", html: null, hasSelection: false })).toBe("plain");
  });
});
