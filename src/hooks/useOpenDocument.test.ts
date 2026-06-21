import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

describe("useOpenDocument", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("starts in empty state with no document", async () => {
    vi.doMock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());
    expect(result.current.state).toBe("empty");
    expect(result.current.document).toBeNull();
  });

  it("transitions to document state on successful open", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    const dialogOpen = vi.fn().mockResolvedValue("/abs/hello.mdxz");
    const addRecent = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: dialogOpen }));
    vi.doMock("../lib/recents", () => ({ addRecent }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openViaPicker();
    });

    await waitFor(() => expect(result.current.state).toBe("document"));
    expect(result.current.document?.content_md).toBe("# Hello");
    expect(addRecent).toHaveBeenCalledWith("/abs/hello.mdxz");
  });

  it("rejects non-mdxz on drop", async () => {
    const invoke = vi.fn();
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openViaDrop("/abs/not-a-pdf.pdf");
    });

    expect(result.current.state).toBe("empty");
    expect(result.current.error).toMatch(/\.mdxz/);
    expect(invoke).not.toHaveBeenCalled();
  });
});

  it("transitions to editing when openEditor is called from document state", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    vi.doMock("../lib/recents", () => ({ addRecent: vi.fn().mockResolvedValue(undefined) }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openRecent("/abs/hello.mdxz");
    });
    await waitFor(() => expect(result.current.state).toBe("document"));

    act(() => result.current.openEditor());
    expect(result.current.state).toBe("editing");
  });

  it("transitions back to document state on closeEditor", async () => {
    const invoke = vi.fn().mockResolvedValue({
      manifest: { version: "0.1.0", origin_domain: null, capabilities: [], signature: null },
      content_md: "# Hello",
      build_main_js: null,
    });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    vi.doMock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
    vi.doMock("../lib/recents", () => ({ addRecent: vi.fn().mockResolvedValue(undefined) }));
    const { useOpenDocument } = await import("./useOpenDocument");
    const { result } = renderHook(() => useOpenDocument());

    await act(async () => {
      await result.current.openRecent("/abs/hello.mdxz");
    });
    act(() => result.current.openEditor());
    act(() => result.current.closeEditor());
    expect(result.current.state).toBe("document");
  });
