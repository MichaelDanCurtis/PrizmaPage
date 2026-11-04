import { invoke } from "@tauri-apps/api/core";

/// Render D2 source to an SVG string via the Rust `render_d2` command (shells
/// out to the `d2` binary). Rejects with a helpful message if d2 is absent.
export function renderD2(source: string): Promise<string> {
  return invoke<string>("render_d2", { source });
}
