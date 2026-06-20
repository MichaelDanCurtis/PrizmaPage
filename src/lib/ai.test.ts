import { describe, it, expect, vi, beforeEach } from "vitest";

describe("ai client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("lists providers from the rust core", async () => {
    const invoke = vi.fn().mockResolvedValue(["openai", "ollama"]);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { listProviders } = await import("./ai");
    expect(await listProviders()).toEqual(["openai", "ollama"]);
    expect(invoke).toHaveBeenCalledWith("ai_list_providers");
  });

  it("stores an api key via the bridge", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { setApiKey } = await import("./ai");
    await setApiKey("openai", "sk-test");
    expect(invoke).toHaveBeenCalledWith("ai_set_api_key", {
      provider: "openai",
      apiKey: "sk-test",
    });
  });

  it("reports whether a key is set without revealing it", async () => {
    const invoke = vi.fn().mockResolvedValue(true);
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { hasApiKey } = await import("./ai");
    expect(await hasApiKey("openai")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("ai_has_api_key", { provider: "openai" });
  });

  it("completes a prompt and returns the text", async () => {
    const invoke = vi.fn().mockResolvedValue({ text: "Hello back!" });
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { complete } = await import("./ai");
    const resp = await complete({
      provider: "openai",
      model: "gpt-test",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(resp.text).toBe("Hello back!");
    expect(invoke).toHaveBeenCalledWith("ai_complete", {
      provider: "openai",
      model: "gpt-test",
      messages: [["user", "Hello"]],
    });
  });
});
