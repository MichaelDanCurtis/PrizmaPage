import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalBar } from "./GoalBar";

beforeEach(() => localStorage.clear());

describe("GoalBar", () => {
  it("renders nothing when no goal set", () => {
    const { container } = render(<GoalBar words={10} goal={0} onSetGoal={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
  it("shows a progress fraction and bar", () => {
    render(<GoalBar words={25} goal={50} onSetGoal={vi.fn()} />);
    expect(screen.getByText(/25\s*\/\s*50/i)).toBeInTheDocument();
  });
  it("marks reached when words >= goal", () => {
    render(<GoalBar words={60} goal={50} onSetGoal={vi.fn()} />);
    expect(screen.getByText(/goal reached/i)).toBeInTheDocument();
  });
  it("clicking calls onSetGoal", () => {
    const onSetGoal = vi.fn();
    render(<GoalBar words={25} goal={50} onSetGoal={onSetGoal} />);
    fireEvent.click(screen.getByTitle(/set goal/i));
    expect(onSetGoal).toHaveBeenCalledOnce();
  });
});
