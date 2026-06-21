import { describe, it, expect } from "vitest";
import { serializeDoc, parseMdxToDoc, docToJson, docFromJson } from "./serializer";

describe("MDX serializer round-trip", () => {
  it("round-trips a heading + paragraph", () => {
    const mdx = "## Heading Two\n\nSome body text.\n";
    const doc = parseMdxToDoc(mdx);
    const out = serializeDoc(doc);
    expect(out.trim()).toBe(mdx.trim());
  });

  it("round-trips a list", () => {
    const mdx = "- one\n- two\n- three\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a blockquote", () => {
    const mdx = "> a quote\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips inline marks (bold, italic, code)", () => {
    const mdx = "Some **bold**, *italic*, and `code` text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a self-closing component (StatCard)", () => {
    const mdx = '<StatCard label="Revenue" value="$4.2M" />\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a component with text children (Callout)", () => {
    const mdx = '<Callout type="info">Watch out for this.</Callout>\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a childless structural component (Divider)", () => {
    const mdx = "<Divider />\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("docToJson / docFromJson preserve the doc", () => {
    const mdx = "## Title\n\nBody.\n";
    const doc = parseMdxToDoc(mdx);
    const json = docToJson(doc);
    const restored = docFromJson(json);
    expect(serializeDoc(restored).trim()).toBe(mdx.trim());
  });
});
