/// MDX serializer: the riskiest code in Layer 2a.
///
/// Two directions:
///   - parseMdxToDoc(mdx): parses MDX source into a ProseMirror-shaped JSON
///     doc (our intermediate representation).
///   - serializeDoc(doc): walks the doc JSON, emits MDX source.
///
/// The doc JSON is the shared shape between TipTap and the serializer. TipTap
/// accepts this JSON via editor.commands.setContent(json).
///
/// The round-trip property `serialize(parse(mdx)) === mdx` (modulo whitespace
/// normalization) is enforced by the test suite.

/// Intermediate doc node shape (ProseMirror-compatible JSON).
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface Doc {
  json: DocNode;
}

/// Parse MDX to our intermediate doc shape.
/// Hand-written line parser for prose blocks + JSX regex extractor for
/// components. Handles the constructs the serializer emits; round-trip is
/// guaranteed for what we serialize.
export function parseMdxToDoc(mdx: string): Doc {
  const lines = mdx.split("\n");
  const content: DocNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank line.
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Heading.
    const headingMatch = line.match(/^(#{2,3})\s+(.*)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }
    // Blockquote.
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          {
            type: "paragraph",
            content: parseInline(quoteLines.join(" ")),
          },
        ],
      });
      continue;
    }
    // Bullet list.
    if (line.startsWith("- ")) {
      const items: DocNode[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(lines[i].slice(2)) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }
    // Ordered list.
    if (/^\d+\.\s/.test(line)) {
      const items: DocNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push({
          type: "listItem",
          content: [
            { type: "paragraph", content: parseInline(lines[i].replace(/^\d+\.\s/, "")) },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }
    // JSX component (single line, possibly multi-line for children).
    const trimmed = line.trim();
    if (trimmed.startsWith("<") && trimmed.endsWith("/>")) {
      // Self-closing: <X ... />
      content.push(parseJsxComponent(trimmed));
      i++;
      continue;
    }
    // Single-line open/close: <X ...>children</X>
    const singleLineMatch = trimmed.match(/^<(\w+)([^>]*)>(.*)<\/\1>$/);
    if (singleLineMatch) {
      const [_, name, attrPart, childText] = singleLineMatch;
      const node = parseJsxComponent(`<${name}${attrPart}>`);
      node.content = [{ type: "paragraph", content: parseInline(childText) }];
      content.push(node);
      i++;
      continue;
    }
    // Multi-line open/close: <X ...> on one line, children, </X> on its own line.
    if (trimmed.startsWith("<") && trimmed.endsWith(">") && !trimmed.endsWith("/>")) {
      const openTag = trimmed;
      const componentName = openTag.match(/^<(\w+)/)?.[1] ?? "Component";
      const closeTag = `</${componentName}>`;
      const childLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== closeTag) {
        childLines.push(lines[i]);
        i++;
      }
      i++; // skip close tag
      const node = parseJsxComponent(openTag);
      node.content = [{ type: "paragraph", content: parseInline(childLines.join(" ")) }];
      content.push(node);
      continue;
    }
    // Default: paragraph.
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    content.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
  }
  return { json: { type: "doc", content } };
}

function isBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    /^(#{2,3})\s/.test(line) ||
    line.startsWith("> ") ||
    line.startsWith("- ") ||
    /^\d+\.\s/.test(line) ||
    (t.startsWith("<") && (t.endsWith("/>") || t.endsWith(">")))
  );
}

/// Parse inline marks (bold, italic, code) within a line into text nodes.
function parseInline(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "code" }] });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIdx) });
  }
  return nodes.length ? nodes : [{ type: "text", text }];
}

/// Parse a JSX component tag line into a DocNode (attrs only; children added by caller).
function parseJsxComponent(tag: string): DocNode {
  const nameMatch = tag.match(/^<(\w+)/);
  const name = nameMatch?.[1] ?? "Component";
  const attrs: Record<string, unknown> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let am: RegExpExecArray | null;
  while ((am = attrRegex.exec(tag)) !== null) {
    attrs[am[1]] = am[2];
  }
  return { type: name, attrs };
}

/// Serialize a doc back to MDX source.
export function serializeDoc(doc: Doc): string {
  const out: string[] = [];
  for (const node of doc.json.content ?? []) {
    out.push(serializeNode(node));
  }
  // Top-level blocks separated by blank lines.
  return out.join("\n\n").trim() + "\n";
}

function serializeNode(node: DocNode): string {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const hashes = "#".repeat(level);
      return `${hashes} ${serializeInline(node.content ?? [])}`;
    }
    case "paragraph":
      return serializeInline(node.content ?? []);
    case "blockquote":
      return (node.content ?? [])
        .map((c) => serializeNode(c))
        .map((line) => `> ${line}`)
        .join("\n");
    case "bulletList":
      return (node.content ?? [])
        .map((item) => `- ${serializeInline(item.content?.[0]?.content ?? [])}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map(
          (item, idx) =>
            `${idx + 1}. ${serializeInline(item.content?.[0]?.content ?? [])}`
        )
        .join("\n");
    case "listItem":
      return serializeInline(node.content?.[0]?.content ?? []);
    default: {
      // Component node — name === node.type.
      const attrs = node.attrs ?? {};
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(" ");
      if (node.content && node.content.length > 0) {
        const inner = serializeInline(node.content[0]?.content ?? []);
        return `<${node.type}${attrStr ? " " + attrStr : ""}>${inner}</${node.type}>`;
      }
      return `<${node.type}${attrStr ? " " + attrStr : ""} />`;
    }
  }
}

function serializeInline(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") {
        const text = n.text ?? "";
        const marks = n.marks ?? [];
        if (marks.some((m) => m.type === "bold")) return `**${text}**`;
        if (marks.some((m) => m.type === "italic")) return `*${text}*`;
        if (marks.some((m) => m.type === "code")) return `\`${text}\``;
        return text;
      }
      return "";
    })
    .join("");
}

/// JSON helpers (TipTap setContent / getJSON use this shape).
export function docToJson(doc: Doc): DocNode {
  return doc.json;
}

export function docFromJson(json: DocNode | Record<string, unknown>): Doc {
  return { json: json as DocNode };
}
