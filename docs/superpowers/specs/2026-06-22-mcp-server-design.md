# Bidirectional MCP (Server Direction) — Design

> **Roadmap position:** Sub-project 5 of 7.
> **Architecture ref:** §8.3 Direction 2 — Document as MCP server (editor-only).

## 1. Goal

When the user is in editor mode, the document exposes itself as an MCP server (JSON-RPC over stdio) that external agents — Claude Code, Copilot, Codex — can connect to and call. This is the "ask the AI to build a graph generator that becomes part of this file" mechanism: agents integrate with the document as a programmable resource.

The server is **editor-mode only** and **localhost only** (stdio by definition has no network surface). Viewer mode exposes zero incoming surface, per the architecture's hard constraint.

## 2. Scope (pragmatic v1)

- **Transport: stdio.** The MCP server is a Rust subprocess (or an in-process thread reading stdin/writing stdout) speaking JSON-RPC 2.0. External agents spawn it as a child process (the standard MCP stdio transport). No TCP socket in v1 — stdio is the safest possible surface (no port, no network) and matches the MCP spec's primary transport.
- **Tools exposed (the document as a resource):**
  - `list_sections()` → returns the document's headings + structure
  - `read_section(name)` → returns the body text under a heading
  - `read_full()` → returns the entire content.md
  - `list_components()` → returns the components currently in the doc (names + JSX)
  - `get_metadata()` → manifest info (origin, capabilities)
- **Initialize handshake:** implements `initialize` + `initialized` per the MCP spec, advertising the tools above.

## 3. What this enables

An author in editor mode configures their Claude Code (or any MCP client) to spawn `prizmapage mcp-server --doc <path>`. Claude can then call `list_sections` / `read_section` to understand the document and reason about it. Future phases add *write* tools (insert/replace content) gated by the consent system.

## 4. Implementation

A new Rust binary target `prizmapage-mcp-server` (or a `--mcp-server` mode on the main binary) that:
1. Reads the doc path arg, opens the `.mdxz`, parses content.md into sections.
2. Enters a JSON-RPC stdio loop: reads line-delimited requests, dispatches to tool handlers, writes responses.
3. Implements the MCP lifecycle: `initialize` (returns server info + capabilities), tools handlers, graceful shutdown on EOF.

The editor UI shows a status indicator: "MCP server ready — connect from your agent with: `prizmapage mcp-server --doc <path>`" with a copy-to-clipboard button.

## 5. Files

- Rust: `src-tauri/src/mcp_server.rs` — the JSON-RPC stdio loop + tool handlers + section parser. Unit-tested with a mock stdin/stdout.
- Rust: a `--mcp-server` CLI mode in `main.rs` (Tauri's main) that dispatches to the server when the flag is present, else runs the app.
- Frontend: `McpServerStatus.tsx` — a small panel in the editor showing the server is available + the connect command.

## 6. Testing

- Rust unit: feed `initialize` + `tools/list` + `tools/call` JSON-RPC over a mock stdio; assert correct responses.
- Rust unit: section parser extracts headings + bodies correctly from sample MDX.
- Visual: editor shows the MCP status panel with the connect command.

## 7. Non-goals

- TCP/localhost-socket transport (stdio only for v1).
- Write tools (read-only tools first; writes need the consent system extended to inbound calls — later phase).
- Remote agent connections (localhost-only by design; remote needs explicit opt-in UX).
- Auto-spawning the server on editor entry (the author opts in by clicking "Enable MCP server").
