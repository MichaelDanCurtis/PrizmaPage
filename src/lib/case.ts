/// Selection case transforms (Word's "Change Case"). Pure string functions.
export function toUpperCase(s: string): string { return s.toUpperCase(); }
export function toLowerCase(s: string): string { return s.toLowerCase(); }

export function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function toSentenceCase(s: string): string {
  // Capitalize the first letter after each sentence terminator + space.
  return s.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
}
