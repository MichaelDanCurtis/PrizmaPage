import { describe, it, expect, beforeAll } from "vitest";
import { isValidGeneratedJsx, stripFences } from "./aiComponent";
import { registerLibrary } from "../components/library";

// Ensure the built-in components are registered so name validation works.
beforeAll(() => {
  registerLibrary();
});

describe("stripFences", () => {
  it("passes through plain JSX unchanged", () => {
    expect(stripFences('<Callout type="info">hi</Callout>')).toBe(
      '<Callout type="info">hi</Callout>'
    );
  });

  it("strips a fenced block ```jsx ... ```", () => {
    const wrapped = "```jsx\n<Divider />\n```";
    expect(stripFences(wrapped)).toBe("<Divider />");
  });

  it("strips a bare fenced block ``` ... ```", () => {
    const wrapped = "```\n<Divider />\n```";
    expect(stripFences(wrapped)).toBe("<Divider />");
  });

  it("extracts the JSX span from surrounding prose", () => {
    const prose = "Here is your component:\n<StatCard label=\"X\" value=\"1\" />\nHope it helps!";
    expect(stripFences(prose)).toBe('<StatCard label="X" value="1" />');
  });

  it("extends an open tag to its matching close when surrounded by prose", () => {
    const prose = "Sure: <Callout type=\"warning\">Watch out!</Callout> That's it.";
    expect(stripFences(prose)).toBe('<Callout type="warning">Watch out!</Callout>');
  });

  it("handles an orphan opening fence with no closer", () => {
    expect(stripFences("```jsx\n<Divider />")).toBe("<Divider />");
  });
});

describe("isValidGeneratedJsx", () => {
  it("accepts a valid self-closing known component", () => {
    const r = isValidGeneratedJsx('<StatCard label="A" value="B" />');
    expect(r.ok).toBe(true);
    expect(r.name).toBe("StatCard");
  });

  it("accepts a valid open/close known component", () => {
    const r = isValidGeneratedJsx('<Callout type="info">text</Callout>');
    expect(r.ok).toBe(true);
    expect(r.name).toBe("Callout");
  });

  it("rejects an unknown component name", () => {
    const r = isValidGeneratedJsx("<FooBar />");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Unknown");
  });

  it("rejects a non-JSX string", () => {
    const r = isValidGeneratedJsx("just text");
    expect(r.ok).toBe(false);
  });

  it("rejects an unclosed open tag", () => {
    const r = isValidGeneratedJsx("<Callout>missing close");
    expect(r.ok).toBe(false);
  });

  it("rejects a self-closing tag with malformed attrs", () => {
    const r = isValidGeneratedJsx('<StatCard label="A" value=>');
    expect(r.ok).toBe(false);
  });
});
