import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHoverControls } from "./useHoverControls";

describe("useHoverControls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts hidden", () => {
    const { result } = renderHook(() => useHoverControls());
    expect(result.current.visible).toBe(false);
  });

  it("becomes visible on enter", () => {
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    expect(result.current.visible).toBe(true);
  });

  it("hides 400ms after leave", () => {
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    act(() => result.current.onLeave());
    // Still visible immediately (within the delay).
    expect(result.current.visible).toBe(true);
    // Advance past the 400ms fade-out delay.
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(result.current.visible).toBe(false);
  });

  it("stays visible if re-entered before the delay elapses", () => {
    const { result } = renderHook(() => useHoverControls());
    act(() => result.current.onEnter());
    act(() => result.current.onLeave());
    act(() => vi.advanceTimersByTime(200)); // halfway through delay
    act(() => result.current.onEnter()); // re-enter
    act(() => vi.advanceTimersByTime(450)); // well past original delay
    expect(result.current.visible).toBe(true);
  });
});
