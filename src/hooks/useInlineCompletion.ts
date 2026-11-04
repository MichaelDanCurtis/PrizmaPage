import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { completeInline } from "../lib/aiGenerate";
import { listProviders, hasApiKey, listModels } from "../lib/ai";

/// Inline completion: watches the editor for typing pauses, requests a short
/// continuation of the current paragraph, and exposes the suggestion (or null).
/// The caller renders the hint and handles Tab-to-accept.
///
/// `enabled` lets the surface turn it off (e.g. no provider configured).
export function useInlineCompletion(editor: Editor | null) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const providerRef = useRef<string | null>(null);
  const modelRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef<string>("");
  const reqIdRef = useRef(0);

  // Resolve the active provider + a model (first from the provider's live list,
  // else the user's saved choice, else empty).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = (await listProviders()) ?? [];
      for (const p of all) {
        try {
          if (await hasApiKey(p)) {
            if (cancelled) return;
            providerRef.current = p;
            // Try the saved model, else fetch the provider's list and take the first.
            const saved = localStorage.getItem("prizma.ai.model") || "";
            if (saved) {
              modelRef.current = saved;
            } else {
              try {
                const models = await listModels(p);
                modelRef.current = models[0] ?? "";
              } catch {
                modelRef.current = "";
              }
            }
            return;
          }
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      // Clear any pending suggestion on activity.
      setSuggestion(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const { from, empty } = editor.state.selection;
      if (!empty || !providerRef.current) return;
      // Get the text of the current paragraph up to the cursor.
      const $from = editor.state.doc.resolve(from);
      const paraStart = $from.start();
      const textBefore = editor.state.doc.textBetween(paraStart, from, "\n");
      // Only complete if there's something to continue (not at line start).
      if (textBefore.trim().length < 3) return;
      lastTextRef.current = textBefore;
      debounceRef.current = setTimeout(async () => {
        const myId = ++reqIdRef.current;
        try {
          const out = await completeInline(providerRef.current!, modelRef.current, textBefore);
          // Trim leading whitespace; ignore if it just repeats the input or is empty.
          const cont = out.trimStart();
          if (myId !== reqIdRef.current) return; // stale
          if (!cont || cont.toLowerCase().startsWith(textBefore.toLowerCase().slice(-15))) {
            setSuggestion(null);
            return;
          }
          setSuggestion(cont);
          // Position the hint at the cursor's screen coords.
          const start = editor.view.coordsAtPos(from);
          setCoords({ top: start.bottom + 2, left: start.left });
        } catch {
          if (myId === reqIdRef.current) setSuggestion(null);
        }
      }, 800);
    };
    const onSelection = () => setSuggestion(null);
    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onSelection);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor]);

  const accept = () => {
    if (!editor || !suggestion) return null;
    // Insert a leading space if the continuation doesn't start with one.
    const insert = suggestion.startsWith(" ") ? suggestion : " " + suggestion;
    editor.chain().focus().insertContent(insert).run();
    setSuggestion(null);
    return insert;
  };

  const dismiss = () => setSuggestion(null);

  return { suggestion, coords, accept, dismiss };
}
