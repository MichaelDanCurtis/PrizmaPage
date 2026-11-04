export interface Draft { contentMd: string; ts: number; }

const key = (path: string) => `prizma.draft.${path}`;

export function writeDraft(path: string, contentMd: string, ts: number): void {
  try { localStorage.setItem(key(path), JSON.stringify({ contentMd, ts })); } catch { /* quota */ }
}
export function readDraft(path: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(path));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.contentMd === "string" && typeof d.ts === "number") return d;
    return null;
  } catch { return null; }
}
export function clearDraft(path: string): void {
  localStorage.removeItem(key(path));
}
