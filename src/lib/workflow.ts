/// Workflow data model + execution engine (SP9).
///
/// A workflow is a directed graph of nodes connected by edges. Each node has a
/// type, a position on the canvas, and a params object (the blanks you fill in).
/// Execution runs nodes in topological order, threading outputs to inputs.

export type NodeType = "trigger" | "ai" | "create-doc" | "store" | "notify" | "mcp-call";

export interface WFNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  /// Type-specific params (prompt text, model, folder, tool name, etc.).
  params: Record<string, string>;
}

export interface WFEdge {
  /// "source:port" → "target:port". Ports are simple strings ("out"/"in" for now).
  from: string; // node id
  to: string; // node id
}

export interface Workflow {
  nodes: WFNode[];
  edges: WFEdge[];
}

export const NODE_TYPES: { type: NodeType; label: string; icon: string; color: string; description: string; paramFields: { key: string; label: string; placeholder: string }[] }[] = [
  {
    type: "trigger",
    label: "Trigger",
    icon: "⟡",
    color: "#b45309",
    description: "Starts the workflow. Fires when a memory with the given tag arrives, or manually.",
    paramFields: [{ key: "tag", label: "Tag to match", placeholder: "workflow" }],
  },
  {
    type: "ai",
    label: "AI step",
    icon: "✦",
    color: "#7c3aed",
    description: "Runs a prompt against the configured AI provider. Receives the upstream output as {{input}}.",
    paramFields: [
      { key: "prompt", label: "Prompt", placeholder: "Break down the incoming memory into its parts." },
      { key: "model", label: "Model", placeholder: "openai/gpt-4o" },
    ],
  },
  {
    type: "create-doc",
    label: "Create document",
    icon: "📄",
    color: "#15803d",
    description: "Creates N documents from the upstream content using AI.",
    paramFields: [
      { key: "count", label: "How many", placeholder: "5" },
      { key: "model", label: "Model", placeholder: "openai/gpt-4o" },
    ],
  },
  {
    type: "store",
    label: "Store in vault",
    icon: "📁",
    color: "#15803d",
    description: "Saves upstream documents into the vault folder.",
    paramFields: [{ key: "folder", label: "Folder", placeholder: "Claude Outbox" }],
  },
  {
    type: "notify",
    label: "Notify agent",
    icon: "🔔",
    color: "#0ea5e9",
    description: "Pings the originating agent that the workflow produced output.",
    paramFields: [{ key: "message", label: "Message", placeholder: "Documents are ready in the vault." }],
  },
  {
    type: "mcp-call",
    label: "Call MCP",
    icon: "🔌",
    color: "#64748b",
    description: "Calls an MCP tool exposed by PrizmaPage or an external server.",
    paramFields: [
      { key: "tool", label: "Tool name", placeholder: "vault.remember" },
      { key: "args", label: "Arguments (JSON)", placeholder: '{}' },
    ],
  },
];

export function nodeTypeDef(type: NodeType) {
  return NODE_TYPES.find((t) => t.type === type)!;
}

/// Execution result for one node.
export interface NodeResult {
  nodeId: string;
  ok: boolean;
  output?: string;
  error?: string;
}

/// Topological order of nodes (Kahn's algorithm). Returns ids in execution order.
/// If there's a cycle, returns the nodes in arbitrary order.
export function topoOrder(wf: Workflow): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of wf.nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of wf.edges) {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }
  const queue = wf.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) - 1);
      if ((inDegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  // Any nodes not reached (cycle) append at the end.
  for (const n of wf.nodes) {
    if (!order.includes(n.id)) order.push(n.id);
  }
  return order;
}

/// Find the upstream node for a given node (first edge pointing into it).
export function upstreamOf(wf: Workflow, nodeId: string): WFNode | null {
  const edge = wf.edges.find((e) => e.to === nodeId);
  if (!edge) return null;
  return wf.nodes.find((n) => n.id === edge.from) ?? null;
}
