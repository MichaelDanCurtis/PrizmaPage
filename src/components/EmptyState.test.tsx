import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the app mark and primary affordances", () => {
    render(
      <EmptyState
        recents={[]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    expect(screen.getByText("PrizmaPage")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByText(/drop a \.mdxz file/i)).toBeInTheDocument();
  });

  it("greys out Recent when there are none", () => {
    render(
      <EmptyState
        recents={[]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    const recentBtn = screen.getByText(/Recent/);
    expect(recentBtn).toBeDisabled();
  });

  it("enables Recent and lists entries when present", () => {
    render(
      <EmptyState
        recents={[
          { path: "/a.mdxz", name: "alpha", opened_at: 1 },
          { path: "/b.mdxz", name: "beta", opened_at: 2 },
        ]}
        onOpen={vi.fn()}
        onDrop={vi.fn()}
        onOpenRecent={vi.fn()}
      />
    );
    expect(screen.getByText("Recent (2)")).not.toBeDisabled();
    // Click to open the menu.
    fireEvent.click(screen.getByText("Recent (2)"));
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("calls onOpen when Open clicked", () => {
    const onOpen = vi.fn();
    render(
      <EmptyState recents={[]} onOpen={onOpen} onDrop={vi.fn()} onOpenRecent={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
