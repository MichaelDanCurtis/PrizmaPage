# PrizmaPage — Layer 1: Document Surface Design

**Date:** 2026-06-20
**Status:** Draft — pending user review
**Builds on:** `2026-06-19-prizmapage-architecture-design.md` (the dual-shell viewer/editor architecture)
**Replaces:** The Phase 0 / Phase 5 debug UI (`App.tsx`, `components/ConnectionsPanel.tsx`, `components/PromptBox.tsx` are deleted from the rendered surface; their logic in `lib/` stays)

---

## 1. Goal

Build the first user-facing surface of PrizmaPage: a frameless document viewer that replaces the current debug harness entirely. A user can launch the app, open a real `.mdxz` file by any of three methods (native picker, drag-drop, recent), and have it render full-window with zero chrome obscuring it. No editor, no AI authoring, no settings panels surfaced — just the document, the way Preview.app shows a PDF.

This is **Layer 1 of three** in the UI build-out:

| Layer | Delivers | Status |
|-------|----------|--------|
| **1 — Document surface** | Frameless viewer + open flow + design language | ← this spec |
| 2 — Editor mode | Split view, component palette, mode toggle | future |
| 3 — AI authoring | Inline "ask the AI to build a component" | future |

Each layer needs the one below it. Layer 1 establishes the design language and the document-hosting runtime that everything else hangs off.

---

## 2. Locked visual decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Viewer shell | **Frameless (Preview.app style)** | Document fills the window; controls fade in on hover. Most committed "thin viewer." |
| Aesthetic | **Modern app** (Inter / -apple-system, white background) | Familiar; signals "executable app" without going generic-corporate. |
| Accent color | **Indigo `#4f46e5`** now, swappable later via a single theme token | Safe modern choice; theme-token architecture means changing it is a one-line edit, not a refactor. |
| Dark mode | **Not in Layer 1** | Real dark work belongs with the editor (which will want an IDE-dark mode anyway). |

**Mockups** (locked during brainstorm): see `layer1-document-surface.html` in the brainstorm session dir. Three states — empty, document open, hover controls — all decisions applied together.

---

## 3. Scope — what Layer 1 delivers

**In scope:**

- **Empty state** — first launch or all docs closed. Centered app mark + "Open…" + "Recent (N)" + drag-drop hint. No menus, no chrome.
- **Open-document state** — the `.mdxz` content rendered full-window, frameless. Compiled MDX components render in-line (charts, callouts, whatever the doc ships). Interactive elements styled with the indigo accent.
- **Hover controls** — cursor enters top ~80px → a floating control pill fades in: page nav (multi-section only), zoom (50%–200%, persisted per-doc), download original `.mdxz`, share (stub: copies path), and the **Edit** toggle (the Layer 2 destination — present as a button, does nothing functional in Layer 1).
- **Trust footer** — bottom-center, faint mono text: `filename.mdxz · signed: <domain> ✓` or `filename.mdxz · unsigned`. Always visible, never competes with content. Click opens a popover with full manifest details (deferred — Layer 1 ships the status line only).
- **Open flow** — native Tauri file picker (`.mdxz` filter) + drag-drop anywhere on empty state + "Recent" list persisted in app data dir (last 5).

**Out of scope (deliberate, deferred to named layers):**

- Editor mode (Layer 2)
- AI authoring (Layer 3)
- Capability prompts — the open-time permission dialog only matters once docs can *do* privileged things, which is the editor's concern
- Settings/connections UI surfaced — the API-key/OAuth plumbing from Phase 5 stays in `lib/ai.ts`, accessible via a menu item but not shown in the frameless view
- Multi-document / tabs
- Watched files / auto-reload
- Dark mode
- Full share/export behavior (the `↗` button is a stub that copies the path)

---

## 4. Architecture & file boundaries

### 4.1 Component tree

```
src/
  App.tsx                       — root: routes between EmptyState / DocumentView based on open doc
  theme/
    tokens.css                  — CSS custom properties (--accent, --bg, --text, --radius, type scale)
                                  ONE place to change the accent (indigo now, swappable later)
  components/
    EmptyState.tsx              — centered app mark + Open/Recent + drag-drop target
    DocumentView.tsx            — frameless document renderer; owns hover-control state
    HoverControls.tsx           — faded-in control pill (page nav, zoom, share, Edit toggle)
    TrustFooter.tsx             — faint filename + signature-status footer
    DocumentCanvas.tsx          — runs the compiled MDX (uses existing lib/runner.ts) into this div
    RecentMenu.tsx              — dropdown of last-5 docs (persisted in app state)
  hooks/
    useOpenDocument.ts          — file-picker + drag-drop + recent-list state
    useHoverControls.ts         — fade-in/out timing for the control pill
  lib/                          — UNCHANGED from Phase 0/5:
    ai.ts                       — provider/OAuth/PKCE/ACP client (preserved for Layer 3)
    capability.ts               — capability bridge client
    package.ts                  — open_document bridge client
    runner.ts                   — runs precompiled MDX via @mdx-js/mdx run()
```

