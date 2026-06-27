import { useCallback, useState } from "react";

const KEY = "prizma.editor.spellcheck";
const LOCALE_KEY = "prizma.editor.spellcheck.locale";

/// Common spellcheck locales (the webview's native spellchecker honors `lang`).
export const SPELLCHECK_LOCALES: { code: string; label: string }[] = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
];

/// Toggle + persist the editor's native spellcheck, and select a locale that
/// reflects onto the ProseMirror element's `lang` attribute.
export function useSpellcheck() {
  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem(KEY) !== "0");
  const [locale, setLocaleState] = useState<string>(() => localStorage.getItem(LOCALE_KEY) || "en-US");
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  const setLocale = useCallback((code: string) => {
    localStorage.setItem(LOCALE_KEY, code);
    setLocaleState(code);
  }, []);
  return { enabled, toggle, locale, setLocale };
}
