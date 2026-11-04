import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlashMenu } from "./SlashMenu";
import { registerLibrary } from "./library";

describe("SlashMenu", () => {
  beforeEach(() => registerLibrary());

  const baseProps = () => ({
    query: "",
    onSelect: vi.fn(),
    onClose: vi.fn(),
  });

  it("renders prose and component sections", () => {
    render(<SlashMenu {...baseProps()} />);
    expect(screen.getByText(/prose blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/components/i)).toBeInTheDocument();
  });

  it("filters items by query", () => {
    render(<SlashMenu {...baseProps()} query="stat" />);
    expect(screen.getByText(/StatCard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Callout/i)).not.toBeInTheDocument();
  });

  it("includes the AI component stub", () => {
    render(<SlashMenu {...baseProps()} />);
    expect(screen.getByText(/AI component/i)).toBeInTheDocument();
  });

  it("calls onSelect with the chosen item's insert template", () => {
    const onSelect = vi.fn();
    render(<SlashMenu {...baseProps()} onSelect={onSelect} />);
    fireEvent.click(screen.getByText(/StatCard/i));
    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining("<StatCard"));
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<SlashMenu {...baseProps()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
