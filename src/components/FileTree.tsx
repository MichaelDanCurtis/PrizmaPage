import { useState } from "react";
import type { VaultEntry } from "../lib/vault";

interface Props {
  entries: VaultEntry[];
  activePath: string | null;
  onOpen: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
  onNewNote: (parentFolderPath: string) => void;
}

interface TreeNode {
  entry: VaultEntry;
  children: TreeNode[];
}

/// Build a nested tree from the flat entries list by matching path prefixes.
function buildTree(entries: VaultEntry[], rootPath: string): TreeNode[] {
  // Normalize: entries are absolute paths. Group by whether their parent is rootPath.
  const direct: VaultEntry[] = [];
  const nested: VaultEntry[] = [];
  for (const e of entries) {
    const parent = e.path.substring(0, e.path.length - e.name.length - 1);
    if (parent === rootPath) direct.push(e);
    else nested.push(e);
  }
  return direct
    .sort((a, b) => (b.is_folder ? 1 : 0) - (a.is_folder ? 1 : 0) || a.name.localeCompare(b.name))
    .map((entry) => ({
      entry,
      children: entry.is_folder ? buildTree(nested, entry.path) : [],
    }));
}

export function FileTree({ entries, activePath, onOpen, onRename, onDelete, onNewNote }: Props) {
  const rootPath = entries[0]?.path.substring(0, entries[0]?.path.length - entries[0]?.name.length - 1) ?? "";
  const tree = buildTree(entries, rootPath);
  return (
    <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text)" }}>
      {tree.map((node) => (
        <TreeRow
          key={node.entry.path}
          node={node}
          depth={0}
          activePath={activePath}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          onNewNote={onNewNote}
        />
      ))}
      {entries.length === 0 && (
        <div style={{ color: "var(--text-faint)", fontSize: 11, padding: "4px 0" }}>No notes.</div>
      )}
    </div>
  );
}

function TreeRow({
  node,
  depth,
  activePath,
  onOpen,
  onRename,
  onDelete,
  onNewNote,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  onOpen: (p: string) => void;
  onRename: (p: string, n: string) => void;
  onDelete: (p: string) => void;
  onNewNote: (folder: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const { entry } = node;
  const isActive = activePath === entry.path;
  const displayName = entry.is_folder ? entry.name : entry.name.replace(/\.mdxz$/, "");

  const open = () => {
    if (entry.is_folder) setExpanded((v) => !v);
    else onOpen(entry.path);
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={open}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuFor(entry.path);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 6px",
          paddingLeft: 6 + depth * 12,
          cursor: "pointer",
          borderRadius: "var(--radius-sm)",
          background: isActive ? "var(--accent-soft)" : "transparent",
          color: isActive ? "var(--accent)" : "var(--text)",
          fontWeight: isActive ? 600 : 400,
          font: "var(--font-small)",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-muted)"; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ width: 12, fontSize: 9, color: "var(--text-faint)" }}>
          {entry.is_folder ? (expanded ? "▾" : "▸") : "📄"}
        </span>
        <span>{displayName}</span>
      </div>

      {menuFor === entry.path && (
        <div
          style={{
            position: "absolute",
            left: 6 + depth * 12,
            top: "100%",
            zIndex: 50,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            padding: 4,
            fontSize: 11,
          }}
        >
          {entry.is_folder && (
            <div
              onClick={() => { onNewNote(entry.path); setMenuFor(null); }}
              style={{ padding: "4px 10px", cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              + New note here
            </div>
          )}
          <div
            onClick={() => {
              const newName = window.prompt("New name", displayName);
              if (newName && newName !== displayName) onRename(entry.path, newName);
              setMenuFor(null);
            }}
            style={{ padding: "4px 10px", cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Rename
          </div>
          <div
            onClick={() => {
              if (window.confirm(`Delete ${displayName}?`)) onDelete(entry.path);
              setMenuFor(null);
            }}
            style={{ padding: "4px 10px", cursor: "pointer", color: "#dc2626", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Delete
          </div>
        </div>
      )}

      {entry.is_folder && expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
              onNewNote={onNewNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
