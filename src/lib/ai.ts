import { invoke } from "@tauri-apps/api/core";

/// Open a URL in the system default browser (NOT a new webview window).
/// Used for OAuth: opens the verification page / authorize URL in the user's
/// real browser where they're already logged in to GitHub/OpenAI.
export function openInBrowser(url: string): Promise<void> {
  return invoke("open_in_browser", { url });
}

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

/// List the models a provider offers. Fetches LIVE from the provider's models
/// endpoint — never hardcoded. Returns an empty array if the provider can't
/// enumerate (in which case the user types a model name manually).
export function listModels(provider: string): Promise<string[]> {
  return invoke<string[]>("ai_list_models", { provider });
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

// ===== Author-time component generation =====

/// There is NO hardcoded default model map. The model list is fetched LIVE
/// from each provider's /models endpoint via listModels(). This stub exists
/// only as a fallback for code paths that need a string before the user has
/// picked one — it returns empty, and the UI must prompt the user to choose.
export function defaultModelFor(_provider: string): string {
  return "";
}

// Kept for backward compat with older imports; no longer a real map.
export const DEFAULT_MODELS: Record<string, string> = {};

/// Generate a component's JSX from a natural-language prompt. This is an
/// author-time affordance (editor only) — NOT gated by the document's
/// runtime capabilities, per the architecture's "AI generation is author-time
/// only" decision.
export function aiAuthorComponent(
  provider: string,
  model: string,
  prompt: string
): Promise<string> {
  return invoke<string>("ai_author_component", { provider, model, prompt });
}

