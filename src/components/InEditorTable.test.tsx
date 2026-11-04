import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { parseMdxToDoc } from "../registry/serializer";

/// Confirms the editor schema renders a parsed GFM table as a real editable
/// table (table/tableRow/tableHeader/tableCell), the load-bearing check that
/// GFM-authored tables survive into the WYSIWYG surface.
function Harness({ onReady }: { onReady: (ed: any) => void }) {
  const ed = useEditor({
    extensions: [StarterKit, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell],
    content: parseMdxToDoc("| H1 | H2 |\n| --- | --- |\n| a | b |\n").json,
  });
  React.useEffect(() => { if (ed) setTimeout(() => onReady(ed), 30); }, [ed]);
  if (!ed) return null;
  return <EditorContent editor={ed} />;
}

describe("In-editor table integration", () => {
  it("renders a parsed GFM table with header + body cells", async () => {
    let html = "";
    render(<Harness onReady={(ed) => { html = ed.getHTML(); }} />);
    await waitFor(() => expect(html).toBeTruthy());
    expect(html).toContain("<table");
    // TipTap emits <th colspan=...> for header cells.
    expect(html).toContain("<th ");
    expect(html).toContain("H1");
    expect(html).toContain("<td ");
    expect(html).toContain(">b<");
  });

  it("exposes the insertTable command", async () => {
    let edRef: any = null;
    render(<Harness onReady={(ed) => { edRef = ed; }} />);
    await waitFor(() => expect(edRef).not.toBeNull());
    expect(typeof edRef.commands.insertTable).toBe("function");
    expect(typeof edRef.commands.addRowAfter).toBe("function");
  });
});
