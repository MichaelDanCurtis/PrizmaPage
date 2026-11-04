import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiPanel } from "./AiPanel";

vi.mock("../hooks/useAiConfig", () => ({
  useAiConfig: () => ({
    provider: "openai",
    model: "gpt-4o-mini",
    configured: ["openai"],
    models: ["gpt-4o", "gpt-4o-mini"],
    loadingModels: false,
    loading: false,
    chooseProvider: vi.fn(),
    chooseModel: vi.fn(),
  }),
}));
const generateMock = vi.fn().mockResolvedValue("# Mock\n\nBody.\n");
vi.mock("../lib/aiGenerate", () => ({
  generateDocumentClean: (...a: any[]) => generateMock(...a),
  editSelectionClean: vi.fn().mockResolvedValue("edited"),
}));

describe("AiPanel", () => {
  it("shows Document mode by default and a prompt input", () => {
    render(<AiPanel selection={null} onApply={vi.fn()} onCollapse={vi.fn()} onOpenSettings={vi.fn()} width={320} />);
    expect(screen.getByText(/📄 Document/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/describe/i)).toBeInTheDocument();
  });

  it("shows Selection mode hint when selection is provided", () => {
    render(<AiPanel selection="some text" onApply={vi.fn()} onCollapse={vi.fn()} onOpenSettings={vi.fn()} width={320} />);
    expect(screen.getByText(/✎ Selection/i)).toBeInTheDocument();
  });

  it("generates and offers Replace/Insert/Append in Document mode", async () => {
    const onApply = vi.fn();
    render(<AiPanel selection={null} onApply={onApply} onCollapse={vi.fn()} onOpenSettings={vi.fn()} width={320} />);
    fireEvent.change(screen.getByPlaceholderText(/describe/i), { target: { value: "a doc about cats" } });
    fireEvent.click(screen.getByRole("button", { name: "↑" }));
    await waitFor(() => expect(screen.getByText(/replace/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /replace/i }));
    expect(onApply).toHaveBeenCalledWith(expect.any(String), "replace");
  });
});
