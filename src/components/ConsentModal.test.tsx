import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConsentModal } from "./ConsentModal";
import type { Manifest } from "../lib/package";

const manifest = (caps: Manifest["capabilities"]): Manifest => ({
  version: "0.1.0",
  origin_domain: "example.com",
  capabilities: caps,
  signature: null,
});

describe("ConsentModal", () => {
  it("renders a row per declared capability with the origin", () => {
    render(
      <ConsentModal
        manifest={manifest([
          { category: "network", scopes: ["api.example.com"] },
          { category: "ai", providers: ["openai"] },
        ])}
        filename="doc.mdxz"
        onGrant={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/From/i).textContent).toContain("example.com");
    expect(screen.getByText("Network access")).toBeInTheDocument();
    expect(screen.getByText("AI providers")).toBeInTheDocument();
  });

  it("network/AI default to Deny, storage/clipboard default to Allow", () => {
    render(
      <ConsentModal
        manifest={manifest([
          { category: "network", scopes: ["api.example.com"] },
          { category: "clipboard" },
        ])}
        filename="doc.mdxz"
        onGrant={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Each row has an Allow/Deny button. Find by text.
    const buttons = screen.getAllByRole("button", { name: /^(Allow|Deny)$/ });
    // network → Deny (default), clipboard → Allow (default)
    expect(buttons.some((b) => b.textContent === "Deny")).toBe(true);
    expect(buttons.some((b) => b.textContent === "Allow")).toBe(true);
  });

  it("Open calls onGrant with only allowed capabilities", () => {
    const onGrant = vi.fn();
    render(
      <ConsentModal
        manifest={manifest([
          { category: "network", scopes: ["api.example.com"] },
          { category: "clipboard" },
        ])}
        filename="doc.mdxz"
        onGrant={onGrant}
        onCancel={vi.fn()}
      />
    );
    // Defaults: network denied, clipboard allowed → grant list = [clipboard]
    fireEvent.click(screen.getByText("Open"));
    expect(onGrant).toHaveBeenCalledOnce();
    const granted = onGrant.mock.calls[0][0];
    expect(granted).toHaveLength(1);
    expect(granted[0].category).toBe("clipboard");
  });

  it("Cancel calls onCancel with nothing granted", () => {
    const onCancel = vi.fn();
    const onGrant = vi.fn();
    render(
      <ConsentModal
        manifest={manifest([{ category: "clipboard" }])}
        filename="doc.mdxz"
        onGrant={onGrant}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onGrant).not.toHaveBeenCalled();
  });

  it("toggling a row flips its allow state", () => {
    const onGrant = vi.fn();
    render(
      <ConsentModal
        manifest={manifest([{ category: "network", scopes: ["api.example.com"] }])}
        filename="doc.mdxz"
        onGrant={onGrant}
        onCancel={vi.fn()}
      />
    );
    // Network defaults to Deny. Click the Deny button to flip to Allow.
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    // Now it should say Allow.
    expect(screen.getByRole("button", { name: "Allow" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Open"));
    expect(onGrant.mock.calls[0][0]).toHaveLength(1);
  });
});
