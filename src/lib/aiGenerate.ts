import { invoke } from "@tauri-apps/api/core";
import { stripFences } from "./aiComponent";

/// Generate a full document's MDX from a prompt. Returns raw model output.
export function generateDocument(provider: string, model: string, prompt: string): Promise<string> {
  return invoke<string>("ai_generate_document", { provider, model, prompt, selection: null });
}

/// Edit a text selection. Returns replacement MDX for the selection.
export function editSelection(provider: string, model: string, prompt: string, selection: string): Promise<string> {
  return invoke<string>("ai_generate_document", { provider, model, prompt, selection });
}

/// Convenience: generate + strip code fences in one step.
export async function generateDocumentClean(provider: string, model: string, prompt: string): Promise<string> {
  return stripFences(await generateDocument(provider, model, prompt));
}
export async function editSelectionClean(provider: string, model: string, prompt: string, selection: string): Promise<string> {
  return stripFences(await editSelection(provider, model, prompt, selection));
}

/// Inline completion: ask the model to continue the given paragraph text.
/// Returns the raw continuation (caller trims).
export function completeInline(provider: string, model: string, text: string): Promise<string> {
  return invoke<string>("ai_complete_inline", { provider, model, text });
}

/// Vault-wide chat: ask the model a question about the whole vault. Rust reads
/// all notes and includes them as context.
export function vaultChat(provider: string, model: string, vaultPath: string, question: string): Promise<string> {
  return invoke<string>("vault_chat", { provider, model, vaultPath, question });
}
