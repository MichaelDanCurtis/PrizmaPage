import { useState } from "react";
import { complete, type CompletionResponse } from "../lib/ai";

interface Props {
  providers: string[];
}

/**
 * A minimal prompt box: pick a provider + model, type a prompt, see the
 * response. Proves the AI bridge end-to-end through the UI. (The beefy
 * editor with inline insertion arrives in Phase 2/5.)
 */
export function PromptBox({ providers }: Props) {
  const [provider, setProvider] = useState(providers[0] ?? "");
  const [model, setModel] = useState("gpt-4o-mini");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState<CompletionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const resp = await complete({
        provider,
        model,
        messages: [{ role: "user", content: prompt }],
      });
      setResponse(resp);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="prompt-box" style={{ marginTop: 24 }}>
      <h2>Ask the AI</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          data-testid="provider-select"
        >
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input
          placeholder="model (e.g. gpt-4o-mini)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{ width: 220 }}
        />
      </div>
      <textarea
        placeholder="Type a prompt…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      <button onClick={send} disabled={busy} style={{ marginTop: 8 }}>
        {busy ? "Thinking…" : "Send"}
      </button>
      {error && (
        <p data-testid="prompt-error" style={{ color: "crimson" }}>
          {error}
        </p>
      )}
      {response && (
        <pre data-testid="prompt-response" style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12 }}>
          {response.text}
        </pre>
      )}
    </section>
  );
}
