import { useState } from "react";
import { useAiConfig } from "../hooks/useAiConfig";
import { generateDocumentClean, editSelectionClean, vaultChat } from "../lib/aiGenerate";

interface Turn {
  role: "user" | "ai";
  text: string;
}

type ApplyMode = "replace" | "insert" | "append" | "replace-selection" | "insert-after";
type PanelMode = "document" | "selection" | "vault";

interface Props {
  /// Current text selection, or null. Drives Document vs Selection mode.
  selection: string | null;
  /// Apply generated MDX with the chosen landing mode.
  onApply: (mdx: string, mode: ApplyMode) => void;
  onCollapse: () => void;
  onOpenSettings: () => void;
  width: number;
  /// Vault path (enables Vault mode). Null when no vault is set.
  vaultPath?: string | null;
}

export function AiPanel({ selection, onApply, onCollapse, onOpenSettings, width, vaultPath }: Props) {
  const ai = useAiConfig();
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forceMode, setForceMode] = useState<PanelMode | null>(null);

  // Auto-mode: selection when text selected, else document. User can override
  // to vault via the mode toggle.
  const autoMode: PanelMode = selection ? "selection" : "document";
  const mode: PanelMode = forceMode ?? autoMode;

  const run = async () => {
    if (!prompt.trim() || !ai.provider) return;
    setLoading(true);
    setError("");
    setLastResult(null);
    const userTurn: Turn = { role: "user", text: prompt.trim() };
    setTurns((t) => [...t, userTurn]);
    try {
      let out: string;
      if (mode === "vault" && vaultPath) {
        out = await vaultChat(ai.provider, ai.model, vaultPath, prompt.trim());
      } else if (mode === "selection" && selection) {
        out = await editSelectionClean(ai.provider, ai.model, prompt.trim(), selection);
      } else {
        out = await generateDocumentClean(ai.provider, ai.model, prompt.trim());
      }
      setLastResult(out);
      setTurns((t) => [...t, { role: "ai", text: out }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  if (ai.loading) {
    return (
      <Shell width={width} onCollapse={onCollapse}>
        <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 16 }}>Loading…</div>
      </Shell>
    );
  }

  if (!ai.provider || ai.configured.length === 0) {
    return (
      <Shell width={width} onCollapse={onCollapse}>
        <div style={{ padding: 16, fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>
          No AI provider is configured.
          <div style={{ marginTop: 10 }}>
            <button onClick={onOpenSettings} style={btnStyle}>Open Settings →</button>
          </div>
        </div>
      </Shell>
    );
  }

  const modeLabel = mode === "vault" ? "🗂 Vault chat" : mode === "selection" ? "✎ Selection" : "📄 Document";
  const placeholder = mode === "vault" ? "Ask about your vault…" : mode === "selection" ? "How should the AI edit the selection?" : "Describe the document…";

  return (
    <Shell width={width} onCollapse={onCollapse}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{modeLabel}</span>
        {/* Provider picker */}
        <select
          value={ai.provider ?? ""}
          onChange={(e) => ai.chooseProvider(e.target.value)}
          style={{ fontSize: 10, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)" }}
        >
          {ai.configured.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {/* Model picker — live-fetched from the provider, with free-text fallback */}
        {ai.loadingModels ? (
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>loading models…</span>
        ) : ai.models.length > 0 ? (
          <select
            value={ai.model}
            onChange={(e) => ai.chooseModel(e.target.value)}
            style={{ fontSize: 10, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", maxWidth: 120 }}
          >
            {ai.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            value={ai.model}
            onChange={(e) => ai.chooseModel(e.target.value)}
            placeholder="model name"
            style={{ fontSize: 10, padding: "1px 4px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-mono)", width: 90 }}
          />
        )}
        {vaultPath && (
          <button
            onClick={() => setForceMode(mode === "vault" ? null : "vault")}
            title="Toggle vault-wide chat"
            style={{
              marginLeft: "auto",
              fontSize: 9,
              padding: "2px 6px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: mode === "vault" ? "var(--accent)" : "transparent",
              color: mode === "vault" ? "white" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            🗂
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {turns.length === 0 && (
          <div style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center", marginTop: 20 }}>
            {mode === "vault" ? "Ask anything about your notes." : mode === "selection" ? "Tell the AI how to edit the selected text." : "Describe the document you want."}
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              alignSelf: t.role === "user" ? "flex-end" : "flex-start",
              background: t.role === "user" ? "var(--accent-soft)" : "var(--bg-muted)",
              color: "var(--text)",
              padding: "6px 10px",
              borderRadius: "var(--radius)",
              fontSize: 12,
              maxWidth: "90%",
              whiteSpace: "pre-wrap",
              fontFamily: t.role === "ai" && mode === "vault" ? "var(--font-sans)" : t.role === "ai" ? "var(--font-mono)" : "var(--font-sans)",
            }}
          >
            {t.text}
          </div>
        ))}
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Generating…</div>}
        {error && <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>}
      </div>

      {lastResult && !loading && mode !== "vault" && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)", width: "100%", marginBottom: 2 }}>
            Generated {lastResult.split("\n").length} lines.
          </span>
          {mode === "document" ? (
            <>
              <button onClick={() => { onApply(lastResult, "replace"); setLastResult(null); }} style={btnStyle}>Replace</button>
              <button onClick={() => { onApply(lastResult, "insert"); setLastResult(null); }} style={btnStyle}>Insert here</button>
              <button onClick={() => { onApply(lastResult, "append"); setLastResult(null); }} style={btnStyle}>Append</button>
            </>
          ) : (
            <>
              <button onClick={() => { onApply(lastResult, "replace-selection"); setLastResult(null); }} style={btnStyle}>Replace selection</button>
              <button onClick={() => { onApply(lastResult, "insert-after"); setLastResult(null); }} style={btnStyle}>Insert after</button>
            </>
          )}
        </div>
      )}

      <div style={{ padding: 12, borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6 }}>
        <textarea
          placeholder={placeholder}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              run();
            }
          }}
          rows={2}
          style={{
            flex: 1,
            padding: "6px 8px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            resize: "none",
            outline: "none",
          }}
        />
        <button onClick={run} disabled={loading || !prompt.trim()} style={{ ...btnStyle, opacity: loading || !prompt.trim() ? 0.5 : 1 }}>
          ↑
        </button>
      </div>
    </Shell>
  );
}

const btnStyle: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  padding: "5px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

function Shell({ width, onCollapse, children }: { width: number; onCollapse: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{
        width,
        background: "var(--bg)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border-soft)" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>✨ AI</span>
        <button
          onClick={onCollapse}
          title="Collapse"
          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 14 }}
        >
          ›
        </button>
      </div>
      {children}
    </div>
  );
}
