export type PasteStrategy = "plain" | "html" | "markdown" | "link";
export interface PasteInput { text: string; html: string | null; hasSelection: boolean; }

const MARKDOWN_CAP = 4096;

export function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

export function isLikelyMarkdown(s: string): boolean {
  if (s.length > MARKDOWN_CAP) return false;
  return /^#{1,6}\s/m.test(s)
    || /^[*+-]\s/m.test(s)
    || /^\d+\.\s/m.test(s)
    || /\*\*[^*]+\*\*/.test(s)
    || /`[^`]+`/.test(s)
    || /\[[^\]]+\]\([^)]+\)/.test(s);
}

/// Decide how to handle a paste event. Order: URL-over-selection → link;
/// HTML present → html (TipTap default); markdown-looking plain text → markdown;
/// else plain.
export function classifyPaste(input: PasteInput): PasteStrategy {
  const { text, html, hasSelection } = input;
  if (hasSelection && isUrl(text)) return "link";
  if (html) return "html";
  if (isLikelyMarkdown(text)) return "markdown";
  return "plain";
}
