import { describe, it, expect, vi, beforeEach } from "vitest";

describe("capability bridge client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the decision from the rust core", async () => {
    const invoke = vi.fn().mockResolvedValue("Allowed");
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { checkCapability } = await import("./capability");

    const decision = await checkCapability({ kind: "Network", host: "github.com" });
    expect(invoke).toHaveBeenCalledWith("check_capability", {
      request: { kind: "Network", host: "github.com" },
    });
    expect(decision).toBe("Allowed");
  });

  it("throws if the rust core errors", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("poisoned lock"));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { checkCapability } = await import("./capability");

    await expect(checkCapability({ kind: "Storage", byte_count: 1 })).rejects.toThrow(
      "poisoned lock"
    );
  });
});
