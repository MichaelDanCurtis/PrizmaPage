import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FindReplaceBar } from "./FindReplaceBar";

const baseProps = {
  findText: "foo",
  replaceText: "",
  onFindChange: vi.fn(),
  onReplaceChange: vi.fn(),
  matchCount: 3,
  matchIndex: 1,
  results: [
    { index: 0, context: "first foo here" },
    { index: 1, context: "second foo" },
    { index: 2, context: "third foo" },
  ],
  onNext: vi.fn(),
  onPrev: vi.fn(),
  onJump: vi.fn(),
  onReplaceOne: vi.fn(),
  onReplaceAll: vi.fn(),
  onClose: vi.fn(),
};

describe("FindReplaceBar", () => {
  it("renders match count and index", () => {
    render(<FindReplaceBar {...baseProps} />);
    expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument(); // matchIndex 0-based shown 1-based
  });

  it("calls onNext/Prev", () => {
    const onNext = vi.fn(), onPrev = vi.fn();
    render(<FindReplaceBar {...baseProps} onNext={onNext} onPrev={onPrev} />);
    fireEvent.click(screen.getByTitle(/next/i));
    fireEvent.click(screen.getByTitle(/previous/i));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it("shows the replace row + buttons", () => {
    render(<FindReplaceBar {...baseProps} />);
    // The replace row has two buttons with distinct exact titles.
    expect(screen.getByTitle("Replace")).toBeInTheDocument();
    expect(screen.getByTitle("Replace all")).toBeInTheDocument();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<FindReplaceBar {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("toggles the results list and calls onJump on click", () => {
    const onJump = vi.fn();
    render(<FindReplaceBar {...baseProps} onJump={onJump} />);
    // Results hidden initially.
    expect(screen.queryByText("second foo")).not.toBeInTheDocument();
    // Toggle on.
    fireEvent.click(screen.getByTitle("Toggle all results"));
    expect(screen.getByText("second foo")).toBeInTheDocument();
    // Clicking a result jumps.
    fireEvent.click(screen.getByText("third foo"));
    expect(onJump).toHaveBeenCalledWith(2);
  });
});
