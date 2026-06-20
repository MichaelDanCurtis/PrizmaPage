import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { run } from "@mdx-js/mdx";

export type MDXComponent = (props: Record<string, unknown>) => React.ReactElement;

/// The runtime options passed to run(): the React jsx-runtime pieces that the
/// compiled function body references. Document code receives ONLY these — no
/// host APIs, no filesystem, no network. Privileged access goes through the
/// capability bridge.
function runtimeOptions(baseUrl?: string) {
  return { Fragment, jsx, jsxs, baseUrl };
}

/// Runs a precompiled MDX module (layer 2) inside the sandbox.
/// `compiled` must be the output of compile({ outputFormat: 'function-body' }),
/// i.e. a function body — NOT a program/module with import/export.
///
/// Returns null if there is nothing to run (prose-only document).
export async function runMdxModule(
  compiled: string | null,
  baseUrl?: string
): Promise<MDXComponent | null> {
  if (!compiled) return null;
  // run() wraps the function body in an AsyncFunction and evaluates it with
  // the runtime options as its sole argument.
  const mod = await run(compiled, runtimeOptions(baseUrl));
  return mod.default as MDXComponent;
}
