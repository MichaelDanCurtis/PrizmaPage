import type { EditorState } from "@tiptap/pm/state";

/// Finds a safe top-level insertion position for a block component.
///
/// If the cursor is directly in a top-level text container (paragraph/heading),
/// returns null so the caller inserts at the cursor normally. If the cursor is
/// nested inside a container that can't hold a block (a list item, blockquote,
/// table cell, etc.), returns the position immediately AFTER that container so
/// the component becomes a sibling top-level block instead of nesting inside it.
export function topBlockInsertPos(state: EditorState): number | null {
  const { $from } = state.selection;
  const doc = state.doc;
  // depth 0 == doc itself; depth 1 == top-level block.
  for (let d = $from.depth; d >= 1; d--) {
    const ancestor = $from.node(d);
    const parent = d > 1 ? $from.node(d - 1) : doc;
    if (parent === doc || parent.type.name === "doc") {
      // `ancestor` is a top-level block. If it's a plain text container we
      // can insert at the cursor; otherwise (list, blockquote) we must insert
      // after it.
      if (ancestor.type.isTextblock) {
        return null; // cursor position is fine
      }
      // Insert right after this top-level block.
      return $from.before(d) + ancestor.nodeSize;
    }
  }
  return null;
}
