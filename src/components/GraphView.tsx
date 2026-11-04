import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractWikilinks } from "../lib/backlinks";
import type { VaultEntry } from "../lib/vault";

interface Props {
  entries: VaultEntry[];
  activePath: string | null;
  onOpen: (path: string) => void;
}

interface GNode {
  id: string; // path
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface GEdge {
  source: string;
  target: string; // a note NAME (not path) — resolved against nodes
}

/// A lightweight force-directed graph of vault notes and their [[wikilinks]].
/// Renders as SVG; a simple repulsion + spring simulation runs for ~150 ticks
/// on mount or when entries change. No external graph dep.
export function GraphView({ entries, activePath, onOpen }: Props) {
  const notes = useMemo(() => entries.filter((e) => !e.is_folder), [entries]);
  const [contents, setContents] = useState<Record<string, string>>({});

  // Read each note's content to extract wikilinks (cached).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        notes.map(async (n) => {
          try {
            const doc = await invoke<{ content_md: string }>("open_document", { path: n.path });
            map[n.path] = doc.content_md;
          } catch {
            map[n.path] = "";
          }
        })
      );
      if (!cancelled) setContents(map);
    })();
    return () => { cancelled = true; };
  }, [notes.map((n) => n.path).join(",")]);

  // Build nodes + edges.
  const { nodes, edges } = useMemo(() => {
    const nameToPath = new Map<string, string>();
    for (const n of notes) {
      nameToPath.set(n.name.replace(/\.mdxz$/, "").toLowerCase(), n.path);
    }
    const gNodes: GNode[] = notes.map((n, i) => {
      const angle = (i / Math.max(notes.length, 1)) * Math.PI * 2;
      return {
        id: n.path,
        name: n.name.replace(/\.mdxz$/, ""),
        x: 200 + Math.cos(angle) * 80,
        y: 150 + Math.sin(angle) * 80,
        vx: 0,
        vy: 0,
      };
    });
    const gEdges: GEdge[] = [];
    for (const n of notes) {
      const content = contents[n.path] ?? "";
      for (const target of extractWikilinks(content)) {
        const targetPath = nameToPath.get(target.replace(/\.mdxz$/i, "").toLowerCase());
        if (targetPath && targetPath !== n.path) {
          gEdges.push({ source: n.path, target: targetPath });
        }
      }
    }
    return { nodes: gNodes, edges: gEdges };
  }, [notes, contents]);

  // Run a simple force simulation.
  const [simNodes, setSimNodes] = useState<GNode[]>(nodes);
  useEffect(() => {
    if (nodes.length === 0) return;
    let current = nodes.map((n) => ({ ...n }));
    const W = 400, H = 300;
    for (let tick = 0; tick < 150; tick++) {
      // Repulsion between all node pairs.
      for (let i = 0; i < current.length; i++) {
        for (let j = i + 1; j < current.length; j++) {
          const a = current[i], b = current[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 600 / (dist * dist);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // Spring attraction along edges.
      for (const e of edges) {
        const a = current.find((n) => n.id === e.source);
        const b = current.find((n) => n.id === e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (dist - 80) * 0.02;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Apply velocity with damping; clamp to bounds.
      for (const n of current) {
        n.vx *= 0.7; n.vy *= 0.7;
        n.x = Math.max(20, Math.min(W - 20, n.x + n.vx));
        n.y = Math.max(20, Math.min(H - 20, n.y + n.vy));
      }
    }
    setSimNodes(current);
  }, [nodes, edges]);

  if (notes.length === 0) {
    return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "8px 4px" }}>No notes to graph.</div>;
  }

  const W = 400, H = 300;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 400, height: "auto" }}>
      {/* Edges */}
      {edges.map((e, i) => {
        const a = simNodes.find((n) => n.id === e.source);
        const b = simNodes.find((n) => n.id === e.target);
        if (!a || !b) return null;
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--border)" strokeWidth={1} />
        );
      })}
      {/* Nodes */}
      {simNodes.map((n) => {
        const isActive = n.id === activePath;
        return (
          <g key={n.id} onClick={() => onOpen(n.id)} style={{ cursor: "pointer" }}>
            <circle
              cx={n.x}
              cy={n.y}
              r={isActive ? 7 : 5}
              fill={isActive ? "var(--accent)" : "var(--text-muted)"}
            />
            <text
              x={n.x}
              y={n.y - 10}
              textAnchor="middle"
              fontSize={8}
              fill="var(--text-muted)"
              fontFamily="var(--font-sans)"
            >
              {n.name.length > 12 ? n.name.slice(0, 11) + "…" : n.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
