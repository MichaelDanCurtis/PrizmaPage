export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface Range {
  from: number;
  to: number;
}

/// All non-overlapping substring matches of `query` in `text`. Returns `[]`
/// for an empty query. Operates on a plain-text view of the document
/// (positions are offsets into that same text), used by FindReplaceBar.
export function findAll(text: string, query: string, opts: FindOptions): Range[] {
  if (!query) return [];
  const flags = opts.caseSensitive ? "g" : "gi";
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = opts.wholeWord ? `\\b${escaped}\\b` : escaped;
  const re = new RegExp(pattern, flags);
  const out: Range[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ from: m.index, to: m.index + m[0].length });
    if (m[0].length === 0) re.lastIndex++; // avoid zero-width loop
  }
  return out;
}
