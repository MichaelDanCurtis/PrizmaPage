import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryDialog } from "./MemoryDialog";

describe("MemoryDialog", () => {
  it("renders title, content, and tags fields", () => {
    render(<MemoryDialog onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What do you want to remember?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Tags (comma-separated)")).toBeInTheDocument();
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<MemoryDialog onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables Save until a title is entered", () => {
    render(<MemoryDialog onSave={vi.fn()} onClose={vi.fn()} />);
    const saveBtn = screen.getByText("Save memory");
    expect(saveBtn).toBeDisabled();
  });

  it("calls onSave with parsed tags on save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MemoryDialog onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "My memory" } });
    fireEvent.change(screen.getByPlaceholderText("What do you want to remember?"), { target: { value: "remember this" } });
    fireEvent.change(screen.getByPlaceholderText("Tags (comma-separated)"), { target: { value: "alpha, beta" } });
    fireEvent.click(screen.getByText("Save memory"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("My memory", "remember this", ["alpha", "beta"]));
  });
});
