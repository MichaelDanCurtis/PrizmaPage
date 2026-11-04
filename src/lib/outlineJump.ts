export interface Heading { level: number; text: string; pos: number; }

export function filterHeadings(headings: Heading[], query: string): Heading[] {
  const q = query.trim().toLowerCase();
  if (!q) return headings;
  return headings.filter((h) => h.text.toLowerCase().includes(q));
}
