# Editor Workspace v2 — Design

> **Status:** Design (pending user review)
> **Predecessors:** Layer 2a (editor foundation), Layer 2b (component library), Layer 3 (AI authoring), Layer 4 (Mermaid), Layer 7 (spellcheck/Cmd+S)
> **Roadmap position:** First of seven remaining sub-projects, sequenced UX-first.

## 1. Goal

Transform the editor from "thin" to a rich authoring workspace — the thing you actually write documents in. Four additions, each independently valuable:

1. **AI panel** (right dock) — generate whole documents, edit selections
2. **Settings modal** (gear in top bar) — configure providers, theme the app
3. **Theming** — light/dark/system + full CSS-token editor
4. **Rich toolbar** — inline formatting that matches a word processor

View mode is untouched. This is an editor-mode upgrade.

## 2. Non-goals (deferred to later roadmap sub-projects)

- Capability consent prompt (sub-project 2)
- Trusted-source signing (sub-project 3)
- Real packaging/sharing beyond path-to-clipboard (sub-project 4)
- MCP server direction (sub-project 5)
- D2 / draw.io rendering (sub-project 6)
- Inline ghost-text autocomplete (sub-project 7)
- Persisted chat history across sessions
- SVG creation as a distinct feature (stays as AI-generated components)

## 3. AI Panel

### 3.1 Placement & behavior

A `AiPanel` React component docked to the right edge of `EditorView`, between the editor surface and the window edge. Resizable via a drag handle on its left border (min 240px, max 480px, persisted width in `localStorage`). Collapsible via a toggle in the panel header and a keyboard shortcut (`Cmd/Ctrl+'`). Collapsed state remembers width for re-expansion.

Layout in `EditorView`:

```
┌───────────────────────────────────────────┬──────────────┐
│ EditorTopBar  [✨New][📁Open] fn  [⚙][💾][✕]│ AI panel      │
├───────────────────────────────────────────┤ (resizable)   │
│ EditorToolbar (rich, see §5)              ├──────────────┤
│                                           │ [Doc|Select]  │
│  WYSIWYG surface                          │ chat history  │
│  (or RawEditor)                           │               │
│                                           │ [prompt]      │
│                                           │ [send]        │
├───────────────────────────────────────────┤               │
│ TrustFooter                               │               │
└───────────────────────────────────────────┴──────────────┘
```

### 3.2 Two modes — segmented control at panel top

