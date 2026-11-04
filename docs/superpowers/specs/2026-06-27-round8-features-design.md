# Round 8 — Final Clean Batch (auto-link, high-contrast, indent, case, emoji) — Design

> **Status:** Design | **Date:** 2026-06-27 | **Round 8 of the feature swarm.** | **Predecessors:** Rounds 1–7 (35 features).

## Roadmap evaluation (the "re-U" checkpoint)
Five final clean, in-scope, buildable candidates confirmed missing. Each is Word-document-useful and frontend-only. After this round, the candidate pool is genuinely exhausted for clean swarm slots (remaining items are format breaks, high-risk ProseMirror surgery, capability changes, or undefined SPs).

## Goals (5 features)
1. **Auto-link URLs typed in prose** — enable TipTap Link's `autolink: true` so typed URLs become links. (1-line config)
2. **High-contrast / accessibility theme** — a 4th theme mode (`HIGH_CONTRAST_OVERRIDES` mirroring `DARK_OVERRIDES`) + Appearance radio.
3. **Indent / outdent buttons** — toolbar buttons using StarterKit's `sinkListItem`/`liftListItem`.
4. **Sentence/case toggling** — upper/lower/title/sentence case over the selection.
5. **Emoji/symbol picker** — a small in-app grid dropdown in the toolbar.

## Non-goals
Multi-cursor (high-risk), metadata editor (format break), SP9 full stubs (separate effort), SP10 (undefined), bulk vault find-replace (vault-tier scope).

## Testing & verification
- Unit: high-contrast overrides shape; case-transform functions; emoji catalog shape.
- Visual: typed URL auto-links; high-contrast mode applies; indent/outdent work; case toggles; emoji inserts.

## File-level summary
**New:** `src/lib/case.ts`, `src/lib/emoji.ts`. Tests alongside.
**Modified:** `src/components/WysiwygSurface.tsx` (autolink), `src/theme/tokenCatalog.ts` + `themeStore.ts` + `AppearanceTab.tsx` (high-contrast), `src/components/EditorToolbar.tsx` (indent/outdent, case, emoji), `src/components/EditorView.tsx` (wiring).
**No Rust changes.**