### 4.2 Design rule: theme tokens are the only source of color

Every component references `var(--accent)`, `var(--bg)`, etc. The literal `#4f46e5` appears **only** in `theme/tokens.css` under `--accent:`. Changing the accent later (e.g. to teal, or a user-chosen theme) is a one-line edit. No component imports a hex value.

### 4.3 New Rust commands (Tauri bridge)

- `open_file_dialog() -> Option<PathBuf>` — wraps Tauri's `dialog` plugin, `.mdxz` filter
- `recent_documents() -> Vec<RecentEntry>` — reads `recents.json` from app data dir
- `add_recent_document(path: PathBuf)` — dedupes, prepends, truncates to 5, writes `recents.json`
- `share_document_path() -> String` — returns the current doc's path for the share-button stub (copies to clipboard in Layer 1)

`RecentEntry { path: PathBuf, name: String, opened_at: u64 }`.

### 4.4 Deleted from the rendered surface (logic preserved)

- `components/ConnectionsPanel.tsx` — deleted. The `lib/ai.ts` plumbing stays.
- `components/PromptBox.tsx` — deleted. Same.
- Current `App.tsx` (83-line debug harness) — deleted entirely; replaced by the new routing root.

The Phase 0/5 work is not wasted — `lib/runner.ts` is reused as-is by `DocumentCanvas`, and `lib/package.ts` / `lib/ai.ts` / `lib/capability.ts` remain available for Layers 2 and 3.

---

## 5. Design system (the tokens)

The single source of truth for the visual identity. Everything else references by name.

### 5.1 Color tokens

```css
--accent:        #4f46e5;   /* indigo — links, buttons, interactive markers, Edit toggle */
--accent-soft:   #eef2ff;   /* tinted backgrounds for inline components */
--accent-border: #c7d2fe;   /* borders on accent-tinted blocks */
--bg:            #ffffff;   /* document canvas */
--bg-muted:      #fafafa;   /* empty state, hover states */
--text:          #0f172a;   /* primary text */
--text-muted:    #64748b;   /* secondary text, captions */
--text-faint:    #94a3b8;   /* hints, the trust footer */
--border:        #e5e7eb;   /* dividers, control pill border */
--border-soft:   #f1f5f9;   /* the very faint top divider under traffic lights */
```

### 5.2 Type scale (Inter, -apple-system fallback)

```
--font-display:  700, 26px, line-height 1.2, letter-spacing -0.5px   (doc title)
--font-h2:       600, 18px, line-height 1.3                           (section heads)
--font-body:     400, 16px, line-height 1.7                           (prose)
--font-small:    400, 13px                                            (captions, control pill)
--font-label:    600, 11px, letter-spacing 1.2px, uppercase           (eyebrows like "Q4 2026 REPORT")
--font-mono:     'SF Mono', 13px                                      (code, the .mdxz filename)
```

### 5.3 Spacing & shape

```
--radius-sm: 4px    (inline code chips)
--radius:    7px    (buttons, control pill)
--radius-lg: 8px    (component blocks)
--radius-xl: 14px   (the app mark)
--content-width: 680px   (max-width the document centers on — reads as a real page, not edge-to-edge)
--content-padding: 32px
```

### 5.4 Non-obvious decisions

1. **`--content-width: 680px`.** This is what makes a frameless doc still feel like a *document* and not a stretched-out webpage. Preview.app and Acrobat both constrain the page. Edge-to-edge Inter at 16px reads as "blog post," not "document."
2. **No dark mode tokens in Layer 1.** Frameless viewer is light-only. Dark mode is real work (every component needs both palettes) and belongs with the editor, which will want a dark "IDE-class" mode anyway.

---

## 6. Interaction states & behavior

### 6.1 Empty state

