import { useEffect, useState } from "react";
import { listProviders, hasApiKey, listModels } from "../lib/ai";

/// Resolves the active provider + model for AI features. The model list is
/// fetched LIVE from the provider's /models endpoint (never hardcoded). The
/// user's provider + model choices persist in localStorage.
export function useAiConfig() {
  const [provider, setProvider] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [configured, setConfigured] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loading, setLoading] = useState(true);

  // Resolve configured providers + restore saved provider/model on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = (await listProviders()) ?? [];
      const ready: string[] = [];
      for (const p of all) {
        try {
          if (await hasApiKey(p)) ready.push(p);
        } catch {
          /* skip */
        }
      }
      if (cancelled) return;
      setConfigured(ready);
      const savedProvider = localStorage.getItem("prizma.ai.provider");
      const savedModel = localStorage.getItem("prizma.ai.model");
      const chosen = savedProvider && ready.includes(savedProvider) ? savedProvider : ready[0] ?? null;
      setProvider(chosen);
      if (savedModel) setModel(savedModel);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When the provider changes, fetch its live model list.
  useEffect(() => {
    if (!provider) {
      setModels([]);
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    listModels(provider)
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        // If the current model isn't in the list (or empty), pick the first.
        if (list.length > 0 && (!model || !list.includes(model))) {
          setModel(list[0]);
          localStorage.setItem("prizma.ai.model", list[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]); // provider can't enumerate — user types manually
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const chooseProvider = (p: string) => {
    setProvider(p);
    setModel(""); // reset; the model-list effect will pick a sensible default
    localStorage.setItem("prizma.ai.provider", p);
  };

  const chooseModel = (m: string) => {
    setModel(m);
    localStorage.setItem("prizma.ai.model", m);
  };

  return { provider, model, configured, models, loadingModels, loading, chooseProvider, chooseModel };
}
