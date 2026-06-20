import { useEffect, useState } from "react";
import {
  listProviders,
  hasApiKey,
  setApiKey,
  clearApiKey,
  runOAuthFlow,
  setAcpBinary,
  type OAuthInstructions,
} from "../lib/ai";

interface Props {
  onProvidersLoaded?: (providers: string[]) => void;
}

const OAUTH_PROVIDERS = new Set(["copilot", "codex"]);
const ACP_PROVIDERS = new Set(["claude"]);

/**
 * Manage AI provider credentials. Three shapes:
 *   - API-key providers (openai, openrouter, ollama): user pastes a key.
 *   - OAuth providers (copilot, codex): device flow — show a code + URL.
 *   - ACP provider (claude): user sets the agent binary path.
 *
 * All credentials live in the OS keychain via the bridge; nothing persists
 * in the frontend or document code.
 */
export function ConnectionsPanel({ onProvidersLoaded }: Props) {
  const [providers, setProviders] = useState<string[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [draftKey, setDraftKey] = useState<Record<string, string>>({});
  const [oauthInstructions, setOauthInstructions] = useState<OAuthInstructions | null>(null);
  const [oauthBusy, setOauthBusy] = useState<string | null>(null);
  const [acpBinary, setAcpBinaryState] = useState("claude");
  const [acpArgs, setAcpArgs] = useState("--acp");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    try {
      const names = await listProviders();
      setProviders(names);
      onProvidersLoaded?.(names);
      const status: Record<string, boolean> = {};
      for (const p of names) status[p] = await hasApiKey(p);
      setConfigured(status);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function save(provider: string) {
    const key = draftKey[provider]?.trim();
    if (!key) return;
    try {
      setError(null);
      await setApiKey(provider, key);
      setDraftKey({ ...draftKey, [provider]: "" });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function clear(provider: string) {
    try {
      setError(null);
      await clearApiKey(provider);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function connectOAuth(provider: string) {
    try {
      setError(null);
      setOauthInstructions(null);
      setOauthBusy(provider);
      await runOAuthFlow(
        provider,
        (i) => setOauthInstructions(i),
        2000,
        90
      );
      setOauthInstructions(null);
      setOauthBusy(null);
      setMessage(`${provider} connected.`);
      await refresh();
    } catch (e) {
      setOauthBusy(null);
      setError(String(e));
    }
  }

  async function saveAcp() {
    try {
      setError(null);
      await setAcpBinary(acpBinary, acpArgs.split(/\s+/).filter(Boolean));
      setMessage(`ACP agent set to: ${acpBinary} ${acpArgs}`);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section data-testid="connections-panel" style={{ marginTop: 24 }}>
      <h2>AI Providers</h2>
      {error && (
        <p data-testid="connections-error" style={{ color: "crimson" }}>
          {error}
        </p>
      )}
      {message && (
        <p data-testid="connections-message" style={{ color: "green" }}>
          {message}
        </p>
      )}
      {oauthInstructions && (
        <p data-testid="oauth-instructions" style={{ background: "#fffbe6", padding: 12 }}>
          Visit <a href={oauthInstructions.verification_uri}>{oauthInstructions.verification_uri}</a>{" "}
          and enter code: <strong>{oauthInstructions.user_code}</strong>
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {providers.map((p) => (
          <li key={p} style={{ margin: "12px 0" }}>
            <strong>{p}</strong>{" "}
            <span data-testid={`status-${p}`}>
              {configured[p] ? "✓ configured" : "not configured"}
            </span>

            {/* API-key shape */}
            {!OAUTH_PROVIDERS.has(p) && !ACP_PROVIDERS.has(p) && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  type="password"
                  placeholder={`${p} API key`}
                  value={draftKey[p] ?? ""}
                  onChange={(e) => setDraftKey({ ...draftKey, [p]: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button onClick={() => save(p)}>Save</button>
                {configured[p] && <button onClick={() => clear(p)}>Clear</button>}
              </div>
            )}

            {/* OAuth shape */}
            {OAUTH_PROVIDERS.has(p) && (
              <div style={{ marginTop: 4 }}>
                <button
                  onClick={() => connectOAuth(p)}
                  disabled={oauthBusy !== null}
                  data-testid={`oauth-${p}`}
                >
                  {oauthBusy === p ? "Waiting for authorization…" : `Connect ${p} via OAuth`}
                </button>
                {configured[p] && (
                  <button onClick={() => clear(p)} style={{ marginLeft: 8 }}>
                    Disconnect
                  </button>
                )}
              </div>
            )}

            {/* ACP shape */}
            {ACP_PROVIDERS.has(p) && (
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  placeholder="binary (e.g. claude)"
                  value={acpBinary}
                  onChange={(e) => setAcpBinaryState(e.target.value)}
                  style={{ width: 140 }}
                />
                <input
                  placeholder="args (e.g. --acp)"
                  value={acpArgs}
                  onChange={(e) => setAcpArgs(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={saveAcp}>Set agent</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
