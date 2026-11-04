import { describe, it, expect, beforeEach } from "vitest";
import { writeDraft, readDraft, clearDraft } from "./draftStore";

beforeEach(() => localStorage.clear());

describe("draftStore", () => {
  it("round-trips a draft", () => {
    writeDraft("/x/note.mdxz", "# hi", 1000);
    expect(readDraft("/x/note.mdxz")).toEqual({ contentMd: "# hi", ts: 1000 });
  });

  it("returns null when no draft", () => {
    expect(readDraft("/x/none.mdxz")).toBeNull();
  });

  it("clearDraft removes it", () => {
    writeDraft("/x/n.mdxz", "a", 1);
    clearDraft("/x/n.mdxz");
    expect(readDraft("/x/n.mdxz")).toBeNull();
  });

  it("ignores corrupt drafts", () => {
    localStorage.setItem("prizma.draft./x/bad.mdxz", "{not json");
    expect(readDraft("/x/bad.mdxz")).toBeNull();
  });
});
