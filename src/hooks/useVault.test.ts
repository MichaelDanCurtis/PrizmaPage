import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the vault lib + dialog before importing the hook.
const listMock = vi.fn();
const createMock = vi.fn();
vi.mock("../lib/vault", () => ({
  vaultList: (...a: any[]) => listMock(...a),
  vaultCreateNote: (...a: any[]) => createMock(...a),
  vaultRename: vi.fn(),
  vaultDelete: vi.fn(),
  vaultFileIn: vi.fn(),
  getStoredVaultPath: () => "/mock/vault",
  setStoredVaultPath: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));

import { useVault } from "./useVault";

beforeEach(() => {
  listMock.mockReset();
  createMock.mockReset();
  listMock.mockResolvedValue([
    { name: "Alpha.mdxz", path: "/mock/vault/Alpha.mdxz", is_folder: false, modified: 100 },
    { name: "Beta.mdxz", path: "/mock/vault/Beta.mdxz", is_folder: false, modified: 200 },
    { name: "Sub", path: "/mock/vault/Sub", is_folder: true, modified: 50 },
  ]);
  localStorage.clear();
  localStorage.setItem("prizma.vault.path", "/mock/vault");
});

describe("useVault", () => {
  it("loads entries on mount", async () => {
    const { result } = renderHook(() => useVault());
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(result.current.vaultPath).toBe("/mock/vault");
    expect(result.current.noteCount).toBe(2); // 2 files, 1 folder
  });

  it("derives recent sorted by modified desc", async () => {
    const { result } = renderHook(() => useVault());
    await waitFor(() => expect(result.current.recent).toHaveLength(2));
    expect(result.current.recent[0].name).toBe("Beta.mdxz"); // modified 200 > 100
  });

  it("createNote calls vaultCreateNote and reloads", async () => {
    createMock.mockResolvedValue("/mock/vault/New.mdxz");
    const { result } = renderHook(() => useVault());
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    const path = await act(async () => result.current.createNote("New"));
    expect(path).toBe("/mock/vault/New.mdxz");
    expect(createMock).toHaveBeenCalledWith("/mock/vault", "New");
  });
});
