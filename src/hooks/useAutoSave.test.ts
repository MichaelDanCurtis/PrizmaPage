import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoSave } from "./useAutoSave";

beforeEach(() => localStorage.clear());

describe("useAutoSave", () => {
  it("does not save immediately when notifyEdit is called", () => {
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: true, save }));
    act(() => { result.current.notifyEdit(); });
    expect(save).not.toHaveBeenCalled();
  });

  it("saves after the debounce window", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: true, save }));
    act(() => { result.current.notifyEdit(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(save).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does nothing when disabled", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: false, save }));
    act(() => { result.current.notifyEdit(); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(save).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("reschedules when a new edit arrives before the window", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const { result } = renderHook(() => useAutoSave({ dirty: true, enabled: true, save }));
    act(() => { result.current.notifyEdit(); });
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => { result.current.notifyEdit(); }); // restart the clock
    act(() => { vi.advanceTimersByTime(2000); }); // only 2s since restart
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); }); // now 3s since restart
    expect(save).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
