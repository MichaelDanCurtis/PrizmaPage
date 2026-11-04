import { describe, it, expect, vi } from "vitest";
import { printDocument, PRINT_HIDDEN_CLASS } from "./print";

describe("print", () => {
  it("exposes the no-print class constant", () => {
    expect(PRINT_HIDDEN_CLASS).toBe("no-print");
  });

  it("printDocument calls window.print", () => {
    const spy = vi.fn();
    Object.defineProperty(window, "print", { value: spy, configurable: true, writable: true });
    printDocument();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("printDocument is a safe no-op when window.print is undefined", () => {
    Object.defineProperty(window, "print", { value: undefined, configurable: true, writable: true });
    expect(() => printDocument()).not.toThrow();
  });
});
