/// Per-document settings, persisted by doc path (extends the per-path
/// draftStore/commentsStore pattern). Word has per-doc zoom; the word goal
/// is also better per-doc than global.

export interface DocSettings {
  zoom: number; // percent
  goal: number; // word-count target (0 = none)
}

export const DOC_DEFAULTS: DocSettings = { zoom: 100, goal: 0 };

const key = (docPath: string) => `prizma.doc.${docPath}`;

export function getDocSetting(docPath: string): DocSettings {
  try {
    const raw = localStorage.getItem(key(docPath));
    if (!raw) return { ...DOC_DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : DOC_DEFAULTS.zoom,
      goal: typeof parsed.goal === "number" ? parsed.goal : DOC_DEFAULTS.goal,
    };
  } catch {
    return { ...DOC_DEFAULTS };
  }
}

export function setDocSetting(docPath: string, partial: Partial<DocSettings>): DocSettings {
  const merged = { ...getDocSetting(docPath), ...partial };
  try { localStorage.setItem(key(docPath), JSON.stringify(merged)); } catch { /* quota */ }
  return merged;
}
