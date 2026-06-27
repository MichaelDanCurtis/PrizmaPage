import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplatePicker } from "./TemplatePicker";

describe("TemplatePicker", () => {
  it("renders every template title", () => {
    render(<TemplatePicker onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Meeting notes")).toBeInTheDocument();
    expect(screen.getByText("Blog post")).toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();
  });

  it("calls onPick with the template id", () => {
    const onPick = vi.fn();
    render(<TemplatePicker onPick={onPick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Meeting notes"));
    expect(onPick).toHaveBeenCalledWith("meeting-notes");
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<TemplatePicker onPick={vi.fn()} onClose={onClose} />);
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
