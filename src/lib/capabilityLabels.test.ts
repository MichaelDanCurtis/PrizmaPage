import { describe, it, expect } from "vitest";
import { capabilityRows } from "./capabilityLabels";
import type { Capability } from "./capability";

describe("capabilityLabels", () => {
  it("builds a network row with the scopes in the detail", () => {
    const rows = capabilityRows([{ category: "network", scopes: ["api.example.com", "cdn.example.com"] }]);
    expect(rows[0].icon).toBe("🌐");
    expect(rows[0].title).toBe("Network access");
    expect(rows[0].detail).toContain("api.example.com");
    expect(rows[0].detail).toContain("cdn.example.com");
    expect(rows[0].defaultAllow).toBe(false);
  });

  it("builds a storage row with a human-readable limit", () => {
    const rows = capabilityRows([{ category: "storage", limit_bytes: 5 * 1024 * 1024 }]);
    expect(rows[0].title).toBe("Local storage");
    expect(rows[0].detail).toContain("MB");
    expect(rows[0].defaultAllow).toBe(true);
  });

  it("builds a clipboard row", () => {
    const rows = capabilityRows([{ category: "clipboard" }]);
    expect(rows[0].title).toBe("Clipboard");
    expect(rows[0].defaultAllow).toBe(true);
  });

  it("builds an mcp row with the servers", () => {
    const rows = capabilityRows([{ category: "mcp", servers: ["localhost:3000"] }]);
    expect(rows[0].title).toBe("MCP servers");
    expect(rows[0].detail).toContain("localhost:3000");
    expect(rows[0].defaultAllow).toBe(false);
  });

  it("builds an ai row with the providers", () => {
    const rows = capabilityRows([{ category: "ai", providers: ["openai"] }]);
    expect(rows[0].title).toBe("AI providers");
    expect(rows[0].detail).toContain("openai");
    expect(rows[0].defaultAllow).toBe(false);
  });
});
