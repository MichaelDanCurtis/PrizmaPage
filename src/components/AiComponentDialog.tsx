import { useEffect, useState } from "react";
import {
  listProviders,
  hasApiKey,
  aiAuthorComponent,
} from "../lib/ai";
import { useModelList } from "../hooks/useModelList";
import { isValidGeneratedJsx, stripFences } from "../lib/aiComponent";

interface Props {
  onInsert: (jsx: string) => void;
  onClose: () => void;
}

type Status = "idle" | "loading" | "error";

export function AiComponentDialog({ onInsert, onClose }: Props) {
  const [providers, setProviders] = useState<string[]>([]);
  const [configured, setConfigured] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const modelList = useModelList(provider || null);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = (await listProviders()) ?? [];
        if (cancelled) return;
        setProviders(all);
        // Find which actually have a credential stored.
        const ready: string[] = [];
        for (const p of all) {
          try {
            if (await hasApiKey(p)) ready.push(p);
          } catch {
            /* provider not configured; skip */
          }
        }
        if (cancelled) return;
        setConfigured(ready);
        if (ready.length > 0) setProvider(ready[0]);
      } catch {
        if (!cancelled) setProviders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validation = result ? isValidGeneratedJsx(result) : null;

  const generate = async () => {
    if (!provider || !prompt.trim()) return;
    setStatus("loading");
    setError("");
    setResult("");
    try {
      const raw = await aiAuthorComponent(provider, modelList.model, prompt.trim());
      const cleaned = stripFences(raw);
      setResult(cleaned);
      const v = isValidGeneratedJsx(cleaned);
      if (!v.ok) {
        setStatus("error");
        setError(v.reason || "Model returned invalid JSX. Try rephrasing.");
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleInsert = () => {
    if (validation?.ok && validation.name) {
      onInsert(result.trim());
    }
  };

  const close = () => onClose();

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
          width: 520,
          maxWidth: "90vw",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
              Generate a component
            </span>
          </div>
          <div onClick={close} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>
            ✕
          </div>
        </div>

        {configured.length === 0 ? (
          <div
            style={{
              padding: 14,
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
              borderRadius: "var(--radius)",
              fontSize: 13,
              color: "var(--text)",
              lineHeight: 1.5,
            }}
          >
            No AI provider is configured yet. Available providers:{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              {providers.join(", ") || "none"}
            </code>
            . Set an API key or complete an OAuth flow first.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 60 }}>Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {configured.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {/* Model picker — live-fetched from the provider */}
              {modelList.loading ? (
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>…</span>
              ) : modelList.models.length > 0 ? (
                <select
                  value={modelList.model}
                  onChange={(e) => modelList.choose(e.target.value)}
                  style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-sans)", maxWidth: 160 }}
                >
                  {modelList.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={modelList.model}
                  onChange={(e) => modelList.choose(e.target.value)}
                  placeholder="model"
                  style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--text)", fontSize: 12, fontFamily: "var(--font-mono)", width: 110 }}
                />
              )}
            </div>

            <div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the component… e.g. 'a warning callout about backups'"
                autoFocus
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={generate}
              disabled={status === "loading" || !prompt.trim()}
              style={{
                alignSelf: "flex-start",
                background: status === "loading" ? "var(--accent-border)" : "var(--accent)",
                color: "white",
                border: "none",
                padding: "7px 16px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                cursor: status === "loading" ? "wait" : "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              {status === "loading" ? "Generating…" : "Generate"}
            </button>

            {result && (
              <div
                style={{
                  background: "var(--editor-bg)",
                  border: "1px solid var(--editor-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--editor-text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {result}
              </div>
            )}

            {status === "error" && error && (
              <div style={{ color: "#dc2626", fontSize: 12 }}>{error}</div>
            )}

            {validation?.ok && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={close}
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleInsert}
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Insert {validation.name}
                </button>
              </div>
            )}

            <div style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.4 }}>
              Generated components are author-time only — the model returns JSX that
              uses a built-in component. Nothing executes until you save & reopen.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
