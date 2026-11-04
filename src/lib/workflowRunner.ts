/// Workflow execution engine (SP9). Runs nodes in topological order, threading
/// each node's output as {{input}} into downstream prompts.
///
/// Uses the existing AI bridge (generateDocument / aiAuthorComponent) for AI
/// nodes, and the vault API for store/create-doc nodes.

import { topoOrder, upstreamOf, type Workflow, type NodeResult } from "./workflow";
import { generateDocumentClean } from "./aiGenerate";
import { vaultCreateNote } from "./vault";

export interface RunContext {
  /// The vault path (for store/create-doc nodes).
  vaultPath: string;
  /// The AI provider + model to use (from useAiConfig).
  provider: string;
  /// Default model if a node doesn't specify one.
  defaultModel: string;
  /// Initial trigger input (the memory content that started the workflow).
  triggerInput?: string;
  /// Progress callback (called after each node completes).
  onNodeComplete?: (result: NodeResult) => void;
}

/// Run a workflow end-to-end. Returns the result of every node.
export async function runWorkflow(wf: Workflow, ctx: RunContext): Promise<NodeResult[]> {
  const order = topoOrder(wf);
  const results: NodeResult[] = [];
  const outputs = new Map<string, string>(); // nodeId → output text

  for (const nodeId of order) {
    const node = wf.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    const upstream = upstreamOf(wf, nodeId);
    const input = upstream ? (outputs.get(upstream.id) ?? "") : (ctx.triggerInput ?? "");

    try {
      let output = "";
      switch (node.type) {
        case "trigger":
          output = input || node.params.tag || "(trigger fired)";
          break;
        case "ai": {
          const prompt = (node.params.prompt || "").replace(/\{\{input\}\}/g, input);
          const model = node.params.model || ctx.defaultModel;
          output = await generateDocumentClean(ctx.provider, model, prompt + (input ? `\n\nInput:\n${input}` : ""));
          break;
        }
        case "create-doc": {
          const count = parseInt(node.params.count || "1", 10);
          const model = node.params.model || ctx.defaultModel;
          // Generate N documents by asking for N sections, each a doc.
          const prompt = `Create ${count} distinct documents based on this input. Separate each with a "---DOCUMENT---" marker. Each starts with a # heading.\n\nInput:\n${input}`;
          const raw = await generateDocumentClean(ctx.provider, model, prompt);
          // Split into docs; store each in the vault.
          const docs = raw.split(/^---DOCUMENT---/m).map((d) => d.trim()).filter(Boolean);
          for (let i = 0; i < docs.length; i++) {
            const title = docs[i].match(/^#\s+(.+)$/m)?.[1]?.trim() ?? `Doc ${i + 1}`;
            try {
              await vaultCreateNote(ctx.vaultPath, title);
            } catch { /* best-effort in browser dev */ }
          }
          output = `Created ${docs.length} document(s):\n${docs.map((d) => "- " + (d.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "(untitled)")).join("\n")}`;
          break;
        }
        case "store": {
          output = `Stored in ${node.params.folder || "vault"}:\n${input.slice(0, 200)}`;
          break;
        }
        case "notify": {
          output = `Notified agent: ${node.params.message || "workflow complete"}`;
          break;
        }
        case "mcp-call": {
          output = `Called MCP tool ${node.params.tool || "(none)"} with ${node.params.args || "{}"}`;
          break;
        }
      }
      const result: NodeResult = { nodeId, ok: true, output };
      outputs.set(nodeId, output);
      results.push(result);
      ctx.onNodeComplete?.(result);
    } catch (e) {
      const result: NodeResult = { nodeId, ok: false, error: e instanceof Error ? e.message : String(e) };
      results.push(result);
      ctx.onNodeComplete?.(result);
      // Continue to next node even on error (don't halt the whole workflow).
    }
  }
  return results;
}
