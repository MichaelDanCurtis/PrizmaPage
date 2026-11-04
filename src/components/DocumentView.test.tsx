import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentView } from "./DocumentView";
import type { OpenedDocument } from "../lib/package";

// Mock signingVerify so the viewer test doesn't hit the Tauri bridge.
vi.mock("../lib/signing", () => ({
  signingVerify: () => Promise.resolve({ state: "unsigned" }),
}));

const doc: OpenedDocument = {
  manifest: {
    version: "0.1.0",
    origin_domain: "acme.com",
    capabilities: [],
    signature: "sig-abc",
  },
  content_md: "# Hello",
  build_main_js: null,
};

describe("DocumentView", () => {
  it("renders the document canvas + trust footer", async () => {
    render(
      <DocumentView
        document={doc}
        filename="hello.mdxz"
        path="/mock/hello.mdxz"
        onEdit={vi.fn()}
        onShare={vi.fn()} onSaveCopy={vi.fn()} onCopyPath={vi.fn()} onFileInVault={vi.fn()} onPrint={vi.fn()}
      />
    );
    // Prose is now compiled and rendered, so "# Hello" becomes an <h1>.
    await waitFor(() => expect(screen.getByText("Hello").tagName).toBe("H1"));
    expect(screen.getByText(/hello\.mdxz/)).toBeInTheDocument();
  });

  it("shows hover controls when the top zone is entered", () => {
    render(
      <DocumentView document={doc} filename="hello.mdxz" path="/mock/hello.mdxz" onEdit={vi.fn()} onShare={vi.fn()} onSaveCopy={vi.fn()} onCopyPath={vi.fn()} onFileInVault={vi.fn()} onPrint={vi.fn()} />
    );
    // Hover controls not present initially.
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    // Simulate entering the top hover zone.
    fireEvent.mouseEnter(screen.getByTestId("hover-zone"));
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