- Centered app mark + "PrizmaPage" + "Open a document to begin."
- Three primary affordances, equal weight:
  - **"Open…"** button → triggers native Tauri file picker filtered to `.mdxz`. On select: opens doc, transitions to DocumentView, adds to recents.
  - **"Recent (N)"** button (greyed when N=0) → dropdown of last-5 docs by filename. Click any → opens directly.
  - **Drag-drop** → the entire empty-state surface is a drop target. Dropping a `.mdxz` anywhere opens it. Dropping a non-`.mdxz` shows a brief inline error: "PrizmaPage opens .mdxz files."
- No menus, no settings button. Layer 1 stays minimal.

### 6.2 Document open — frameless rendering

- Compiled MDX renders into `DocumentCanvas`, centered at `--content-width: 680px`, padded `--content-padding: 32px`.
- Scroll is **native OS webview scroll** (not a custom scroller — feels like Preview, not a SPA).
- Components inside the doc render in-flow. They're sandboxed by the Phase 0 runtime; this layer just hosts them.
- Keyboard: `Cmd+↓` / `Cmd+↑` scroll by page (standard macOS doc behavior). No custom key handling beyond what the OS gives us.

### 6.3 Hover controls (the frameless compromise)

- Triggered when the cursor enters the top ~80px of the window.
- Fade in over 150ms (CSS transition on opacity).
- Fade out 400ms after the cursor leaves that zone (longer delay prevents flicker at the boundary).
- Pill contents, left-to-right: `‹  3 / 12  ›` (page nav, only if multi-section) · `-  100%  +` (zoom) · `⤓` (download original `.mdxz`) · `↗` (share — copies path in Layer 1) · `Edit` (indigo — switches to editor mode, Layer 2; present as a button, no functional destination in Layer 1).
- The pill floats on `backdrop-filter: blur(8px)` semi-transparent white — feels like a macOS HUD overlay, not a toolbar that lives there.

### 6.4 Trust footer

- Bottom-center, `--font-mono`, `--text-faint`, ~10px.
- **Always visible** (not hover-triggered) but so faint it never competes with content.
- Content: `docs/q4-report.mdxz · signed: acme.com ✓` (green check) or `docs/q4-report.mdxz · unsigned` (no marker).
- Clicking it opens a popover with full manifest details (capabilities, signature fingerprint). Deferred — Layer 1 ships the status line only.

### 6.5 Zoom behavior

- `+` / `-` step in 10% increments, clamped 50%–200%. Persisted per-document in app state (reopen → remembered).
- Applied via CSS `zoom` (or `transform: scale` if the webview lacks CSS zoom) to `DocumentCanvas` only.

### 6.6 What Layer 1 explicitly does NOT handle

- The open-time capability prompt (Layer 2)
- The Edit toggle's actual destination (Layer 2)
- Share/export's full behavior (`↗` is a path-copy stub)
- The trust footer's full popover (status line only)

### 6.7 Implementation note

The hover trigger uses a top-zone `mouseenter` (or pointer enter on a positioned overlay), not a `mousemove` polling loop. Cheaper, and matches how Preview.app's toolbar behaves.

---

## 7. Open flow & persistence

### 7.1 Native file picker

- Calls `open_file_dialog()` → wraps Tauri's `dialog` plugin with `.mdxz` filter.
- Returns `Option<PathBuf>`: `Some(path)` on select, `None` on cancel.
- On `Some`: hands path to the existing `open_document` command (Phase 0), which reads the package, returns the three layers. Frontend transitions EmptyState → DocumentView.

### 7.2 Drag-and-drop

