import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusMode } from "./useFocusMode";

beforeEach(() => localStorage.clear());

describe("useFocusMode", () => {
  it("defaults to off", () => {
    expect(renderHook(() => useFocusMode()).result.current.enabled).toBe(false);
  });
  it("toggles and persists", () => {
    const { result } = renderHook(() => useFocusMode());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem("prizma.editor.focus")).toBe("1");
  });
  it("reads persisted value on mount", () => {
    localStorage.setItem("prizma.editor.focus", "1");
    expect(renderHook(() => useFocusMode()).result.current.enabled).toBe(true);
  });
});
