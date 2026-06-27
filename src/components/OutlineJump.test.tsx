import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { OutlineJump } from "./OutlineJump";

function Harness({ onReady }: { onReady: (ed: any) => void }) {
  const ed = useEditor({
    extensions: [StarterKit],
    content: "<h1>Welcome to PrizmaPage</h1><h2>Setup</h2><p>body</p><h1>Conclusion</h1>",
  });
  React.useEffect(() => { if (ed) setTimeout(() => onReady(ed), 30); }, [ed]);
  if (!ed) return null;
  return (
    <>
      <EditorContent editor={ed} />
      <OutlineJumpLive editor={ed} />
    </>
  );
}

function OutlineJumpLive({ editor }: { editor: any }) {
  const [open, setOpen] = React.useState(true);
  if (!open) return null;
  return <OutlineJump editor={editor} onJump={() => {}} onClose={() => setOpen(false)} />;
}

describe("OutlineJump live", () => {
  it("lists all headings with an empty query", async () => {
    let ready = false;
    const onReady = () => { ready = true; };
    render(<Harness onReady={onReady} />);
    await waitFor(() => expect(ready).toBe(true));
    // The picker input is present and multiple heading rows render.
    await waitFor(() => expect(screen.getByPlaceholderText("Jump to heading…")).toBeInTheDocument());
    const rows = screen.getAllByText("Welcome to PrizmaPage"); // editor + picker
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Setup").length).toBeGreaterThanOrEqual(2);
  });

  it("filters by query", async () => {
    let ready = false;
    render(<Harness onReady={() => { ready = true; }} />);
    await waitFor(() => expect(ready).toBe(true));
    await waitFor(() => expect(screen.getByPlaceholderText("Jump to heading…")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("Jump to heading…"), { target: { value: "setup" } });
    // After filtering, Setup still in picker; Conclusion gone from picker
    // (it may still exist in the editor body, so check picker specifically: 2 matches = editor+picker).
    expect(screen.getAllByText("Setup").length).toBe(2);
    expect(screen.queryAllByText("Conclusion").length).toBe(1); // editor body only
  });
});
