import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DocumentCanvas } from "./DocumentCanvas";

describe("DocumentCanvas", () => {
  it("renders compiled MDX component when build_main_js is present", async () => {
    // A trivial precompiled MDX function body that returns an object with a default.
    const compiled = `
      const { jsx: _jsx } = arguments[0];
      function MDXContent() { return _jsx('h1', { children: 'Rendered Title' }); }
      return { default: MDXContent };
    `;
    render(<DocumentCanvas compiled={compiled} zoomPct={100} />);
    await waitFor(() => expect(screen.getByText("Rendered Title")).toBeInTheDocument());
  });

  it("compiles and renders prose when build_main_js is null (prose-only doc)", async () => {
    // No precompiled build → the canvas compiles layer 1 on the fly, so
    // "# Just prose" becomes a real <h1> heading, not a <pre> dump.
    render(<DocumentCanvas compiled={null} contentMd="# Just prose" zoomPct={100} />);
    await waitFor(() => expect(screen.getByText("Just prose").tagName).toBe("H1"));
  });
});
