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

/// Encode a JSX attribute value so it survives the `key="value"` syntax.
/// `"` becomes `&quot;` etc. Used when serializing component nodes.
function encodeAttrValue(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/// Decode HTML entities in a JSX attribute value back to the raw character.
/// Used when parsing component nodes (mirrors componentNode's decodeEntities).
function decodeAttrValue(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
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
    // Heading (levels 1–6, like CommonMark).
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
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
    // Task list (- [ ] / - [x]). Must precede the bullet branch.
    if (/^- \[[ xX]\] /.test(line)) {
      const items: DocNode[] = [];
      while (i < lines.length && /^- \[[ xX]\] /.test(lines[i])) {
        const checked = /^- \[[xX]\] /.test(lines[i]);
        items.push({
          type: "taskItem",
          attrs: { checked },
          content: [{ type: "paragraph", content: parseInline(lines[i].replace(/^- \[[ xX]\] /, "")) }],
        });
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }
    // Bullet list.
    if (line.startsWith("- ") && !/^- \[[ xX]\] /.test(line)) {
      const items: DocNode[] = [];
      while (i < lines.length && lines[i].startsWith("- ") && !/^- \[[ xX]\] /.test(lines[i])) {
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
    // Default: paragraph. Gather consecutive non-block-start lines.
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    // If no lines were gathered (edge case), push the single line.
    const text = (paraLines.length > 0 ? paraLines : [line]).join(" ");
    content.push({ type: "paragraph", content: parseInline(text) });
  }
  return { json: { type: "doc", content } };
}

function isBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    /^(#{1,6})\s/.test(line) ||
    line.startsWith("> ") ||
    line.startsWith("- ") ||
    /^- \[[ xX]\] /.test(line) ||
    /^\d+\.\s/.test(line) ||
    (t.startsWith("<") && (t.endsWith("/>") || t.endsWith(">")))
  );
}

/// Parse inline marks (bold, italic, code) within a line into text nodes.
function parseInline(text: string): DocNode[] {
  const nodes: DocNode[] = [];
  // Order matters: wikilink [[X]] before single-bracket link/image, <u> before tags.
  const regex = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|<u>[^<]+<\/u>|!\[[^\]]*\]\([^)\s]+\)|\[[^\]]+\]\([^)\s]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith("[[") && token.endsWith("]]")) {
      // Wikilink: target is the note name (e.g. [[Roadmap]] → Roadmap.mdxz).
      const target = token.slice(2, -2);
      nodes.push({ type: "text", text: target, marks: [{ type: "wikilink", attrs: { target } }] });
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "strike" }] });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "code" }] });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    } else if (token.startsWith("<u>") && token.endsWith("</u>")) {
      nodes.push({ type: "text", text: token.slice(3, -4), marks: [{ type: "underline" }] });
    } else if (token.startsWith("![")) {
      const m = token.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)!;
      nodes.push({ type: "image", attrs: { alt: m[1], src: m[2] } });
    } else if (token.startsWith("[")) {
      const m = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      nodes.push({ type: "text", text: m[1], marks: [{ type: "link", attrs: { href: m[2] } }] });
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIdx) });
  }
  return nodes.length ? nodes : [{ type: "text", text }];
}

/// Parse a JSX component tag line into a DocNode.
/// Uses a generic "component" node type so TipTap only needs to register ONE
/// custom node (not one per component). The actual component name is stored
/// as an attr so the serializer can emit the right JSX tag.
function parseJsxComponent(tag: string): DocNode {
  const nameMatch = tag.match(/^<(\w+)/);
  const name = nameMatch?.[1] ?? "Component";
  const attrs: Record<string, unknown> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let am: RegExpExecArray | null;
  while ((am = attrRegex.exec(tag)) !== null) {
    // Decode entities so the internal representation matches what the
    // componentNode view produces (e.g. JSON attrs parse correctly).
    attrs[am[1]] = decodeAttrValue(am[2]);
  }
  // Store the full original JSX and the component name as attrs on a generic
  // "component" node. TipTap registers a single "component" node type that
  // renders whichever registered component the name attr points to.
  attrs["_name"] = name;
  // Reconstruct a canonical _jsx from the decoded attrs so double-click →
  // CodePeek shows the same thing the renderer sees.
  attrs["_jsx"] = reconstructJsx(name, attrs);
  return { type: "component", attrs };
}

/// Build a canonical JSX string from a parsed component's name + attrs.
/// Self-closing unless children are provided later. Public attrs only.
function reconstructJsx(name: string, attrs: Record<string, unknown>): string {
  const publicAttrs = Object.entries(attrs)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${k}="${encodeAttrValue(String(v))}"`)
    .join(" ");
  return `<${name}${publicAttrs ? " " + publicAttrs : ""} />`;
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
    case "taskList":
      return (node.content ?? [])
        .map((item) => serializeNode(item))
        .join("\n");
    case "taskItem": {
      const checked = node.attrs?.checked === true;
      const inner = serializeInline(node.content?.[0]?.content ?? []);
      return `- ${checked ? "[x]" : "[ ]"} ${inner}`;
    }
    case "image": {
      const alt = (node.attrs?.alt as string) ?? "";
      const src = (node.attrs?.src as string) ?? "";
      return `![${alt}](${src})`;
    }
    default: {
      // Component node — generic "component" type with _name + _jsx attrs.
      if (node.type === "component") {
        const name = (node.attrs?._name as string) ?? "Component";
        // Filter out internal attrs (_name, _jsx) for the serialized JSX.
        // Re-encode `"` and `&` so values containing them round-trip safely
        // through the `key="value"` syntax (mirrors componentNode's decode).
        const publicAttrs = Object.entries(node.attrs ?? {})
          .filter(([k]) => !k.startsWith("_"))
          .map(([k, v]) => `${k}="${encodeAttrValue(String(v))}"`)
          .join(" ");
        if (node.content && node.content.length > 0) {
          const inner = serializeInline(node.content[0]?.content ?? []);
          return `<${name}${publicAttrs ? " " + publicAttrs : ""}>${inner}</${name}>`;
        }
        return `<${name}${publicAttrs ? " " + publicAttrs : ""} />`;
      }
      // Unknown node type — serialize as paragraph fallback.
      return serializeInline(node.content ?? []);
    }
  }
}

function serializeInline(nodes: DocNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "image") {
        const alt = (n.attrs?.alt as string) ?? "";
        const src = (n.attrs?.src as string) ?? "";
        return `![${alt}](${src})`;
      }
      if (n.type === "text") {
        const text = n.text ?? "";
        const marks = n.marks ?? [];
        let out = text;
        // Apply marks in a stable order so round-trips are deterministic.
        if (marks.some((m) => m.type === "bold")) out = `**${out}**`;
        if (marks.some((m) => m.type === "italic")) out = `*${out}*`;
        if (marks.some((m) => m.type === "strike")) out = `~~${out}~~`;
        if (marks.some((m) => m.type === "underline")) out = `<u>${out}</u>`;
        if (marks.some((m) => m.type === "code")) out = `\`${out}\``;
        if (marks.some((m) => m.type === "link")) {
          const href = marks.find((m) => m.type === "link")?.attrs?.href ?? "";
          out = `[${out}](${href})`;
        }
        if (marks.some((m) => m.type === "wikilink")) {
          const target = marks.find((m) => m.type === "wikilink")?.attrs?.target ?? "";
          out = `[[${target}]]`;
        }
        // color/highlight/align are editor-only affordances: they persist via
        // the ProseMirror JSON path but are intentionally not emitted to MDX
        // text (would require inline HTML; deferred).
        return out;
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
