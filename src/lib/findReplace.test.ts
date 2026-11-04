import { describe, it, expect } from "vitest";
import { findAll } from "./findReplace";

describe("findAll", () => {
  it("finds all non-overlapping substring matches", () => {
    expect(findAll("foo bar foo", "foo", {})).toEqual([{ from: 0, to: 3 }, { from: 8, to: 11 }]);
  });

  it("returns empty for no matches", () => {
    expect(findAll("hello", "xyz", {})).toEqual([]);
  });

  it("is case-insensitive by default", () => {
    expect(findAll("Foo foo FOO", "foo", {}).length).toBe(3);
  });

  it("respects caseSensitive option", () => {
    expect(findAll("Foo foo FOO", "foo", { caseSensitive: true })).toEqual([{ from: 4, to: 7 }]);
  });

  it("respects wholeWord option", () => {
    expect(findAll("foo foobar foo", "foo", { wholeWord: true })).toEqual([{ from: 0, to: 3 }, { from: 11, to: 14 }]);
  });

  it("returns empty for empty query", () => {
    expect(findAll("anything", "", {})).toEqual([]);
  });
});
