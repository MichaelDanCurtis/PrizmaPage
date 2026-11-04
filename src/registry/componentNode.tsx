import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { getComponent } from "./ComponentRegistry";

/// Decode the HTML entities that can legally appear inside a JSX attribute
/// value (the serializer emits them so a value containing `"` round-trips
/// through the `key="value"` syntax). Components receive the decoded value.
function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/// Parse a JSX tag string into { name, attrs, children }.
///   attrs:    key="value" pairs (HTML-entity decoded)
///   children: text between open and close tags (e.g. <X>hello</X> -> "hello"),
///             or undefined for self-closing tags (<X />).
function parseJsxTag(jsx: string): {
  name: string;
  attrs: Record<string, unknown>;
  children?: string;
} {
  const name = jsx.match(/^<(\w+)/)?.[1] ?? "Component";
  const attrs: Record<string, unknown> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(jsx)) !== null) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  // Children: text between > and </. Self-closing tags have none.
  const childMatch = jsx.match(/>([^<]*)<\/\w+>\s*$/);
  const children = childMatch ? decodeEntities(childMatch[1]) : undefined;
  return { name, attrs, children };
}

/// A SINGLE generic TipTap Node extension that renders ANY registered component.
/// The specific component is chosen by the `_name` attr on the node. This avoids
/// having to register a separate TipTap node type per component (which causes
/// TipTap to reject content with unknown node types on setContent).
export const ComponentNode = Node.create({
  name: "component",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      _name: { default: "Component" },
      _jsx: { default: "" },
      // All other attrs are dynamic (label, value, type, etc.) — stored but
      // not declared as TipTap attributes so they pass through setContent.
    };
  },

  parseHTML() {
    return [{ tag: "div[data-component]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-component": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node, selected }) => {
      const componentName = (node.attrs._name as string) ?? "Component";
      const jsx = (node.attrs._jsx as string) ?? `<${componentName} />`;
      const def = getComponent(componentName);
      const { attrs, children } = parseJsxTag(jsx);
      // Pass children through only if the tag actually had inner text.
      const props =
        children !== undefined ? { ...attrs, children } : attrs;
      const Rendered = def?.render ?? (() => <div>Unknown: {componentName}</div>);
      return (
        <NodeViewWrapper
          onDoubleClick={() => {
            window.dispatchEvent(
              new CustomEvent("prizma:component-activate", {
                detail: { componentName, jsx },
              })
            );
          }}
          style={{
            outline: selected ? "2px solid var(--accent)" : "1px dashed var(--accent-border)",
            borderRadius: "var(--radius-sm)",
            margin: "8px 0",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              fontSize: 9,
              color: "var(--accent)",
              fontWeight: 500,
              background: "var(--bg)",
              padding: "1px 6px",
              borderRadius: 3,
              border: "1px solid var(--accent-border)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          >
            {componentName}
          </div>
          <Rendered {...props} />
        </NodeViewWrapper>
      );
    });
  },
});
