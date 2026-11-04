import { describe, it, expect } from "vitest";
import { compile } from "@mdx-js/mdx";
import { runMdxModule } from "./runner";

describe("runMdxModule", () => {
  it("runs a precompiled MDX function-body and returns a React component", async () => {
    // Compile with outputFormat: 'function-body' — this is the format run()
    // can evaluate, and the format the save/compile path must produce.
    const compiled = String(
      await compile("# Hello from the sandbox", {
        outputFormat: "function-body",
      })
    );
    const Component = await runMdxModule(compiled);
    expect(Component).toBeTypeOf("function");
  });

  it("returns null for an empty build (prose-only document has nothing to run)", async () => {
    const Component = await runMdxModule(null);
    expect(Component).toBeNull();
  });
});
