import type { Workflow } from "./workflow";

export interface WorkflowMeta { name: string; savedAt: number; }

const key = (name: string) => `prizma.workflow.${name}`;
const INDEX_KEY = "prizma.workflow.index";

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function writeIndex(names: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(names));
}

export function saveWorkflow(name: string, wf: Workflow): void {
  try {
    localStorage.setItem(key(name), JSON.stringify({ wf, savedAt: Date.now() }));
    const names = readIndex();
    if (!names.includes(name)) writeIndex([...names, name]);
  } catch { /* quota */ }
}

export function listWorkflows(): WorkflowMeta[] {
  return readIndex()
    .map((name) => {
      try {
        const raw = localStorage.getItem(key(name));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return { name, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0 };
      } catch {
        return null;
      }
    })
    .filter((x): x is WorkflowMeta => x !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function loadWorkflow(name: string): Workflow | null {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.wf ?? null;
  } catch {
    return null;
  }
}

export function deleteWorkflow(name: string): void {
  localStorage.removeItem(key(name));
  writeIndex(readIndex().filter((n) => n !== name));
}
