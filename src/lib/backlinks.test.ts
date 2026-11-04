import { describe, it, expect } from "vitest";
import { extractWikilinks } from "./backlinks";

describe("backlinks", () => {
  it("extracts a single wikilink", () => {
    expect(extractWikilinks("See [[Roadmap]] for details.")).toEqual(["Roadmap"]);
  });

  it("extracts multiple wikilinks", () => {
    expect(extractWikilinks("[[Alpha]] and [[Beta]]")).toEqual(["Alpha", "Beta"]);
  });

  it("ignores regular markdown links [text](url)", () => {
    expect(extractWikilinks("A [link](https://example.com) here.")).toEqual([]);
  });

  it("treats ![[image]] embeds as wikilink targets (Obsidian-style embeds)", () => {
    // ![[X]] is an Obsidian image embed; we extract X as a target. This is
    // acceptable for v1 — backlinks to an "image" note are harmless, and a
    // future image-embed feature can special-case these.
    expect(extractWikilinks("![[image.png]]")).toEqual(["image.png"]);
  });

  it("handles no wikilinks", () => {
    expect(extractWikilinks("just plain text")).toEqual([]);
  });

  it("handles empty string", () => {
    expect(extractWikilinks("")).toEqual([]);
  });
});
