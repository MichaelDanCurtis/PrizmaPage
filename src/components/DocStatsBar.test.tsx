import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocStatsBar } from "./DocStatsBar";

describe("DocStatsBar", () => {
  it("renders words, characters, and reading time", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={null} />);
    expect(screen.getByText(/42\s*words/i)).toBeInTheDocument();
    expect(screen.getByText(/250\s*characters/i)).toBeInTheDocument();
    expect(screen.getByText(/1\s*min read/i)).toBeInTheDocument();
  });

  it("renders selection stats when provided", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={{ words: 5, characters: 30, readingMinutes: 0 }} />);
    expect(screen.getByText(/selected:\s*5\s*words/i)).toBeInTheDocument();
  });

  it("hides selection stats when null", () => {
    render(<DocStatsBar stats={{ words: 42, characters: 250, readingMinutes: 1 }} selectionStats={null} />);
    expect(screen.queryByText(/selected:/i)).not.toBeInTheDocument();
  });
});
