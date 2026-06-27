import { describe, it, expect } from "vitest";
import { computeStats } from "./docStats";

describe("computeStats", () => {
  it("counts words and characters", () => {
    const s = computeStats("hello world foo");
    expect(s.words).toBe(3);
    expect(s.characters).toBe(15);
  });

  it("returns zeros for empty/whitespace text", () => {
    expect(computeStats("")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
    expect(computeStats("   \n  ")).toEqual({ words: 0, characters: 0, readingMinutes: 0 });
  });

  it("collapses runs of whitespace when counting words", () => {
    expect(computeStats("a\t\n b\n\n  c").words).toBe(3);
  });

  it("computes reading time at 200 wpm, min 1 when nonzero", () => {
    expect(computeStats("one two").readingMinutes).toBe(1);
    expect(computeStats(Array(201).fill("word").join(" ")).readingMinutes).toBe(2);
  });

  it("counts characters including spaces", () => {
    expect(computeStats("a b").characters).toBe(3);
  });
});
