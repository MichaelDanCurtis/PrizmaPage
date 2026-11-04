import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorState } from "./useEditorState";

describe("useEditorState", () => {
  it("starts in wysiwyg mode, not dirty, no peek open", () => {
    const { result } = renderHook(() => useEditorState());
    expect(result.current.mode).toBe("wysiwyg");
    expect(result.current.dirty).toBe(false);
    expect(result.current.peekTarget).toBeNull();
  });

  it("marks dirty", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.markDirty());
    expect(result.current.dirty).toBe(true);
  });

  it("clears dirty on markSaved", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.markDirty());
    act(() => result.current.markSaved());
    expect(result.current.dirty).toBe(false);
  });

  it("toggles mode wysiwyg <-> raw", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("raw");
    act(() => result.current.toggleMode());
    expect(result.current.mode).toBe("wysiwyg");
  });

  it("opens and closes the peek", () => {
    const { result } = renderHook(() => useEditorState());
    act(() => result.current.openPeek("StatCard-1"));
    expect(result.current.peekTarget).toBe("StatCard-1");
    act(() => result.current.closePeek());
    expect(result.current.peekTarget).toBeNull();
  });
});
