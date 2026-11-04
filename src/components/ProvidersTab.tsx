import { useEffect, useRef, useState } from "react";
import {
  listProviders,
  hasApiKey,
  setApiKey,
  clearApiKey,
  defaultModelFor,
  startOAuth,
  pollOAuth,
  runCodexPkceFlow,
  setAcpBinary,
} from "../lib/ai";
import { openUrl } from "../lib/openUrl";

/// How each provider is authenticated — drives which UI row it gets.
type AuthStyle = "key" | "oauth-device" | "oauth-pkce" | "acp" | "local";

const AUTH_STYLE: Record<string, AuthStyle> = {
  openai: "key",
  openrouter: "key",
  glm: "key",
  kimi: "key",
  ollama: "local",
  copilot: "oauth-device",
  codex: "oauth-pkce",
  claude: "acp",
  "claude-agent-acp": "acp",
};

/// Status of an in-progress OAuth/ACP flow, for live UI feedback.
type FlowState =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "device-code"; userCode: string; verificationUri: string }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function ProvidersTab() {
  const [providers, setProviders] = useState<string[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [flows, setFlows] = useState<Record<string, FlowState>>({});
  const [acpBinary, setAcpBinaryDraft] = useState("");
  // Mirror flows into a ref so the OAuth polling loop can read the latest
  // state (the closure captures `flows` at creation time, which is stale).
  const flowsRef = useRef<Record<string, FlowState>>(flows);
  flowsRef.current = flows;

  const refresh = async () => {
    const all = (await listProviders()) ?? [];
    setProviders(all);
    const ready: Record<string, boolean> = {};
    for (const p of all) {
      try {
        ready[p] = await hasApiKey(p);
      } catch {
        ready[p] = false;
      }
    }
    setConfigured(ready);
  };

  useEffect(() => {
    refresh();
  }, []);

  const setFlow = (p: string, s: FlowState) => setFlows((f) => ({ ...f, [p]: s }));

  const cancelFlow = (p: string) => setFlow(p, { kind: "idle" });

  const saveKey = async (p: string) => {
    const key = keyDrafts[p];
    if (!key) return;
    setSaving(p);
    try {
      await setApiKey(p, key);
      setConfigured((c) => ({ ...c, [p]: true }));
      setKeyDrafts((d) => ({ ...d, [p]: "" }));
    } catch (e) {
      alert(`Failed to save key: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  };

  const removeKey = async (p: string) => {
    await clearApiKey(p);
    setConfigured((c) => ({ ...c, [p]: false }));
  };

  /// Copilot: GitHub device flow. Gets the device code, shows it prominently
  /// (NOT auto-opening the browser — the user clicks to do that), then polls.
  const runCopilot = async () => {
    setFlow("copilot", { kind: "pending", message: "Requesting device code…" });
    try {
      // Step 1: request the code. We call startOAuth directly (not runOAuthFlow)
      // so we control timing — show the code, then poll only after the user
      // has had a chance to read/copy it and open the browser themselves.
      const instructions = await startOAuth("copilot");
      setFlow("copilot", {
        kind: "device-code",
        userCode: instructions.user_code,
        verificationUri: instructions.verification_uri,
      });
      // Now poll in the background. The device-code UI stays visible until
      // completion, so the user always has the code in front of them.
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        // If the user cancelled (flow reset to idle), stop polling.
        const cur = flowsRef.current.copilot;
        if (!cur || cur.kind === "idle" || cur.kind === "error") return;
        const status = await pollOAuth("copilot");
        if (status === "complete") {
          setFlow("copilot", { kind: "done" });
          setConfigured((c) => ({ ...c, copilot: true }));
          return;
        }
      }
      setFlow("copilot", { kind: "error", message: "Timed out waiting for authorization." });
    } catch (e) {
      setFlow("copilot", { kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  /// Codex: PKCE flow. Opens the auth URL, waits for the localhost callback.
  const runCodex = async () => {
    setFlow("codex", { kind: "pending", message: "Opening browser for authorization…" });
    try {
      await runCodexPkceFlow((url) => {
        setFlow("codex", { kind: "pending", message: "Authorize in your browser, then return." });
        openUrl(url).catch(() => {});
      });
      setFlow("codex", { kind: "done" });
      setConfigured((c) => ({ ...c, codex: true }));
    } catch (e) {
      setFlow("codex", { kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  /// Claude (ACP): save the binary path.
  const saveAcp = async () => {
    setFlow("claude-agent-acp", { kind: "pending", message: "Saving…" });
    try {
      await setAcpBinary(acpBinary || "claude-agent-acp", []);
      setFlow("claude-agent-acp", { kind: "done" });
      setConfigured((c) => ({ ...c, "claude-agent-acp": true, claude: true }));
    } catch (e) {
      setFlow("claude-agent-acp", { kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
        Configure at least one provider to use AI features.
      </div>
      {providers.map((p) => {
        const style = AUTH_STYLE[p] ?? "key";
        const ready = configured[p];
        const flow = flows[p] ?? { kind: "idle" };
        return (
          <div
            key={p}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{p}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {style === "local" ? "(local)" : style === "acp" ? "(local agent)" : style === "oauth-device" ? "(GitHub OAuth)" : style === "oauth-pkce" ? "(OAuth)" : "(API key)"}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: ready ? "#059669" : "var(--text-faint)",
                }}
              >
                {ready ? "✓ Configured" : style === "local" ? "● Always available" : "— Not configured"}
              </span>
            </div>

            {/* API-key providers */}
            {style === "key" && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="password"
                  placeholder="API key"
                  value={keyDrafts[p] ?? ""}
                  onChange={(e) => setKeyDrafts((d) => ({ ...d, [p]: e.target.value }))}
                  style={inputStyle}
                />
                <button onClick={() => saveKey(p)} disabled={!keyDrafts[p] || saving === p} style={{ ...btnPrimary, opacity: !keyDrafts[p] || saving === p ? 0.5 : 1 }}>
                  {saving === p ? "…" : "Save"}
                </button>
                {ready && (
                  <button onClick={() => removeKey(p)} style={btnSecondary}>Remove</button>
                )}
              </div>
            )}

            {/* Local provider (ollama) — no auth needed */}
            {style === "local" && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Runs locally at <code style={{ fontFamily: "var(--font-mono)" }}>http://localhost:11434</code>. No configuration needed — just have Ollama running.
              </div>
            )}

            {/* Copilot: GitHub device flow */}
            {style === "oauth-device" && (
              <div>
                {flow.kind !== "device-code" && flow.kind !== "pending" && (
                  <>
                    <button onClick={runCopilot} style={btnPrimary}>
                      {ready ? "Re-authorize with GitHub" : "Sign in with GitHub"}
                    </button>
                    {ready && (
                      <button onClick={() => removeKey(p)} style={{ ...btnSecondary, marginLeft: 6 }}>Disconnect</button>
                    )}
                  </>
                )}
                {flow.kind === "pending" && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>⏳ {flow.message}</div>
                )}
                {flow.kind === "device-code" && (
                  <div style={{ marginTop: 8, padding: 12, background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      Enter this code at GitHub:
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <code style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: 2,
                        color: "var(--accent)",
                        background: "var(--bg)",
                        padding: "6px 14px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--accent-border)",
                        userSelect: "all",
                      }}>
                        {flow.userCode}
                      </code>
                      <button
                        onClick={() => navigator.clipboard?.writeText(flow.userCode)}
                        style={{ fontSize: 10, padding: "4px 8px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)" }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => openUrl(flow.verificationUri).catch(() => {})}
                        style={{ ...btnPrimary, fontSize: 11 }}
                      >
                        Open {flow.verificationUri.replace("https://", "")} ↗
                      </button>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        Waiting for you to authorize… (click Cancel to abort)
                      </span>
                      <button onClick={() => cancelFlow("copilot")} style={{ ...btnSecondary, fontSize: 10, marginLeft: "auto" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <FlowStatus flow={flow} />
              </div>
            )}

            {/* Codex: PKCE flow */}
            {style === "oauth-pkce" && (
              <div>
                <button onClick={runCodex} disabled={flow.kind === "pending"} style={{ ...btnPrimary, opacity: flow.kind === "pending" ? 0.6 : 1 }}>
                  {flow.kind === "pending" ? "Waiting…" : ready ? "Re-authorize with Codex" : "Sign in with Codex"}
                </button>
                {ready && flow.kind === "idle" && (
                  <button onClick={() => removeKey(p)} style={{ ...btnSecondary, marginLeft: 6 }}>Disconnect</button>
                )}
                <FlowStatus flow={flow} />
              </div>
            )}

            {/* Claude (ACP): binary path */}
            {style === "acp" && (
              <div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    placeholder="claude-agent-acp binary path"
                    value={acpBinary}
                    onChange={(e) => setAcpBinaryDraft(e.target.value)}
                    style={inputStyle}
                  />
                  <button onClick={saveAcp} style={btnPrimary}>Save</button>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>
                  Install via <code style={{ fontFamily: "var(--font-mono)" }}>npm i -g @agentclientprotocol/claude-agent-acp</code>, then leave blank for default.
                </div>
                <FlowStatus flow={flow} />
              </div>
            )}
          </div>
        );
      })}
      {providers.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No providers available.</div>
      )}
    </div>
  );
}

function FlowStatus({ flow }: { flow: FlowState }) {
  if (flow.kind === "idle" || flow.kind === "device-code" || flow.kind === "pending") return null;
  if (flow.kind === "done")
    return <div style={{ fontSize: 11, color: "#059669", marginTop: 6 }}>✓ Authorized.</div>;
  return <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6 }}>✗ {flow.message}</div>;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "5px 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
};

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: "none",
  padding: "5px 12px",
  borderRadius: "var(--radius-sm)",
  fontSize: 12,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "var(--bg-muted)",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
  padding: "5px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: 12,
  cursor: "pointer",
};
