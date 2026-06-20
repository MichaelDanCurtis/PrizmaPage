import { invoke } from "@tauri-apps/api/core";

export type CapabilityRequest =
  | { kind: "Network"; host: string }
  | { kind: "Storage"; byte_count: number }
  | { kind: "Clipboard" }
  | { kind: "Mcp"; server: string }
  | { kind: "Ai"; provider: string };

export type Decision = "Allowed" | "Denied";

/// Asks the Rust policy engine whether a concrete runtime request is permitted.
/// The engine starts at zero; only user-granted capabilities allow anything.
export async function checkCapability(request: CapabilityRequest): Promise<Decision> {
  return invoke<Decision>("check_capability", { request });
}
