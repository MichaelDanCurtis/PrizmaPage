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

  // ===== Layer 2b: comprehensive library round-trips =====

  it("round-trips a Badge (multi simple attrs)", () => {
    const mdx = '<Badge label="New" color="accent" />\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a Quote (attr + text children)", () => {
    const mdx = '<Quote author="Ada Lovelace">A memorable pull-quote.</Quote>\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a FeatureCard (multi attr + children)", () => {
    const mdx = '<FeatureCard title="Feature" emoji="✨">Describe the feature here.</FeatureCard>\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a Chart with a JSON attr (quotes inside the value)", () => {
    // The value contains literal `"` chars (escaped as &quot; in JSX), which
    // the serializer must preserve through the round-trip.
    const mdx =
      '<Chart title="Sales" data="[{&quot;label&quot;:&quot;Q1&quot;,&quot;value&quot;:4}]" />\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a Table with a JSON attr", () => {
    const mdx =
      '<Table data="{&quot;headers&quot;:[&quot;A&quot;,&quot;B&quot;],&quot;rows&quot;:[[&quot;1&quot;,&quot;2&quot;]]}" />\n';
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a document mixing prose + multiple components", () => {
    const mdx = [
      "# Demo",
      "",
      "Intro paragraph.",
      "",
      '<StatCard label="Users" value="1.2k" />',
      "",
      '<Callout type="warning">Heads up.</Callout>',
      "",
      "Outro.",
      "",
    ].join("\n");
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a single-line Diagram (mermaid source as children)", () => {
    const mdx = "<Diagram>graph TD; A-->B</Diagram>\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  // ===== Rich-text marks (Phase 3) =====

  it("round-trips underline (<u>)", () => {
    const mdx = "Some <u>underlined</u> text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips strikethrough (~~)", () => {
    const mdx = "Some ~~struck~~ text.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a link [text](url)", () => {
    const mdx = "A [link](https://example.com) here.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips an image ![alt](data url)", () => {
    const mdx = "![pic](data:image/png;base64,iVBOR)\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a wikilink [[Target]]", () => {
    const mdx = "See [[Roadmap]] for details.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips multiple wikilinks in a sentence", () => {
    const mdx = "Link [[Alpha]] and [[Beta]] together.\n";
    const doc = parseMdxToDoc(mdx);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips an unchecked task list (- [ ])", () => {
    const mdx = "- [ ] buy milk\n- [ ] walk dog\n";
    const doc = parseMdxToDoc(mdx);
    // Must parse as a real taskList (not a bullet with "[ ]" text).
    const first = (doc.json.content as any[])[0];
    expect(first.type).toBe("taskList");
    expect(first.content[0].type).toBe("taskItem");
    expect(first.content[0].attrs.checked).toBe(false);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a checked task (- [x])", () => {
    const mdx = "- [x] done thing\n";
    const doc = parseMdxToDoc(mdx);
    const first = (doc.json.content as any[])[0];
    expect(first.type).toBe("taskList");
    expect(first.content[0].attrs.checked).toBe(true);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a mixed checked/unchecked list", () => {
    const mdx = "- [ ] a\n- [x] b\n- [ ] c\n";
    const doc = parseMdxToDoc(mdx);
    const items = (doc.json.content as any[])[0].content;
    expect(items.map((i: any) => i.attrs.checked)).toEqual([false, true, false]);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("does not confuse tasks with bullets", () => {
    const mdx = "- bullet\n- [ ] task\n";
    const doc = parseMdxToDoc(mdx);
    const blocks = doc.json.content as any[];
    expect(blocks[0].type).toBe("bulletList");
    expect(blocks[1].type).toBe("taskList");
    const out = serializeDoc(doc).trim();
    expect(out).toContain("- bullet");
    expect(out).toContain("- [ ] task");
  });

  it("round-trips a GFM table (header + 2 rows)", () => {
    const mdx = "| H1 | H2 |\n| --- | --- |\n| a | b |\n| c | d |\n";
    const doc = parseMdxToDoc(mdx);
    const table = (doc.json.content as any[]).find((b) => b.type === "table");
    expect(table).toBeDefined();
    // Must have a header row + 2 body rows.
    const rows = table.content;
    expect(rows.length).toBe(3);
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("round-trips a 3-column table and preserves cell text", () => {
    const mdx = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n";
    const doc = parseMdxToDoc(mdx);
    const table = (doc.json.content as any[]).find((b) => b.type === "table");
    expect(table.content[1].content.length).toBe(3); // body row has 3 cells
    expect(serializeDoc(doc).trim()).toBe(mdx.trim());
  });

  it("does not mis-parse a non-table line containing a pipe", () => {
    const mdx = "See a | b in prose.\n";
    const doc = parseMdxToDoc(mdx);
    const blocks = doc.json.content as any[];
    expect(blocks.some((b) => b.type === "table")).toBe(false);
  });

  it("round-trips a footnote reference + definition", () => {
    const mdx = "Body with a note[^1].\n\n[^1]: the footnote text\n";
    const doc = parseMdxToDoc(mdx);
    // The definition must parse as a structured footnoteDefinition node.
    const defBlock = (doc.json.content as any[]).find((b) => b.type === "footnoteDefinition");
    expect(defBlock).toBeDefined();
    expect(defBlock.attrs.ref).toBe("1");
    expect(serializeDoc(doc).trim()).toContain("[^1]: the footnote text");
  });

  it("preserves footnote text in the parsed doc", () => {
    const mdx = "See[^a] for detail.\n\n[^a]: detail here\n";
    const doc = parseMdxToDoc(mdx);
    const defBlock = (doc.json.content as any[]).find((b) => b.type === "footnoteDefinition");
    expect(defBlock).toBeDefined();
    expect(defBlock.attrs.ref).toBe("a");
    expect(JSON.stringify(defBlock)).toContain("detail here");
  });
});
