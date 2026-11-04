import { invoke } from "@tauri-apps/api/core";

/// Open a URL in the user's system browser. Falls back to window.open in the
/// browser dev environment (where invoke is mocked).
export async function openUrl(url: string): Promise<void> {
  try {
    await invoke("open_in_browser", { url });
  } catch {
    // Browser dev fallback.
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
