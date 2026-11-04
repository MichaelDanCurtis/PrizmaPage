import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProvidersTab } from "./ProvidersTab";

vi.mock("../lib/ai", () => ({
  listProviders: () => Promise.resolve(["openai", "ollama", "glm", "kimi", "copilot", "codex", "claude-agent-acp"]),
  hasApiKey: (p: string) => Promise.resolve(p === "openai"),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
  listModels: () => Promise.resolve(["gpt-4o", "gpt-4o-mini"]),
  startOAuth: vi.fn(),
  pollOAuth: vi.fn(),
  runCodexPkceFlow: vi.fn(),
  setAcpBinary: vi.fn(),
}));
vi.mock("../lib/openUrl", () => ({ openUrl: vi.fn() }));

describe("ProvidersTab", () => {
  it("renders all providers", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText("openai")).toBeInTheDocument());
    expect(screen.getByText("ollama")).toBeInTheDocument();
    expect(screen.getByText("glm")).toBeInTheDocument();
    expect(screen.getByText("kimi")).toBeInTheDocument();
    expect(screen.getByText("copilot")).toBeInTheDocument();
    expect(screen.getByText("codex")).toBeInTheDocument();
    expect(screen.getByText("claude-agent-acp")).toBeInTheDocument();
  });

  it("shows configured status for openai (mocked hasApiKey=true)", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText(/✓ Configured/)).toBeInTheDocument());
  });

  it("shows the GitHub sign-in button for copilot (NOT disabled)", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText(/Sign in with GitHub/)).toBeInTheDocument());
    const btn = screen.getByText(/Sign in with GitHub/).closest("button")!;
    expect(btn.disabled).toBe(false);
  });

  it("shows the Codex sign-in button for codex (NOT disabled)", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText(/Sign in with Codex/)).toBeInTheDocument());
    const btn = screen.getByText(/Sign in with Codex/).closest("button")!;
    expect(btn.disabled).toBe(false);
  });

  it("shows ollama as local (no API-key field)", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByText(/localhost:11434/)).toBeInTheDocument());
    // No "API key" placeholder input on the ollama row.
    expect(screen.queryAllByPlaceholderText("API key").length).toBeGreaterThan(0); // openai has one
  });

  it("shows the ACP binary field for claude-agent-acp", async () => {
    render(<ProvidersTab />);
    await waitFor(() => expect(screen.getByPlaceholderText(/claude-agent-acp binary path/)).toBeInTheDocument());
  });
});
