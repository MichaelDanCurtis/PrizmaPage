export interface Shortcut { group: string; keys: string; description: string; }
const M = "Cmd"; // display; works for Ctrl on Windows/Linux too.

export const SHORTCUTS: Shortcut[] = [
  { group: "File", keys: `${M}+S`, description: "Save" },
  { group: "Edit", keys: `${M}+Z`, description: "Undo" },
  { group: "Edit", keys: `${M}+Shift+Z`, description: "Redo" },
  { group: "Edit", keys: `${M}+B`, description: "Bold" },
  { group: "Edit", keys: `${M}+I`, description: "Italic" },
  { group: "Edit", keys: `${M}+/`, description: "Show keyboard shortcuts" },
  { group: "Find", keys: `${M}+F`, description: "Find" },
  { group: "Find", keys: `${M}+H`, description: "Replace" },
  { group: "Find", keys: `${M}+G`, description: "Next / previous match" },
  { group: "View", keys: `${M}+1`, description: "Toggle files pane" },
  { group: "View", keys: `${M}+2`, description: "Toggle outline/backlinks/graph pane" },
  { group: "View", keys: `${M}+3`, description: "Toggle AI pane" },
  { group: "View", keys: `${M}+K`, description: "AI command palette" },
  { group: "View", keys: `${M}+Shift+F`, description: "Search vault" },
  { group: "View", keys: `${M}.`, description: "Toggle focus mode" },
  { group: "View", keys: `${M}+Shift+R`, description: "Toggle reading ruler" },
  { group: "Navigate", keys: `${M}+Shift+O`, description: "Jump to heading" },
];
