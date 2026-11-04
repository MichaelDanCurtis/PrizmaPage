import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  const baseProps = () => ({
    recents: [] as Array<{ path: string; name: string; opened_at: number }>,
    onOpen: vi.fn(),
    onNew: vi.fn(),
    onImportMarkdown: vi.fn(),
    onDrop: vi.fn(),
    onOpenRecent: vi.fn(),
    onOpenWelcome: vi.fn(),
    onOpenSettings: vi.fn(),
  });

  it("renders the app mark and primary affordances", () => {
    render(<EmptyState {...baseProps()} />);
    expect(screen.getByText("PrizmaPage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByText(/drop a \.mdxz file/i)).toBeInTheDocument();
  });

  it("greys out Recent when there are none", () => {
    render(<EmptyState {...baseProps()} />);
    const recentBtn = screen.getByText(/Recent/);
    expect(recentBtn).toBeDisabled();
  });

  it("enables Recent and lists entries when present", () => {
    render(
      <EmptyState
        {...baseProps()}
        recents={[
          { path: "/a.mdxz", name: "alpha", opened_at: 1 },
          { path: "/b.mdxz", name: "beta", opened_at: 2 },
        ]}
      />
    );
    expect(screen.getByText("Recent (2)")).not.toBeDisabled();
    // Click to open the menu.
    fireEvent.click(screen.getByText("Recent (2)"));
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("calls onOpen when Open clicked", () => {
    const props = baseProps();
    render(<EmptyState {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(props.onOpen).toHaveBeenCalledOnce();
  });

  it("calls onNew when New clicked", () => {
    const props = baseProps();
    render(<EmptyState {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /new/i }));
    expect(props.onNew).toHaveBeenCalledOnce();
  });

  it("renders the welcome affordance and calls onOpenWelcome", () => {
    const props = baseProps();
    render(<EmptyState {...props} />);
    const welcomeLink = screen.getByText(/welcome document/i);
    expect(welcomeLink).toBeInTheDocument();
    fireEvent.click(welcomeLink);
    expect(props.onOpenWelcome).toHaveBeenCalledOnce();
  });
});
