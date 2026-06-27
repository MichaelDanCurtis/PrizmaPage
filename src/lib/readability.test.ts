import { describe, it, expect } from "vitest";
import { computeReadability } from "./readability";

describe("computeReadability", () => {
  it("counts sentences", () => {
    const r = computeReadability("One sentence. Two sentences! Three?");
    expect(r.sentences).toBe(3);
  });

  it("computes average word length", () => {
    const r = computeReadability("aa bb cc");
    expect(r.avgWordLength).toBeCloseTo(2, 1);
  });

  it("computes a Flesch reading ease score (0-100 range for normal prose)", () => {
    const r = computeReadability("The cat sat on the mat. It was a sunny day and the birds sang.");
    expect(r.fleschScore).toBeGreaterThanOrEqual(0);
    expect(r.fleschScore).toBeLessThanOrEqual(121);
  });

  it("returns top frequent words (lowercased, stopwords excluded)", () => {
    const r = computeReadability("rust rust rust code code the the the the");
    // "the" is a stopword; rust should dominate.
    expect(r.topWords[0].word).toBe("rust");
    expect(r.topWords[0].count).toBe(3);
  });

  it("handles empty text", () => {
    const r = computeReadability("");
    expect(r.sentences).toBe(0);
    expect(r.avgWordLength).toBe(0);
    expect(r.topWords).toEqual([]);
  });
});
