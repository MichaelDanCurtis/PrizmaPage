import { useEffect, useState } from "react";
import { listProviders, hasApiKey, setApiKey, clearApiKey } from "../lib/ai";

interface Props {
  onProvidersLoaded?: (providers: string[]) => void;
}

/**
 * Manage AI provider credentials (API keys for Phase 5; OAuth/ACP connect
 * buttons come later). Keys are stored in the OS keychain via the bridge —
 * they never appear in document code or persist in the frontend.
 */
export function ConnectionsPanel({ onProvidersLoaded }: Props) {
  const [providers, setProviders] = useState<string[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [draftKey, setDraftKey] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

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
      await setApiKey(provider, key);
      setDraftKey({ ...draftKey, [provider]: "" });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function clear(provider: string) {
    try {
      await clearApiKey(provider);
      await refresh();
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
      <ul style={{ listStyle: "none", padding: 0 }}>
        {providers.map((p) => (
          <li key={p} style={{ margin: "8px 0" }}>
            <strong>{p}</strong>{" "}
            <span data-testid={`status-${p}`}>
              {configured[p] ? "✓ configured" : "not configured"}
            </span>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
