import { describe, it, expect } from "vitest";
import { buildMarkdownExport, buildHtmlExport } from "./exportDoc";

describe("exportDoc", () => {
  it("buildMarkdownExport returns the source verbatim", () => {
    expect(buildMarkdownExport("# hi\n\ntext")).toBe("# hi\n\ntext");
  });
  it("buildHtmlExport wraps prose in a self-contained styled HTML doc", () => {
    const html = buildHtmlExport("# Title\n\nA paragraph.");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<style>");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>A paragraph.</p>");
  });
  it("buildHtmlExport escapes raw HTML so it can't inject a script tag", () => {
    expect(buildHtmlExport("see `<script>x</script>`")).toContain("&lt;script&gt;");
  });
  it("buildHtmlExport converts lists and bold", () => {
    const html = buildHtmlExport("- **a**\n- b");
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>a</strong>");
    expect(html).toContain("<li>");
  });
});