**Document mode** (default): the prompt is treated as "describe a document." Calls a new Rust command `ai_generate_document` (mirrors the existing author-time `ai_author_component`, but the system prompt requests a full multi-block MDX body using built-in components and prose). The returned MDX is parsed client-side via the existing `parseMdxToDoc`. Before applying, a landing affordance offers three choices (per user's "ask each time" answer):

- **Replace** — overwrite the entire document (asks for confirm if the doc is dirty)
- **Insert at cursor** — inserts the generated blocks at the current selection
- **Append** — adds the blocks to the end of the document

**Selection mode**: auto-activates when the editor has a non-collapsed text selection; a hint shows "Editing selection." The prompt + selected text are sent; the model returns replacement MDX for that span. On apply, offers **Replace selection** or **Insert after**. If the selection collapses (user clicks elsewhere), the panel falls back to Document mode. **Multi-block selections:** the selection is flattened to its concatenated text for the prompt; on "Replace selection" the entire selected range is deleted and the parsed replacement blocks inserted in its place (a multi-paragraph selection may thus be replaced by a single block or vice versa).

When no provider is configured, the panel shows the same "no provider configured" state as `AiComponentDialog` with a button to open Settings → Providers.

### 3.3 Chat history

Session-only (in-memory). The panel shows a scrollable list of turns: user prompts and AI responses (the generated MDX shown as a code preview, collapsible). A "Clear" button wipes the session. Not persisted — that's a later phase.

### 3.4 Provider/model

Reads from a small `useAiConfig` hook backed by `localStorage` (`prizma.ai.provider`, `prizma.ai.model`). Defaults to the first configured provider (queried via `listProviders` + `hasApiKey` on panel mount). A compact provider/model indicator at the bottom of the panel opens Settings → Providers on click.

## 4. Settings Modal

### 4.1 Entry points

- Gear icon (`⚙`) in `EditorTopBar` — always present in edit mode.
- A "Settings" link in `EmptyState` (so first-run configuration is possible before opening any doc).
- Opened as a centered modal overlay with a backdrop; Escape or backdrop-click closes.

### 4.2 Tabs

**Providers tab** — one row per known provider (`openai`, `openrouter`, `ollama`, `copilot`, `codex`, `glm`, `kimi`, `claude-agent-acp`). Each row shows:
- Provider name + the default model
- Status: ✓ Configured / — Not configured (queried live via `hasApiKey`)
- Action button depending on auth style:
  - API-key providers (openai, openrouter, ollama, glm, kimi): inline password field + "Save" / "Remove"
  - OAuth (copilot): "Sign in with GitHub" → runs the existing device flow
  - OAuth/PKCE (codex): "Sign in with Codex" → runs the existing PKCE flow
  - ACP (claude-agent-acp): binary path field + "Save" (reuses `setAcpBinary`)
- "Test" button that fires a trivial completion and reports success/failure.

**Appearance tab** — three sections:
1. **Theme mode** — Light / Dark / System (radio). Applies `data-theme` attribute on `<html>`.
2. **Accent color** — row of 8 preset swatches + a "Custom…" color picker.
3. **Token editor** — every editable token from `tokenCatalog.ts` (see §6), grouped (Color / Type / Spacing & shape). Color tokens get a color input; numeric/string tokens get a text field. Live preview as you type. "Reset to defaults" button per group.

### 4.3 Persistence

- Provider keys: stored in the OS keychain via the existing Rust `ai_set_api_key` / `ai_clear_api_key` (never `localStorage`).
- Theme mode, accent, and all token overrides: persisted to `localStorage` (`prizma.theme.mode`, `prizma.theme.accent`, `prizma.theme.tokens`). Applied on app load by `themeStore.ts` before first paint to avoid flash.

## 5. Rich Toolbar

### 5.1 Control set (single row, wraps on narrow)

Grouped with light dividers:

```
[B] [I] [U] [S]   [Font▾] [Size▾]   [A▾ text color] [🖊▾ highlight]   [≡] [≡] [≡] align   [•] [1.] [❝] [</>]   [🔗] [🖼]   |   [Text type▾] [List▾] [Insert▾]
```

New TipTap extensions (install): `@tiptap/extension-text-style`, `@tiptap/extension-underline`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-text-align`, `@tiptap/extension-link`, `@tiptap/extension-image`.

### 5.2 Image insertion

`🖼` opens the file dialog (existing `plugin-dialog`), reads the chosen file as a data URL, inserts an image node. Data-URL embedding keeps each `.mdxz` self-contained (no external file references) — consistent with the "shareable mini-app" goal. Large-image guard: warn above 2MB.

### 5.3 Serializer changes

`serializer.ts` gains round-trip support for the new marks and the image node:

| Construct | MDX emitted |
|-----------|-------------|
| underline mark | `<u>text</u>` |
| strikethrough | `~~text~~` |
| text color | `<span style="color:#hex">text</span>` |
| highlight | `==text==` |
| alignment | `<div style="text-align:left\|center\|right">…</div>` (block wrap) |
| link | `[text](url)` |
| image | `![alt](data:url)` |

Round-trip tests added for each. Inline HTML (`<u>`, `<span>`) is valid MDX and within the parser's regex reach; the existing JSX-tag parser path handles `<span style="…">`.

**Parser extension required for images and links:** the current `parseInline` regex only handles bold/italic/code. It must be extended to also match `![alt](url)` and `[text](url)` (including data URLs, which contain `:` and `,` but no whitespace, so the URL character class is `[^\s)]+`). This is called out explicitly because it's easy to forget the parser side when adding serializer output.

## 6. Theming — full CSS tokens

### 6.1 Token catalog

A new `src/theme/tokenCatalog.ts` exports the editable surface — name, group, type (color/number/string), default value — for every token currently in `tokens.css`, plus the dark-mode overrides. The Settings token editor is generated from this catalog (no hard-coded list in two places).

### 6.2 Dark mode

`tokens.css` gains a `[data-theme="dark"]` block overriding the color tokens (bg, text, borders, accent-soft, etc.). Type and spacing tokens are shared. System mode follows `prefers-color-scheme` via a `matchMedia` listener that sets `data-theme` accordingly.

### 6.3 Override application

`themeStore.ts`:
- `loadTheme()` — read `localStorage`, apply mode → `data-theme`, apply accent → `--accent` (+ computed `--accent-soft`/`--accent-border` derived from the accent), apply token overrides as inline `style` on `:root` (via `document.documentElement.style.setProperty`).
- `setMode/accent/token` — update state, persist, reapply.
- Accent derivation lives in `themeStore.ts` (not a separate util): `--accent-soft` = the accent color blended to ~10% opacity over the current `--bg`; `--accent-border` = ~30%. Computed in JS at apply time via a `mix(hex, bgHex, weight)` helper so a custom accent just works without the user also setting soft/border.

### 6.4 Defaults & reset

`tokenCatalog.ts` holds the bundled defaults. "Reset to defaults" clears overrides from `localStorage` and reapplies. The on-disk `tokens.css` is never modified by the app at runtime.

## 7. Rust changes

Minimal:

- **`ai_generate_document`** command — identical shape to `ai_author_component` (author-time, not policy-gated) but a system prompt that requests a full MDX document body (headings, paragraphs, lists, built-in components). Returns the MDX string; the frontend parses it.
- No other Rust changes. Provider config, OAuth, PKCE, ACP all reuse existing commands.

## 8. Testing & verification

### 8.1 Unit (Vitest)
- `themeStore` — mode/accent/token set+persist+apply, reset, system-mode media listener.
- `tokenCatalog` — every catalog entry has a default; defaults match `tokens.css`.
- Serializer — round-trip for underline, strikethrough, color, highlight, align, link, image.
- `AiPanel` — mode switching, "no provider" state, landing-affordance options (Replace/Insert/Append) call the right insert path.
- `SettingsModal` — tab switching; Providers row renders status; Appearance applies changes live.

### 8.2 Visual (headless Chrome, the established harness)
- Editor with AI panel docked right, resizable, collapsible.
- Rich toolbar: every control toggles/inserts and the surface reflects it.
- Settings → Providers: key entry round-trips through the mock.
- Settings → Appearance: dark mode, accent change, a token override — all apply live.
- Image insert renders the image node.

### 8.3 Definition of done
1. All Vitest tests pass (existing 87 + new).
2. TypeScript clean.
3. Rust builds; `ai_generate_document` round-trips through the mock.
4. Headless walkthrough: AI panel generates a doc and lands it (all three modes); settings configures a provider and the panel uses it; dark mode + accent + one token override apply and persist across reload; rich toolbar's bold/underline/color/align/link/image all work; images round-trip through save.

## 9. File-level summary

**New (frontend):** `AiPanel.tsx`, `SettingsModal.tsx`, `ProvidersTab.tsx`, `AppearanceTab.tsx`, `TokenEditor.tsx`, `themeStore.ts`, `tokenCatalog.ts`, `useAiConfig.ts`. Tests alongside each.

**New (Rust):** `ai_generate_document` command in `lib.rs`.

**Modified (frontend):** `EditorView.tsx` (host panel + settings + gear), `EditorTopBar.tsx` (gear icon), `EditorToolbar.tsx` (rich controls), `WysiwygSurface.tsx` (new extensions), `EmptyState.tsx` (settings link), `serializer.ts` (new marks), `tokens.css` (dark block), `App.tsx` (load theme on startup), `package.json` (new TipTap extensions).

**Modified (Rust):** `lib.rs` (register `ai_generate_document`).

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI panel placement | Right dock, resizable/collapsible | User's choice; most familiar (Cursor/Notion) |
| AI modes | Document + Selection (not inline autocomplete) | User's choice; inline autocomplete deferred to sub-project 7 |
| Generation landing | Ask each time (Replace/Insert/Append) | User's choice; safest |
| Toolbar density | Rich single bar (wraps) | User's choice; "feels like Word" without a ribbon's cost |
| Settings home | Gear in top bar → modal | User's choice; reachable from editor + empty state |
| Theming depth | Full CSS-token editor | User's choice; power-user control |
| Theme persistence | localStorage (not a file) | Per-machine pref; no format-design needed yet |
| Image embedding | Data URL in the zip | Keeps .mdxz self-contained/shareable |
| Dark mode mechanism | `[data-theme]` + token overrides | One override layer; system mode via matchMedia |
| Roadmap sequencing | UX-first, then security | User's choice; visible value before the security hardening |
