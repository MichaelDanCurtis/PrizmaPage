import { describe, it, expect, beforeEach } from "vitest";
import { mixHex, deriveAccentSoft, deriveAccentBorder, applyTokens, loadTheme } from "./themeStore";

describe("themeStore color math", () => {
  it("mixHex blends two hex colors by weight", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("deriveAccentSoft mixes accent over bg at ~0.1", () => {
    const soft = deriveAccentSoft("#4f46e5", "#ffffff");
    expect(soft).toMatch(/^#[0-9a-f]{6}$/);
    expect(soft).not.toBe("#4f46e5");
  });

  it("deriveAccentBorder mixes accent over bg at ~0.3", () => {
    const border = deriveAccentBorder("#4f46e5", "#ffffff");
    expect(border).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("themeStore apply/load", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.cssText = "";
  });

  it("applyTokens sets CSS variables on :root", () => {
    applyTokens({ "--accent": "#ff0000" });
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#ff0000");
  });

  it("loadTheme applies dark mode from storage and sets data-theme", () => {
    localStorage.setItem("prizma.theme.mode", "dark");
    loadTheme();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("loadTheme derives accent-soft/border from a custom accent", () => {
    localStorage.setItem("prizma.theme.mode", "light");
    localStorage.setItem("prizma.theme.accent", "#00897b");
    loadTheme();
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--accent")).toBe("#00897b");
    expect(root.getPropertyValue("--accent-soft")).toMatch(/^#[0-9a-f]{6}$/);
    expect(root.getPropertyValue("--accent-border")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("loadTheme with no storage applies defaults (no override vars)", () => {
    loadTheme();
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
  });
});
