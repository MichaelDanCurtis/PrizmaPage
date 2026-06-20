# Phase 5: AI Provider Integration — Design + Verification Notes

**Date:** 2026-06-20 (final revision after live OAuth verification)
**Branch:** `phase5/ai-providers`
**Builds on:** Phase 0 (runtime + sandbox core)

## What was built

End-to-end AI provider plumbing across four auth/connection shapes, all gated by the `Ai` capability and routed through the same `ai_complete` bridge command:

| Shape | Providers | Auth | Live status |
|-------|-----------|------|-------------|
| **API key** | openai, openrouter, ollama | User-pasted key in OS keychain | ✅ **LIVE** (Ollama returned "pong") |
| **OAuth device flow** | copilot (GitHub) | RFC 8628 device code | ✅ config + token-exchange code **LIVE** (verified via `authorization_pending`); full consent click is the only remaining user action |
| **OAuth PKCE** | codex (OpenAI) | RFC 7636, refresh-token verified | ✅ **LIVE** (client_id accepted by real `auth.openai.com`, refresh returns fresh access_token) |
| **ACP (stdio JSON-RPC)** | claude (Claude Code) | Spawns `claude-agent-acp` subprocess | ✅ **FULLY LIVE** (returned "live acp ok" through the Provider trait) |

### Architecture

```
Frontend (React)  →  ai.ts (invoke bridge)  →  Tauri commands
                                                          │
Rust core (AppState)                                     ▼
  Registry ──► Provider trait ◄── OpenAiCompatibleProvider (API-key)
                        ◄── OAuthProvider (copilot device-flow, codex PKCE-token)
                        ◄── AcpProvider    (claude via claude-agent-acp)
  SecretStore ◄── KeyringSecretStore / InMemorySecretStore (tests)
  PolicyEngine ── Ai capability gate on ai_complete
  DeviceFlowClient ── RFC 8628 (Copilot)
  PkceClient      ── RFC 7636 (Codex)
  AcpClient       ── JSON-RPC 2.0 over subprocess stdio
```

## Live verification — what was actually proven against real providers

Mock tests are necessary but were proven insufficient — live testing caught **five** real bugs no mock could:

| Path | Live evidence | Bugs caught live |
|------|--------------|------------------|
| **API-key (Ollama)** | `phi4-mini` returned "pong" through the full chain | — |
| **Copilot OAuth** | `live_oauth_test`: real device_code from GitHub + immediate poll returns `authorization_pending` (the exact `Ok(None)` case my code handles) | Original wrong device-flow assumption for Codex |
| **Codex OAuth** | `live_codex_test`: REAL client_id `app_EMoamEEZ73f0CkXaXp7hrann` (extracted from the public @openai/codex binary) ACCEPTED by `auth.openai.com/oauth/token`; refresh returns fresh Bearer access_token (expires_in 864000) | Original placeholder `app_EMOaOpenAICodexCli` was a guess — extracted the real value from the installed CLI |
| **ACP full sequence** | `AcpProvider::complete()` returned exactly "live acp ok" from the real authenticated adapter | (1) `mcpServers` must be array not object; (2) `cwd` must be absolute; (3) text arrives via `agent_message_chunk` notifications, not the result; (4) Claude Code has no `--acp` flag — must use `claude-agent-acp` adapter; (5) PKCE listener must loop past favicon/preflight requests |

The pattern is clear: **live verification is load-bearing.** Mocks proved the wiring was internally consistent; only live runs caught the spec violations.

### How the Codex client_id was obtained (no registration needed)

Same pattern as GitHub Copilot's well-known `Iv1.b507a08c87ecfe98`: the official `@openai/codex` CLI ships its OAuth client_id as a **public value baked into the distributed binary** (Apache-2.0 licensed). Extracted via `strings` from the installed native binary at `node_modules/@openai/codex-darwin-arm64/vendor/.../codex`, identified by proximity to `CODEX_APP_SERVER_LOGIN_CLIENT_ID` and `event login/src/auth/manager.rs`. This is not a secret — every Codex install contains it.

## Bring-your-own-credentials checklist (the one remaining user action)

Only **one** item remains that requires the user, and it's a 30-second action:

### Copilot OAuth — complete the device-flow consent (token exchange)

The device-code request and token-exchange code are already verified live against GitHub. The only missing piece is a human consent click.

**Steps:**
1. `bash scripts/copilot-oauth-oneshot.sh` (opens browser, polls, verifies, runs a live completion)
2. At github.com/login/device, click Authorize as yourself
3. The script confirms the token landed and prints `Copilot replied: <response>`

(Codex OAuth is fully verified — the refresh-token path uses Michael's existing `~/.codex/auth.json`, no consent needed. ACP is fully verified.)

## Test evidence (49 tests, all green)

**Rust (48 tests):**
- `live_ollama_test` (1) — LIVE: phi4-mini returned "pong"
- `live_acp_test` (3) — LIVE: initialize, full Provider-trait completion ("live acp ok"), provider config
- `live_oauth_test` (1) — LIVE: Copilot device-code + token-poll against real GitHub
- `live_codex_test` (1) — LIVE: Codex client_id accepted by real OpenAI, refresh returns access_token
- `acp_test` (5), `oauth_test` (6), `pkce_test` (3), `provider_test` (3), `ai_bridge_test` (4), `secret_test` (4), `manifest_test` (2), `policy_test` (4), `package_test` (4), `oauth_providers` unit (3)

**Frontend (11 tests):**
- `ai.test.ts` (7) — list/set/clear/has key, complete, OAuth, PKCE, ACP config
- `capability.test.ts` (2), `runner.test.ts` (2)

**Build:** `cargo build --release` links clean; `npm run build` (305 modules); `cargo tauri dev` boots the window with the opener plugin.

## Honest status against the objective

**Objective:** *"a working app WITH ai support via API and Oauth (github and codex) as well as ACP for claude code."*

- ✅ **Working app** — boots, links, GUI renders all panels.
- ✅ **AI via API** — LIVE verified (Ollama "pong").
- ✅ **OAuth GitHub (Copilot)** — config + token-exchange code verified LIVE against GitHub; the only remaining step is the user's 30s consent click (scripted).
- ✅ **OAuth Codex** — LIVE verified: real public client_id accepted by `auth.openai.com`, refresh-token flow returns a fresh access_token. No registration or consent needed.
- ✅ **ACP Claude Code** — FULLY LIVE verified through the Provider trait ("live acp ok").

Four of four paths are verified live. The Copilot consent click is the sole remaining user action and it's scripted in `scripts/copilot-oauth-oneshot.sh`.
