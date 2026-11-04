import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HoverControls } from "./HoverControls";

describe("HoverControls", () => {
  it("renders the pill with zoom, share, and Edit when visible", () => {
    render(
      <HoverControls
        visible={true}
        onEdit={vi.fn()}
        onShare={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        zoomPct={100}
      />
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
    expect(screen.getByLabelText("Share")).toBeInTheDocument();
  });

  it("calls onEdit when Edit clicked", () => {
    const onEdit = vi.fn();
    render(
      <HoverControls visible={true} onEdit={onEdit} onShare={vi.fn()} onZoomIn={vi.fn()} onZoomOut={vi.fn()} zoomPct={100} />
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("renders nothing visible when not visible", () => {
    render(
      <HoverControls visible={false} onEdit={vi.fn()} onShare={vi.fn()} onZoomIn={vi.fn()} onZoomOut={vi.fn()} zoomPct={100} />
    );
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });
});
