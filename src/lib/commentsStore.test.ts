import { describe, it, expect, beforeEach } from "vitest";
import { addComment, listComments, resolveComment, clearComments, type Comment } from "./commentsStore";

beforeEach(() => localStorage.clear());

describe("commentsStore", () => {
  it("adds and lists comments per doc path", () => {
    addComment("/a.mdxz", { anchor: "selected text", body: "fix this" });
    addComment("/b.mdxz", { anchor: "x", body: "other" });
    const a = listComments("/a.mdxz");
    expect(a.length).toBe(1);
    expect(a[0].body).toBe("fix this");
    expect(a[0].resolved).toBe(false);
  });

  it("assigns unique ids + timestamps", () => {
    addComment("/a.mdxz", { anchor: "x", body: "1" });
    addComment("/a.mdxz", { anchor: "y", body: "2" });
    const list = listComments("/a.mdxz");
    expect(list[0].id).not.toBe(list[1].id);
    expect(typeof list[0].ts).toBe("number");
  });

  it("resolves a comment by id", () => {
    addComment("/a.mdxz", { anchor: "x", body: "1" });
    const id = listComments("/a.mdxz")[0].id;
    resolveComment("/a.mdxz", id);
    expect(listComments("/a.mdxz")[0].resolved).toBe(true);
  });

  it("clears all comments for a doc", () => {
    addComment("/a.mdxz", { anchor: "x", body: "1" });
    clearComments("/a.mdxz");
    expect(listComments("/a.mdxz")).toEqual([]);
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("prizma.comments./a.mdxz", "{not json");
    expect(listComments("/a.mdxz")).toEqual([]);
  });
});
