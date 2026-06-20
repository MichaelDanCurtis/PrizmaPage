import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DocumentView } from "./DocumentView";
import type { OpenedDocument } from "../lib/package";

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
  it("renders the document canvas + trust footer", () => {
    render(
      <DocumentView
        document={doc}
        filename="hello.mdxz"
        onEdit={vi.fn()}
        onShare={vi.fn()}
      />
    );
    expect(screen.getByText("# Hello")).toBeInTheDocument();
    expect(screen.getByText(/hello\.mdxz/)).toBeInTheDocument();
    expect(screen.getByText(/signed:\s+acme\.com/i)).toBeInTheDocument();
  });

  it("shows hover controls when the top zone is entered", () => {
    render(
      <DocumentView document={doc} filename="hello.mdxz" onEdit={vi.fn()} onShare={vi.fn()} />
    );
    // Hover controls not present initially.
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    // Simulate entering the top hover zone.
    fireEvent.mouseEnter(screen.getByTestId("hover-zone"));
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
