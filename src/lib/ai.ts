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

/// Completes a prompt. Messages are sent as [role, content] tuples to match
/// the Rust bridge signature.
export function complete(req: CompleteRequest): Promise<CompletionResponse> {
  return invoke<CompletionResponse>("ai_complete", {
    provider: req.provider,
    model: req.model,
    messages: req.messages.map((m) => [m.role, m.content] as [string, string]),
  });
}
