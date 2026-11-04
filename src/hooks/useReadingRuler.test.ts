import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReadingRuler } from "./useReadingRuler";

beforeEach(() => localStorage.clear());

describe("useReadingRuler", () => {
  it("defaults to off", () => {
    expect(renderHook(() => useReadingRuler()).result.current.enabled).toBe(false);
  });
  it("toggles and persists", () => {
    const { result } = renderHook(() => useReadingRuler());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem("prizma.editor.ruler")).toBe("1");
  });
  it("reads persisted value on mount", () => {
    localStorage.setItem("prizma.editor.ruler", "1");
    expect(renderHook(() => useReadingRuler()).result.current.enabled).toBe(true);
  });
});
