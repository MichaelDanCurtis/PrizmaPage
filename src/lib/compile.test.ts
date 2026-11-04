import { describe, it, expect } from "vitest";
import { compileMdx } from "./compile";

describe("compileMdx", () => {
  it("compiles simple markdown to a function-body string", async () => {
    const compiled = await compileMdx("# Hello");
    expect(typeof compiled).toBe("string");
    expect(compiled.length).toBeGreaterThan(0);
    // function-body output: should NOT contain `export` statements.
    expect(compiled).not.toContain("export ");
  });

  it("compiles MDX with JSX to a function-body string", async () => {
    const compiled = await compileMdx('# Hi\n\n<StatCard label="x" value="y" />');
    expect(typeof compiled).toBe("string");
    expect(compiled.length).toBeGreaterThan(0);
  });

  it("throws on invalid MDX", async () => {
    await expect(compileMdx("# Unclosed <Component")).rejects.toThrow();
  });
});
