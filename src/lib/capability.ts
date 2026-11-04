import { invoke } from "@tauri-apps/api/core";

export type CapabilityRequest =
  | { kind: "Network"; host: string }
  | { kind: "Storage"; byte_count: number }
  | { kind: "Clipboard" }
  | { kind: "Mcp"; server: string }
  | { kind: "Ai"; provider: string };

/// A capability DECLARED in a document's manifest (what it requests). Distinct
/// from CapabilityRequest (a concrete runtime call). Mirrors the Rust
/// manifest::Capability enum, tagged by `category` to match serde's tag.
export type Capability =
  | { category: "network"; scopes: string[] }
  | { category: "storage"; limit_bytes: number }
  | { category: "clipboard" }
  | { category: "mcp"; servers: string[] }
  | { category: "ai"; providers: string[] };

export type Decision = "Allowed" | "Denied";

/// Asks the Rust policy engine whether a concrete runtime request is permitted.
/// The engine starts at zero; only user-granted capabilities allow anything.
export async function checkCapability(request: CapabilityRequest): Promise<Decision> {
  return invoke<Decision>("check_capability", { request });
}
