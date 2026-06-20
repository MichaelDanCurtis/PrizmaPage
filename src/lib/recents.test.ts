import { describe, it, expect, vi, beforeEach } from "vitest";

describe("recents client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists recent documents via the bridge", async () => {
    const invoke = vi.fn().mockResolvedValue([
      { path: "/abs/q4.mdxz", name: "q4", opened_at: 1781983000 },
    ]);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { listRecents } = await import("./recents");
    const r = await listRecents();
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe("q4");
    expect(invoke).toHaveBeenCalledWith("recent_documents");
  });

  it("adds a recent after a successful open", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { addRecent } = await import("./recents");
    await addRecent("/abs/q4.mdxz");
    expect(invoke).toHaveBeenCalledWith("add_recent_document", { path: "/abs/q4.mdxz" });
  });

  it("shares (copies) a document path via clipboard", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { shareDocumentPath } = await import("./recents");
    await shareDocumentPath("/abs/q4.mdxz");
    expect(invoke).toHaveBeenCalledWith("share_document_path", { path: "/abs/q4.mdxz" });
  });
});
