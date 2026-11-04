# Round 8 — Final Clean Batch + Swarm Exhaustion

**Date:** 2026-06-27
**Branch:** `layer2a/editor-foundation`
**Spec:** `docs/superpowers/specs/2026-06-27-round8-features-design.md`

## Roadmap position (the "re-U" checkpoint)
Five final clean, in-scope, buildable candidates confirmed missing. Each Word-document-useful + frontend-only. After this round, the candidate pool is genuinely exhausted for clean swarm slots.

## What shipped (5 features)
1. **Auto-link URLs** — TipTap Link `autolink: true` so typed URLs become links. (`src/components/WysiwygSurface.tsx`)
2. **High-contrast theme** — a 4th theme mode (`HIGH_CONTRAST_OVERRIDES` mirroring `DARK_OVERRIDES`) + Appearance radio. Accessibility. (`src/theme/tokenCatalog.ts`, `themeStore.ts`, `AppearanceTab.tsx`)
3. **Indent / outdent** — toolbar →/← buttons using StarterKit's `sinkListItem`/`liftListItem`. (`src/components/EditorToolbar.tsx`)
4. **Case toggling** — upper/lower/title/sentence over the selection. (`src/lib/case.ts`, toolbar dropdown)
5. **Emoji picker** — a small in-app grid (EMOJIS catalog) in the toolbar. (`src/lib/emoji.ts`)

## Verification
- **Vitest:** 273 pass (was 268 → **+5 case tests**). TypeScript clean.
- **Rust:** `cargo build` green (no Rust changes).

## Commit chain
1 feature commit (batched), on `layer2a/editor-foundation`.

---

## Cumulative progress (Rounds 1–8)

**40 features delivered across eight rounds:**

| Round | Features |
|-------|----------|
| **R1** | doc statistics, spellcheck, find & replace, templates, PDF/print |
| **R2** | task lists, smart paste, auto-save + draft, shortcuts, outline jump |
| **R3** | raw highlighting, focus mode, word goal, HTML/MD export, in-editor tables |
| **R4** | SP8 memories UI, drag-to-reorder, image resize, link popover, version history |
| **R5** | SP9 workflow persistence, comments, footnotes, CodeBlock language picker, find-all results |
| **R6** | subscript/superscript, readability stats, export TOC, markdown import, version diff |
| **R7** | reading ruler, per-doc settings, print preview, anchor links, spellcheck locale |
| **R8** | auto-link URLs, high-contrast theme, indent/outdent, case toggling, emoji picker |

- **Frontend tests:** 145 → **273** (+128). **Rust tests:** +2. TypeScript clean throughout; cargo build green across all 8 rounds.

## Swarm exhaustion — the stopping condition is met

The Round 8 audit was decisive: after these five, the remaining unshipped ideas are each disqualified by an explicit, documented reason:
- **Multi-cursor (Cmd+D)** — high-risk ProseMirror selection surgery; not a clean swarm slot.
- **Document metadata editor** — requires a `.mdxz` manifest format break + Rust changes (deliberately avoided to preserve format stability).
- **SP9 full stub completion** (wire workflow store/notify/mcp-call to real MCP) — a multi-system integration, explicitly a separate larger effort.
- **SP10** — entirely undefined in the roadmap; building it requires defining the roadmap entry first (which is itself not a feature).
- **Bulk vault find-replace** — vault-tier scope requiring Rust re-zip/recompile of arbitrary packages.
- **CodeBlock line numbers** — fragile against `pre-wrap`, low ROI given the existing copy button.
- **Multi-color highlight palette** — arbitrary highlight colors are already settable via the existing color picker; enabling `multicolor` touches the serializer for marginal gain.
- **Per-doc page/margins, selection word-goal** — too narrow / not recognizable Word features.

None of these are clean, in-scope, buildable swarm slots. **The feature set appropriate for this product, fitting the road map, is genuinely exhausted.** The loop's stopping condition ("run out of features that would be appropriate for this product") is satisfied.

## What would resume the swarm (future work, out of current scope)
A new roadmap phase (defining SP10, a collaboration phase, a rich-content phase, or the document-metadata format change) would open new in-scope slots. Those require design/roadmap work first, not feature slots.
