import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";

describe("SettingsModal", () => {
  it("renders both tab labels", () => {
    render(<SettingsModal onClose={vi.fn()} />);
    expect(screen.getByText("providers")).toBeInTheDocument();
    expect(screen.getByText("appearance")).toBeInTheDocument();
  });

  it("calls onClose when the ✕ is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("switches to Appearance tab on click", () => {
    render(<SettingsModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("appearance"));
    expect(screen.getByText("Theme mode")).toBeInTheDocument();
  });
});
