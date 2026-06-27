import { useEffect, useRef, useState } from "react";
import {
  NODE_TYPES,
  nodeTypeDef,
  type Workflow,
  type WFNode,
  type NodeType,
  type NodeResult,
} from "../lib/workflow";
import { runWorkflow } from "../lib/workflowRunner";
import { saveWorkflow, listWorkflows, loadWorkflow, deleteWorkflow } from "../lib/workflowStore";

const DRAFT_KEY = "__draft__";

interface Props {
  vaultPath: string | null;
  provider: string | null;
  model: string;
  onClose: () => void;
}

const CANVAS_W = 900;
const CANVAS_H = 560;
const NODE_W = 150;
const NODE_H = 70;

let idCounter = 1;
const newId = () => `n${idCounter++}`;

/// Visual workflow canvas: drag nodes from a palette, position by dragging,
/// connect by clicking a node's output then a target's input, edit params in a
/// side panel, and Run executes the graph.
export function WorkflowCanvas({ vaultPath, provider, model, onClose }: Props) {
  const [wf, setWf] = useState<Workflow>(() => loadWorkflow(DRAFT_KEY) ?? { nodes: [], edges: [] });
  const [library, setLibrary] = useState(() => listWorkflows());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, NodeResult>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // SP9: auto-save the draft whenever the workflow changes.
  useEffect(() => {
    saveWorkflow(DRAFT_KEY, wf);
  }, [wf]);
  const refreshLibrary = () => setLibrary(listWorkflows());

  const saveAs = () => {
    const name = window.prompt("Save workflow as", "my-workflow");
    if (!name) return;
    saveWorkflow(name, wf);
    refreshLibrary();
  };
  const openNamed = (name: string) => {
    const loaded = loadWorkflow(name);
    if (loaded) setWf(loaded);
  };
  const removeNamed = (name: string) => {
    deleteWorkflow(name);
    refreshLibrary();
  };

  const addNode = (type: NodeType) => {
    const id = newId();
    const node: WFNode = {
      id,
      type,
      x: 60 + Math.random() * 400,
      y: 60 + Math.random() * 300,
      params: {},
    };
    setWf((w) => ({ ...w, nodes: [...w.nodes, node] }));
    setSelected(id);
  };

  const startDrag = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const node = wf.nodes.find((n) => n.id === id);
    if (!node) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
  };

  const onCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(CANVAS_W - NODE_W, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(CANVAS_H - NODE_H, e.clientY - rect.top - dragOffset.y));
    setWf((w) => ({
      ...w,
      nodes: w.nodes.map((n) => (n.id === dragging ? { ...n, x, y } : n)),
    }));
  };

  const onCanvasMouseUp = () => setDragging(null);

  const clickOutput = (id: string) => {
    setConnectFrom(connectFrom === id ? null : id);
  };

  const clickInput = (id: string) => {
    if (!connectFrom || connectFrom === id) {
      setConnectFrom(null);
      return;
    }
    setWf((w) => ({
      ...w,
      edges: [...w.edges.filter((e) => !(e.from === connectFrom && e.to === id)), { from: connectFrom, to: id }],
    }));
    setConnectFrom(null);
  };

  const updateParam = (nodeId: string, key: string, value: string) => {
    setWf((w) => ({
      ...w,
      nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n)),
    }));
  };

  const deleteNode = (id: string) => {
    setWf((w) => ({
      nodes: w.nodes.filter((n) => n.id !== id),
      edges: w.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    setSelected(null);
  };

  const run = async () => {
    if (!provider || !vaultPath) return;
    setRunning(true);
    setResults({});
    await runWorkflow(wf, {
      vaultPath,
      provider,
      defaultModel: model,
      triggerInput: "(manual run)",
      onNodeComplete: (r) => setResults((prev) => ({ ...prev, [r.nodeId]: r })),
    });
    setRunning(false);
  };

  const selectedNode = wf.nodes.find((n) => n.id === selected);

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 300, display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--bg)" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>⚡ Workflow canvas</span>
        {connectFrom && <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 12 }}>Click a target node's input to connect…</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={run}
            disabled={running || !provider || wf.nodes.length === 0}
            style={{
              background: running ? "var(--accent-border)" : "var(--accent)",
              color: "white",
              border: "none",
              padding: "5px 16px",
              borderRadius: "var(--radius)",
              fontSize: 12,
              cursor: running ? "wait" : "pointer",
              opacity: !provider || wf.nodes.length === 0 ? 0.5 : 1,
            }}
          >
            {running ? "Running…" : "▶ Run"}
          </button>
          <button onClick={saveAs} title="Save workflow as…" style={{ background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "5px 12px", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer" }}>💾 Save as</button>
          <select
            onChange={(e) => { if (e.target.value) openNamed(e.target.value); e.target.value = ""; }}
            value=""
            title="Open a saved workflow"
            style={{ background: "var(--bg-muted)", color: "var(--text-muted)", border: "1px solid var(--border)", padding: "5px 8px", borderRadius: "var(--radius)", fontSize: 12, cursor: "pointer", maxWidth: 140 }}
          >
            <option value="">📂 Library…</option>
            {library.filter((w) => w.name !== DRAFT_KEY).map((w) => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </select>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Palette */}
        <div style={{ width: 160, borderRight: "1px solid var(--border-soft)", padding: 10, overflow: "auto", background: "var(--bg-muted)" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-faint)", marginBottom: 8 }}>Nodes</div>
          {NODE_TYPES.map((t) => (
            <div
              key={t.type}
              onClick={() => addNode(t.type)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                marginBottom: 4,
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                background: "var(--bg)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg)")}
            >
              <span style={{ fontSize: 14, color: t.color }}>{t.icon}</span>
              <span style={{ fontSize: 11, color: "var(--text)" }}>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onClick={() => { setSelected(null); setConnectFrom(null); }}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            backgroundImage: "radial-gradient(var(--border-soft) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            background: "var(--bg-muted)",
          }}
        >
          {/* Edges (SVG) */}
          <svg style={{ position: "absolute", inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: "none" }}>
            {wf.edges.map((e, i) => {
              const a = wf.nodes.find((n) => n.id === e.from);
              const b = wf.nodes.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2;
              const x2 = b.x, y2 = b.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="var(--accent)" strokeWidth={2} fill="none" />
              );
            })}
          </svg>

          {/* Nodes */}
          {wf.nodes.map((n) => {
            const def = nodeTypeDef(n.type);
            const res = results[n.id];
            const isConnSource = connectFrom === n.id;
            return (
              <div
                key={n.id}
                onMouseDown={(e) => startDrag(e, n.id)}
                onClick={(e) => { e.stopPropagation(); setSelected(n.id); }}
                style={{
                  position: "absolute",
                  left: n.x,
                  top: n.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  background: "var(--bg)",
                  border: `2px solid ${selected === n.id ? "var(--accent)" : res?.ok === false ? "#dc2626" : res?.ok ? "#22c55e" : def.color}`,
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  cursor: "move",
                  padding: "6px 10px",
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text)" }}>
                  <span style={{ color: def.color }}>{def.icon}</span>
                  <span style={{ fontWeight: 600 }}>{def.label}</span>
                </div>
                {/* Output port (right) */}
                <div
                  onClick={(e) => { e.stopPropagation(); clickOutput(n.id); }}
                  title="Drag from here to connect"
                  style={{
                    position: "absolute",
                    right: -7,
                    top: "50%",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: isConnSource ? "var(--accent)" : "var(--bg)",
                    border: "2px solid var(--accent)",
                    cursor: "crosshair",
                    transform: "translateY(-50%)",
                  }}
                />
                {/* Input port (left) */}
                {n.type !== "trigger" && (
                  <div
                    onClick={(e) => { e.stopPropagation(); clickInput(n.id); }}
                    title="Connect to here"
                    style={{
                      position: "absolute",
                      left: -7,
                      top: "50%",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "var(--bg)",
                      border: "2px solid var(--text-muted)",
                      cursor: "crosshair",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
                {res && (
                  <div style={{ marginTop: 4, fontSize: 9, color: res.ok ? "#15803d" : "#dc2626" }}>
                    {res.ok ? "✓ done" : "✗ error"}
                  </div>
                )}
              </div>
            );
          })}

          {wf.nodes.length === 0 && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "var(--text-faint)", fontSize: 13 }}>
              Click a node type on the left to add it to the canvas.
            </div>
          )}
        </div>

        {/* Params panel */}
        {selectedNode && (
          <div style={{ width: 220, borderLeft: "1px solid var(--border-soft)", padding: 12, overflow: "auto", background: "var(--bg)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {nodeTypeDef(selectedNode.type).icon} {nodeTypeDef(selectedNode.type).label}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.4 }}>
              {nodeTypeDef(selectedNode.type).description}
            </div>
            {nodeTypeDef(selectedNode.type).paramFields.map((f) => (
              <div key={f.key} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>{f.label}</label>
                {f.key === "prompt" ? (
                  <textarea
                    value={selectedNode.params[f.key] ?? ""}
                    onChange={(e) => updateParam(selectedNode.id, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    value={selectedNode.params[f.key] ?? ""}
                    onChange={(e) => updateParam(selectedNode.id, f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => deleteNode(selectedNode.id)} style={{ fontSize: 10, background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
                Delete node
              </button>
            </div>
            {results[selectedNode.id]?.output && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>Output</div>
                <pre style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "var(--bg-muted)", padding: 6, borderRadius: "var(--radius-sm)", margin: 0, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>
                  {results[selectedNode.id].output}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 11,
  fontFamily: "var(--font-sans)",
  color: "var(--text)",
  background: "var(--bg)",
  outline: "none",
  boxSizing: "border-box",
};
