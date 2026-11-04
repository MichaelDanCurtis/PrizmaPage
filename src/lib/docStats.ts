export interface DocStats {
  words: number;
  characters: number;
  readingMinutes: number;
}

const WPM = 200;

/// Whole-document statistics. `text` is the document's plain text
/// (e.g. ProseMirror's `textBetween(0, size, " ")`). Characters count the
/// trimmed text (interior spaces included; pure-whitespace docs report 0).
/// Reading time rounds up at 200 wpm, min 1 when there are any words.
export function computeStats(text: string): DocStats {
  const trimmed = text.trim();
  const characters = trimmed.length;
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const readingMinutes = words === 0 ? 0 : Math.ceil(words / WPM);
  return { words, characters, readingMinutes };
}
