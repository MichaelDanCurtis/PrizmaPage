import { listComponents } from "../registry/ComponentRegistry";

export interface JsxValidation {
  ok: boolean;
  name?: string;
  reason?: string;
}

/// Validate that a string is a single self-closing or open/close JSX tag using
/// a registered component name. Mirrors CodePeek's validator but also checks
/// the component is one we know about.
export function isValidGeneratedJsx(jsx: string): JsxValidation {
  const trimmed = jsx.trim();
  if (!trimmed.startsWith("<")) return { ok: false, reason: "Not a JSX tag." };
  const name = trimmed.match(/^<(\w+)/)?.[1];
  if (!name) return { ok: false, reason: "Missing tag name." };
  const known = listComponents().some((c) => c.name === name);
  if (!known) return { ok: false, reason: `Unknown component: ${name}` };
  if (trimmed.endsWith("/>")) {
    return { ok: /^<\w+(\s+\w+="[^"]*")*\s*\/>$/.test(trimmed), name };
  }
  const closeTag = `</${name}>`;
  return { ok: trimmed.endsWith(closeTag), name };
}

/// Strip markdown code fences that some models wrap around the answer despite
/// the system prompt asking for raw JSX only. Also tolerates surrounding prose
/// by extracting the first JSX tag span.
export function stripFences(text: string): string {
  let t = text.trim();
  // ```jsx ... ``` or ``` ... ```
  const fence = t.match(/^```[a-zA-Z]*\n?([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  // Orphan opening fence with no closer (model stopped early).
  if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\n?/, "").trim();
  // If there's surrounding prose, take the first <...>…</…> or <…/> span.
  const span = t.match(/<\w+[\s\S]*?\/?>/);
  if (span && span.index !== undefined) {
    // If it's an open tag, extend to the matching close.
    const name = span[0].match(/^<(\w+)/)?.[1];
    if (name && !span[0].endsWith("/>")) {
      const close = t.indexOf(`</${name}>`);
      if (close > span.index) return t.slice(span.index, close + `</${name}>`.length).trim();
    }
    return span[0];
  }
  return t;
}
