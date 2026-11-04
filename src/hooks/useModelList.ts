import { useEffect, useState } from "react";
import { listModels } from "../lib/ai";

/// Fetch a provider's model list live. Returns the models, a loading flag, and
/// the chosen model (first from the list, or the user's saved choice). Re-runs
/// when the provider changes. Used by dialogs that need a model picker without
/// the full useAiConfig (which is for the persistent AI panel).
export function useModelList(provider: string | null) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<string>("");

  useEffect(() => {
    if (!provider) {
      setModels([]);
      setModel("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    // Restore saved choice for this provider if any.
    const saved = localStorage.getItem(`prizma.ai.model.${provider}`) || "";
    listModels(provider)
      .then((list) => {
        if (cancelled) return;
        setModels(list);
        if (saved && list.includes(saved)) setModel(saved);
        else if (list.length > 0) setModel(list[0]);
        else setModel("");
      })
      .catch(() => { if (!cancelled) { setModels([]); setModel(saved); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [provider]);

  const choose = (m: string) => {
    setModel(m);
    if (provider) localStorage.setItem(`prizma.ai.model.${provider}`, m);
  };

  return { models, loading, model, choose };
}
