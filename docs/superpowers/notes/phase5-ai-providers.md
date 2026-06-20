# Phase 5: AI Provider Integration — Design + Verification Notes

**Date:** 2026-06-20
**Branch:** `phase5/ai-providers`
**Builds on:** Phase 0 (runtime + sandbox core)

## What was built

End-to-end AI provider plumbing across four auth/connection shapes, all gated by the `Ai` capability and routed through the same `ai_complete` bridge command:

| Shape | Providers | Auth |
|-------|-----------|------|
| **API key** | openai, openrouter, ollama (+ any OpenAI-compatible endpoint) | User-pasted key in OS keychain |
| **OAuth device flow** | copilot (GitHub), codex (OpenAI) | RFC 8628 device code → user authorizes at provider → token stored |
| **ACP (stdio JSON-RPC)** | claude (Claude Code or any ACP-compliant agent) | Spawn agent subprocess; no app-side credential |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React in webview)                                      │
│   ConnectionsPanel ──┐                                           │
│   PromptBox ─────────┤── ai.ts (invoke bridge)                   │
└──────────────────────┼───────────────────────────────────────────┘
                       │  Tauri commands (invoke_handler)
┌──────────────────────▼───────────────────────────────────────────┐
│ Rust core (AppState)                                             │
│   Registry ──► Provider trait ◄── OpenAiCompatibleProvider       │
│                          ◄── OAuthProvider (copilot, codex)      │
│                          ◄── AcpProvider    (claude)             │
│   SecretStore ◄── KeyringSecretStore (keychain)                  │
│                 ◄── InMemorySecretStore (tests)                  │
│   PolicyEngine ── Ai capability gate on ai_complete              │
│   DeviceFlowClient ── OAuth state machine                        │
│   AcpClient ── JSON-RPC 2.0 over subprocess stdio                │
└──────────────────────────────────────────────────────────────────┘
```

### Key design decisions

1. **`Provider` trait abstracts "complete a prompt"** so every auth shape routes through one bridge command (`ai_complete`). Document code never knows whether a response came from an API key, OAuth, or a spawned agent.
2. **Credentials never touch document code or the frontend.** The Rust core pulls secrets from the `SecretStore` at call time. The frontend only ever asks `hasApiKey` (boolean) — keys are never serialized across the bridge.
3. **Capability gate is load-bearing.** `ai_complete` checks the `Ai { provider }` capability via the `PolicyEngine` before dispatching. A document that didn't declare `ai` for a provider cannot use it. (Phase 0's stub grant is still in place; Phase 2 ties this to the open-time prompt.)
4. **ACP = one subprocess per completion.** Keeps the trust boundary simple — no long-lived agent holding state across calls. `ai_set_acp_binary` lets the user point at a custom Claude Code install.
5. **OAuth is split into two commands.** `ai_start_oauth` (request code, show URL) + `ai_poll_oauth` (poll once) so the UI can surface the user code before blocking. The TS helper `runOAuthFlow` drives the full poll loop.

## Test evidence (46 tests, all green)

**Rust (35 tests):**
- `secret_test` (4) — SecretStore set/get/delete/overwrite
- `provider_test` (3) — OpenAI-compatible provider: happy path (asserts bearer header sent), not-configured, upstream HTTP error
- `ai_bridge_test` (4) — end-to-end through registry → secret store → provider → mock HTTP, plus capability allow/deny, unknown provider, sorted listing
- `oauth_test` (6) — device-code request, pending/success/denied/expired poll, full await_token flow
- `oauth_providers` unit (3) — Copilot/Codex configs + base URLs
- `acp_test` (5) — initialize, session/new, notification-skipping session/prompt, full sequence, provider-trait integration
- `manifest_test` (2), `policy_test` (4), `package_test` (4) — Phase 0 (unchanged)

**Frontend (11 tests):**
- `ai.test.ts` (7) — list/set/clear/has key, complete, start/poll OAuth, set ACP binary
- `capability.test.ts` (2), `runner.test.ts` (2)

**Build verification:**
- `cargo build --release` — full binary links clean with all commands
- `npm run build` — frontend builds (305 modules)
- `cargo tauri dev` — boots vite + compiles + launches window without error

## ⚠️ Verification boundary — read this

The plumbing is proven end-to-end against mocks. **The live handshake for each OAuth/ACP provider requires the user's real credentials and cannot be verified by me in this environment.** This is not a gap in the code — it's a property of the protocols (OAuth needs a registered app + real account consent; ACP needs the real `claude` binary installed).

### Bring-your-own-credentials verification checklist

For each provider, run `cargo tauri dev`, open the app, and:

**API-key providers (openai, openrouter, ollama):**
1. Paste a real API key into the Connections panel, click Save.
2. In the Prompt box, select the provider + a valid model (e.g. `openai` / `gpt-4o-mini`).
3. Type a prompt, click Send. **Expected:** a real response renders.
   - For ollama: start `ollama serve` locally first, use model `llama3.2` or similar.

**Copilot (OAuth):**
1. Click "Connect copilot via OAuth".
2. A code + `github.com/login/device` URL appear. Open the URL, enter the code, authorize.
3. **Expected:** panel shows "copilot connected" within ~30s.
4. Prompt box: select `copilot`, model `gpt-4o`. Send a prompt. **Expected:** real response.
   - Note: the well-known client ID `Iv1.b507a08c87ecfe98` is what VS Code's Copilot extension uses. If GitHub rejects it from a third-party app, you may need to register your own OAuth app at github.com/settings/developers and update `copilot_config()` in `src-tauri/src/oauth_providers.rs`.

**Codex (OAuth):**
1. Click "Connect codex via OAuth".
2. Authorize at the OpenAI URL.
3. **Expected:** connected; prompt box with `codex` + an OpenAI model returns real responses.
   - Note: the `pdv_openai_codex` client ID and `auth.openai.com` endpoints are best-effort from public docs. **Live verification against OpenAI's actual device-flow may require adjusting these** — OpenAI's OAuth surface for Codex is less publicly documented than GitHub's. If `ai_start_oauth` errors, the endpoints in `codex_config()` are the place to correct.

**Claude Code (ACP):**
1. Ensure the `claude` CLI is installed (`npm install -g @anthropic-ai/claude-code` or similar) and supports `--acp`.
2. If your binary path differs, set it in the ACP config field (default `claude --acp`).
3. Prompt box: select `claude`, any model string (ACP ignores it — the agent picks). Send a prompt.
   - **Expected:** real Claude response. The app spawns the agent, runs initialize → session/new → session/prompt over JSON-RPC stdio.

## Known limits / future work

- **OAuth token refresh** not implemented. Access tokens expire; the current code does not refresh them. Add refresh-token handling in `oauth.rs` when a provider returns 401.
- **ACP session reuse.** Each completion spawns a fresh subprocess (no session continuity). Fine for one-shot prompts; multi-turn agentic work needs session pooling.
- **Open question for the user:** the Codex endpoints and Copilot client ID are best-effort from public docs. Live testing may require you to register your own OAuth apps and update the two `config()` fns. I flagged this honestly rather than asserting they're correct.
- **Phase 2 dependency:** the open-time capability prompt isn't built yet, so `ai_complete` works against any granted capability. Real documents will gate this.
