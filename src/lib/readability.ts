/// Extended document statistics: sentence count, average word length, a
/// Flesch reading-ease score, and the top frequent words (stopwords excluded).
/// Pure TS string math — Word's "Readability Statistics" dialog.

export interface WordFreq { word: string; count: number; }
export interface Readability {
  sentences: number;
  avgWordLength: number;
  fleschScore: number; // reading-ease, higher = easier
  topWords: WordFreq[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "is", "are",
  "was", "were", "be", "been", "being", "it", "this", "that", "these", "those",
  "for", "with", "as", "by", "i", "you", "he", "she", "we", "they", "his", "her",
]);

/// Rough syllable count for a word (vowel-group heuristic). Good enough for a
/// reading-level estimate, not a phonetics engine.
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 1;
  if (w.endsWith("e")) n = Math.max(1, n - 1);
  return n;
}

export function computeReadability(text: string): Readability {
  const trimmed = text.trim();
  if (!trimmed) return { sentences: 0, avgWordLength: 0, fleschScore: 0, topWords: [] };

  const sentences = (trimmed.match(/[.!?]+(\s|$)/g) || []).length || 1;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length || 1;
  const totalChars = words.reduce((sum, w) => sum + w.replace(/[^a-z0-9]/gi, "").length, 0);
  const avgWordLength = Math.round((totalChars / wordCount) * 10) / 10;

  const totalSyllables = words.reduce((sum, w) => sum + syllables(w), 0);
  // Flesch reading ease: 206.835 − 1.015(words/sentences) − 84.6(syllables/words)
  const fleschScore = Math.round(
    (206.835 - 1.015 * (wordCount / sentences) - 84.6 * (totalSyllables / wordCount)) * 10
  ) / 10;

  const freq = new Map<string, number>();
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-z0-9']/g, "");
    if (!clean || STOPWORDS.has(clean)) continue;
    freq.set(clean, (freq.get(clean) ?? 0) + 1);
  }
  const topWords: WordFreq[] = Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { sentences, avgWordLength, fleschScore, topWords };
}
