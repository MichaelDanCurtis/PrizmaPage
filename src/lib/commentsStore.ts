/// Comments are stored per-doc-path in localStorage (a side-channel, not in
/// the .mdxz format) to seed the collaboration data model without a format
/// break. Anchors use selection text (stable across edits, unlike positions).

export interface Comment {
  id: string;
  anchor: string; // the selection text the comment is attached to
  body: string;
  author: string;
  ts: number;
  resolved: boolean;
}

export interface NewComment {
  anchor: string;
  body: string;
  author?: string;
}

const key = (docPath: string) => `prizma.comments.${docPath}`;

function read(docPath: string): Comment[] {
  try {
    const raw = localStorage.getItem(key(docPath));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function write(docPath: string, comments: Comment[]): void {
  try { localStorage.setItem(key(docPath), JSON.stringify(comments)); } catch { /* quota */ }
}

let idCounter = 0;
const newId = () => `c${Date.now()}-${idCounter++}`;

export function addComment(docPath: string, c: NewComment): Comment {
  const comment: Comment = {
    id: newId(),
    anchor: c.anchor,
    body: c.body,
    author: c.author ?? "you",
    ts: Date.now(),
    resolved: false,
  };
  write(docPath, [...read(docPath), comment]);
  return comment;
}

export function listComments(docPath: string): Comment[] {
  return read(docPath);
}

export function resolveComment(docPath: string, id: string): void {
  write(docPath, read(docPath).map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)));
}

export function clearComments(docPath: string): void {
  localStorage.removeItem(key(docPath));
}
