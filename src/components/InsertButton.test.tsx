import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InsertButton } from "./InsertButton";
import { registerLibrary } from "./library";

describe("InsertButton", () => {
  beforeEach(() => registerLibrary());

  it("renders the + button; popover hidden until clicked", () => {
    render(<InsertButton onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.queryByText(/prose blocks/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText(/prose blocks/i)).toBeInTheDocument();
  });

  it("calls onSelect when a component is clicked", () => {
    const onSelect = vi.fn();
    render(<InsertButton onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByText(/StatCard/i));
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("<StatCard"));
  });
});
