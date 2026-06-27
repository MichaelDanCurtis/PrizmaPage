import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageResize } from "./ImageResize";

function Harness({ onReady }: { onReady: (ed: any) => void }) {
  const ed = useEditor({
    extensions: [StarterKit, ImageResize],
    content: { type: "doc", content: [{ type: "image", attrs: { src: "x.png", alt: "pic", width: 250 } }] },
  });
  React.useEffect(() => { if (ed) setTimeout(() => onReady(ed), 30); }, [ed]);
  if (!ed) return null;
  return <EditorContent editor={ed} />;
}

describe("ImageResize", () => {
  it("persists the width attr in the editor schema", async () => {
    let json: any = null;
    render(<Harness onReady={(ed) => { json = ed.getJSON(); }} />);
    await waitFor(() => expect(json).not.toBeNull());
    const imgNode = json.content[0];
    expect(imgNode.type).toBe("image");
    expect(imgNode.attrs.width).toBe(250);
  });
});
