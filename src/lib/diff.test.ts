import { describe, it, expect } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("marks identical lines as equal", () => {
    const d = diffLines("a\nb\nc", "a\nb\nc");
    expect(d.every((x) => x.type === "eq")).toBe(true);
    expect(d.length).toBe(3);
  });

  it("marks added lines", () => {
    const d = diffLines("a\nc", "a\nb\nc");
    const added = d.filter((x) => x.type === "add");
    expect(added.length).toBe(1);
    expect(added[0].text).toBe("b");
  });

  it("marks removed lines", () => {
    const d = diffLines("a\nb\nc", "a\nc");
    const removed = d.filter((x) => x.type === "del");
    expect(removed.length).toBe(1);
    expect(removed[0].text).toBe("b");
  });

  it("handles completely different content", () => {
    const d = diffLines("x\ny", "p\nq");
    expect(d.filter((x) => x.type === "del").length).toBe(2);
    expect(d.filter((x) => x.type === "add").length).toBe(2);
  });

  it("handles empty old", () => {
    const d = diffLines("", "a\nb");
    expect(d.filter((x) => x.type === "add").length).toBe(2);
  });
});
