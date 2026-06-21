import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { getComponent } from "./ComponentRegistry";

/// Build a TipTap Node extension for a registered component. Each registered
/// component gets one of these so it can appear in the ProseMirror doc as a
/// custom node with its own React-rendered view.
export function makeComponentNode(componentName: string) {
  return Node.create({
    name: componentName,
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
      return {
        jsx: { default: `<${componentName} />` },
      };
    },

    parseHTML() {
      return [{ tag: componentName.toLowerCase() }];
    },

    renderHTML({ HTMLAttributes }) {
      return [componentName.toLowerCase(), mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(({ node, selected }) => {
        const jsx = (node.attrs.jsx as string) ?? `<${componentName} />`;
        const def = getComponent(componentName);
        const attrs: Record<string, unknown> = {};
        const attrRegex = /(\w+)="([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = attrRegex.exec(jsx)) !== null) {
          attrs[m[1]] = m[2];
        }
        const Rendered = def?.render ?? (() => <div>Unknown: {componentName}</div>);
        return (
          <NodeViewWrapper
            style={{
              outline: selected ? "2px solid var(--accent)" : "1px dashed var(--accent-border)",
              borderRadius: "var(--radius-sm)",
              margin: "8px 0",
              position: "relative",
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
            <Rendered {...attrs} />
          </NodeViewWrapper>
        );
      });
    },
  });
}
