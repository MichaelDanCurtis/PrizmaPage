import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useOpenDocument } from "./useOpenDocument";

// Mock the bridge so importMarkdown's file-pick + read path is testable without Tauri.
const mockOpenDocument = vi.fn();
vi.mock("../lib/package", () => ({
  openDocument: (...a: any[]) => mockOpenDocument(...a),
  grantDeclaredCapabilities: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/recents", () => ({
  addRecent: vi.fn().mockResolvedValue(undefined),
  newDocument: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  mockOpenDocument.mockReset();
  localStorage.clear();
});

describe("useOpenDocument.importMarkdown", () => {
  it("opens an imported markdown file as an unsaved editing doc (path null)", async () => {
    const { result } = renderHook(() => useOpenDocument());
    // Stub the file-input dialog to immediately deliver a file.
    const fakeFile = { text: () => Promise.resolve("# Imported\n\nbody") } as unknown as File;
    const fakeInput = {
      type: "", accept: "", onchange: null as any, files: [fakeFile],
      click: function () { this.onchange?.({} as any); },
    };
    const origCreate = globalThis.document.createElement.bind(globalThis.document);
    const spy = vi.spyOn(globalThis.document, "createElement").mockImplementation((tag: string) => {
      if (tag === "input") return fakeInput as any;
      return origCreate(tag);
    });

    await act(async () => { await result.current.importMarkdown(); });

    await waitFor(() => expect(result.current.state).toBe("editing"));
    expect(result.current.document?.content_md).toBe("# Imported\n\nbody");
    expect(result.current.path).toBeNull();
    spy.mockRestore();
  });
});
