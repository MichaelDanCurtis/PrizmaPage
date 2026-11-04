import { invoke } from "@tauri-apps/api/core";
import type { Capability } from "./capability";

export interface Manifest {
  version: string;
  origin_domain: string | null;
  capabilities: Capability[];
  signature: string | null;
}

export interface OpenedDocument {
  manifest: Manifest;
  content_md: string;
  build_main_js: string | null;
}

/// Asks the Rust core to open and parse a .mdxz. Returns the three layers.
export async function openDocument(path: string): Promise<OpenedDocument> {
  return invoke<OpenedDocument>("open_document", { path });
}

/// Seeds the policy engine with the document's declared capabilities.
/// (Phase 2 replaces this with a user prompt that gates the grant.)
export async function grantDeclaredCapabilities(manifest: Manifest): Promise<void> {
  await invoke("grant_declared_capabilities", { manifest });
}
