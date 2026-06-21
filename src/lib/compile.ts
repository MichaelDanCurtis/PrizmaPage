import { compile } from "@mdx-js/mdx";

/// Compile MDX source to a function-body string (the format @mdx-js/mdx's
/// `run()` can evaluate, and the format stored in build/main.js at save).
/// This is the live equivalent of what build-fixture.mjs does at save time.
export async function compileMdx(source: string): Promise<string> {
  const compiled = await compile(source, { outputFormat: "function-body" });
  return String(compiled);
}
