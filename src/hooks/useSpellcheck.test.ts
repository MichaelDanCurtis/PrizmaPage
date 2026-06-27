import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpellcheck } from "./useSpellcheck";

beforeEach(() => localStorage.clear());

describe("useSpellcheck", () => {
  it("defaults to enabled", () => {
    const { result } = renderHook(() => useSpellcheck());
    expect(result.current.enabled).toBe(true);
  });

  it("toggles and persists to localStorage", () => {
    const { result } = renderHook(() => useSpellcheck());
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem("prizma.editor.spellcheck")).toBe("0");
  });

  it("reads the persisted value on mount", () => {
    localStorage.setItem("prizma.editor.spellcheck", "0");
    const { result } = renderHook(() => useSpellcheck());
    expect(result.current.enabled).toBe(false);
  });
});