- Tauri emits a `file-drop` event with paths. The EmptyState (and only EmptyState — Layer 1 doesn't allow dropping a new doc onto an open one) listens.
- Filter: `.mdxz` extension → open. Otherwise → inline error "PrizmaPage opens .mdxz files" for 2s, then clear.
- Multiple files dropped: open the first, ignore the rest (Layer 1 is single-document).

### 7.3 Recent documents

- Persisted as JSON in OS app-data dir: `~/Library/Application Support/PrizmaPage/recents.json` on macOS (via Tauri's `app_data_dir`).
- Shape:
  ```json
  { "recents": [
    { "path": "/abs/path/to.mdxz", "name": "q4-report", "opened_at": 1781983000 },
    ...
  ] }
  ```
  Last 5, newest first, deduplicated by path.
- New commands: `recent_documents() → Vec<RecentEntry>`, `add_recent_document(path: PathBuf)`.
- `add_recent_document` is called after a successful open. Dedupes, prepends, truncates to 5.
- Recent menu shows `name` (filename without extension) + faint relative path below. Clicking opens via `open_document`. If the file no longer exists → "File not found — removed from recents" and the entry is pruned.

### 7.4 State machine

```
[launch] → EmptyState
EmptyState + (open | drop | recent-click) → loading → DocumentView (success) | EmptyState + error
DocumentView + (close | open-other) → EmptyState
```

### 7.5 "No Close button" decision

Closing a document returns you to the empty state. The mechanism: `Cmd+W` closes the window entirely (OS behavior). Layer 1 has no explicit Close button — the frameless viewer treats the document as the window's purpose; you don't "close" the doc, you close the window. A close-to-empty menu item can be added later if needed.

---

## 8. Testing & verification

### 8.1 Frontend tests (Vitest + React Testing Library)

- `EmptyState.test.tsx` — renders mark + Open/Recent; "Recent (0)" greyed; shows drag-drop hint.
- `DocumentView.test.tsx` — given a mocked opened document, renders DocumentCanvas with `--content-width` centering, shows trust footer with correct signature status.
- `HoverControls.test.tsx` — `hovered=true` renders pill; `hovered=false` hides it.
- `TrustFooter.test.tsx` — renders `signed: <domain> ✓` when manifest signed, `unsigned` when not.
- `RecentMenu.test.tsx` — renders N entries; clicking calls open handler; prunes missing files.
- `useOpenDocument.test.ts` — open-via-picker updates state; drag-drop filters non-`.mdxz`; recents update after successful open.

### 8.2 Integration test (live, the Phase 0/5 pattern)

A new test that boots the actual Tauri app, opens a fixture `.mdxz` via the `open_document` command, asserts the rendered DOM contains the document's text + trust footer. Same pattern as `live_ollama_test` / `live_acp_test`.

### 8.3 Visual verification (user's eyes — the pixel gate)

The locked mockups are the contract. After implementation:
1. `cargo tauri dev` launches into the empty state (not the debug screen — that's deleted).
2. Open `hello.mdxz` via "Open…", via drag-drop, and via Recent — matches mockup State 2.
3. Hover top edge — matches mockup State 3.
4. Trust footer shows correct signature status.

I verify logic + launch; the user verifies pixels.

### 8.4 Definition of done

1. All Vitest tests pass.
2. The integration test boots the app and renders a real `.mdxz`.
3. `cargo tauri dev` launches into the empty state (debug screen deleted).
4. User can open `hello.mdxz` via "Open…", drag-drop, and Recent.
5. Hover controls fade in/out correctly.
6. Trust footer shows correct signature status.
7. The debug `App.tsx` / `ConnectionsPanel.tsx` / `PromptBox.tsx` are deleted from the rendered surface (their `lib/` code stays).
8. User confirms the pixels match the locked mockups.

### 8.5 Not tested in Layer 1

Editor mode, AI authoring, capability prompts, multi-document/tabs, dark mode.

---

## 9. Dependencies on prior work

| Reused from | What |
|-------------|------|
| Phase 0 | `open_document` command, `PackageContents` (manifest + content_md + build_main_js), policy engine, capability bridge |
| Phase 0 | `lib/runner.ts` (runs precompiled MDX via `@mdx-js/mdx`'s `run()`) — reused as-is by `DocumentCanvas` |
| Phase 5 | `lib/ai.ts`, `lib/package.ts`, `lib/capability.ts` — preserved for Layers 2 & 3, not surfaced in Layer 1's frameless view |

Nothing in Layer 1 requires new AI/OAuth/ACP work. The whole layer is document-surface UX + open-flow plumbing.

---

## 10. Decision log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Viewer shell | Frameless (Preview.app) | Most committed "thin viewer"; document IS the window. |
| Aesthetic | Modern app (Inter/white) | Familiar; signals executable-app without going generic. |
| Accent | Indigo, theme-token swappable | Safe choice now; one-line change later. |
| Content width | 680px fixed max | Reads as document, not blog post. |
| Dark mode | Deferred to editor layer | Belongs with the IDE-class editor that wants dark anyway. |
| Hover trigger | Top-zone mouseenter, not mousemove | Cheaper; matches Preview. |
| No Close button | Close = close window | Keeps surface minimal; the doc is the window's purpose. |
| Recents cap | 5 | Matches typical recent-doc patterns; keeps menu scannable. |
| Debug UI deletion | Delete rendered surface, keep lib/ | The lib/ plumbing is reused; the components were debug scaffolding. |
