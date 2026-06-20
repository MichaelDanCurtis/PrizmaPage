import { invoke } from "@tauri-apps/api/core";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface CompletionResponse {
  text: string;
}

export interface CompleteRequest {
  provider: string;
  model: string;
  messages: ChatMessage[];
}

export function listProviders(): Promise<string[]> {
  return invoke<string[]>("ai_list_providers");
}

export function setApiKey(provider: string, apiKey: string): Promise<void> {
  return invoke("ai_set_api_key", { provider, apiKey });
}

export function clearApiKey(provider: string): Promise<void> {
  return invoke("ai_clear_api_key", { provider });
}

export function hasApiKey(provider: string): Promise<boolean> {
  return invoke<boolean>("ai_has_api_key", { provider });
}

// ===== OAuth device-flow (Copilot, Codex) =====

export interface OAuthInstructions {
  user_code: string;
  verification_uri: string;
}

/// Step 1 of device flow: request a code. Returns what to show the user.
export function startOAuth(provider: string): Promise<OAuthInstructions> {
  return invoke<OAuthInstructions>("ai_start_oauth", { provider });
}

/// Step 2 of device flow: poll once. Returns "pending" or "complete".
export function pollOAuth(provider: string): Promise<string> {
  return invoke<string>("ai_poll_oauth", { provider });
}

/// Drive the full device flow with UI callbacks. Polls every `intervalMs`
/// until "complete" or an error, surfacing the user code/URL first.
export async function runOAuthFlow(
  provider: string,
  onInstructions: (i: OAuthInstructions) => void,
  intervalMs = 2000,
  maxPolls = 60
): Promise<void> {
  const instructions = await startOAuth(provider);
  onInstructions(instructions);
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const status = await pollOAuth(provider);
    if (status === "complete") return;
    // "pending" → keep polling. Any other value throws via invoke error.
  }
  throw new Error("OAuth timed out waiting for user authorization");
}

// ===== Codex PKCE (auth-code + PKCE, not device flow) =====

export interface PkceAuthRequest {
  url: string;
  state: string;
}

/// Codex PKCE step 1: build the authorization URL. The UI opens this in the
/// user's browser, then calls awaitCodexCallback to block on the redirect.
export function startCodexPkce(): Promise<PkceAuthRequest> {
  return invoke<PkceAuthRequest>("ai_start_codex_pkce");
}

/// Codex PKCE step 2: block on the localhost callback + exchange the code.
/// Resolves on success; rejects on timeout/error.
export function awaitCodexCallback(): Promise<void> {
  return invoke("ai_await_codex_callback");
}

/// Drive the full Codex PKCE flow with UI callbacks. Opens the URL via the
/// caller, then waits for the callback redirect.
export async function runCodexPkceFlow(
  onAuthUrl: (url: string) => void
): Promise<void> {
  const req = await startCodexPkce();
  onAuthUrl(req.url);
  await awaitCodexCallback();
}

// ===== ACP (Claude Code) =====

/// Configure the ACP agent binary. Default is `claude-agent-acp` (the official
/// @agentclientprotocol/claude-agent-acp adapter — Claude Code itself does not
/// expose ACP via a CLI flag). Lets the user point at a custom adapter path.
export function setAcpBinary(binary: string, args: string[]): Promise<void> {
  return invoke("ai_set_acp_binary", { binary, args });
}

/// Completes a prompt. Messages are sent as [role, content] tuples to match
/// the Rust bridge signature.
export function complete(req: CompleteRequest): Promise<CompletionResponse> {
  return invoke<CompletionResponse>("ai_complete", {
    provider: req.provider,
    model: req.model,
    messages: req.messages.map((m) => [m.role, m.content] as [string, string]),
  });
}
