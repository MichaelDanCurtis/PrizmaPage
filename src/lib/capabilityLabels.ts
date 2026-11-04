import type { Capability } from "./capability";

/// A human-readable description of a single declared capability, plus the
/// capability itself (so the ConsentModal can grant the approved subset).
export interface ConsentRow {
  capability: Capability;
  icon: string;
  title: string;
  detail: string;
  /// Default allow state. Conservative: deny network/MCP/AI by default, allow
  /// clipboard/storage (low-risk, often expected).
  defaultAllow: boolean;
}

/// Build the consent rows from a manifest's declared capabilities.
export function capabilityRows(caps: Capability[]): ConsentRow[] {
  return caps.map((c) => {
    switch (c.category) {
      case "network":
        return {
          capability: c,
          icon: "🌐",
          title: "Network access",
          detail: `Connect to: ${c.scopes.join(", ")}`,
          defaultAllow: false,
        };
      case "storage":
        return {
          capability: c,
          icon: "💾",
          title: "Local storage",
          detail: `Store up to ${formatBytes(c.limit_bytes)} on disk`,
          defaultAllow: true,
        };
      case "clipboard":
        return {
          capability: c,
          icon: "📋",
          title: "Clipboard",
          detail: "Read from and write to the clipboard",
          defaultAllow: true,
        };
      case "mcp":
        return {
          capability: c,
          icon: "🔌",
          title: "MCP servers",
          detail: `Connect to: ${c.servers.join(", ")}`,
          defaultAllow: false,
        };
      case "ai":
        return {
          capability: c,
          icon: "✨",
          title: "AI providers",
          detail: `Use: ${c.providers.join(", ")}`,
          defaultAllow: false,
        };
    }
  });
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
