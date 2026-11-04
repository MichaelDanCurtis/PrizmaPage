import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppearanceTab } from "./AppearanceTab";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.cssText = "";
});

describe("AppearanceTab", () => {
  it("renders Theme mode radios and accent swatches", () => {
    render(<AppearanceTab />);
    expect(screen.getByText("Theme mode")).toBeInTheDocument();
    expect(screen.getByLabelText(/light/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dark/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
  });

  it("selecting Dark sets localStorage and data-theme", () => {
    render(<AppearanceTab />);
    fireEvent.click(screen.getByLabelText(/dark/i));
    expect(localStorage.getItem("prizma.theme.mode")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("renders the token editor section", () => {
    render(<AppearanceTab />);
    expect(screen.getByText(/tokens/i)).toBeInTheDocument();
  });
});
