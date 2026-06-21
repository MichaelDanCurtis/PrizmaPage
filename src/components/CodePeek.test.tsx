import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodePeek } from "./CodePeek";

describe("CodePeek", () => {
  it("renders the component name + initial JSX", () => {
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/editing: StatCard/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/StatCard/)).toBeInTheDocument();
  });

  it("calls onApply with the edited JSX", () => {
    const onApply = vi.fn();
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={onApply}
        onCancel={vi.fn()}
      />
    );
    const textarea = screen.getByDisplayValue(/StatCard/);
    fireEvent.change(textarea, { target: { value: '<StatCard label="New" value="X" />' } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith('<StatCard label="New" value="X" />');
  });

  it("calls onCancel without applying", () => {
    const onCancel = vi.fn();
    const onApply = vi.fn();
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue" value="$4.2M" />'}
        onApply={onApply}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("disables Apply for unclosed JSX", () => {
    render(
      <CodePeek
        componentName="StatCard"
        initialJsx={'<StatCard label="Revenue"'}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText("Apply")).toBeDisabled();
  });
});
