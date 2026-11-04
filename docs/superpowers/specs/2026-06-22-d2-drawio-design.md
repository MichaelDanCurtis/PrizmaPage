# D2 + draw.io Rendering — Design

> **Roadmap position:** Sub-project 6 of 7.
> **Architecture ref:** §10 Multi-Format Rendering (render-only).

## 1. Goal

Add the two remaining render-only diagram formats: **D2** (the modern diagram scripting language) and **draw.io** (mxGraph XML). Both are render-only — no execution surface — safe to add now that the runtime is solid.

## 2. Approach

### D2
- New `D2` library component. The D2 source is the children text: `<D2>x -> y</D2>`.
- Rendering: a Rust command `render_d2(source)` shells out to the `d2` binary (if installed), producing SVG. Returns the SVG string; the component injects it.
- Graceful degradation: if `d2` is not on PATH, the component shows the source in a styled code block with a "D2 not installed" hint.

### draw.io
- New `Drawio` library component. The draw.io XML is the children text: `<Drawio><mxfile>…</mxfile></Drawio>`.
- Rendering: draw.io diagrams are complex; the pragmatic, render-only path is to render via the official `jscolor`/`mxgraph` client is large. Instead, we render the XML's text labels in a styled placeholder and offer "Open in draw.io" which opens the diagram in the user's browser at `app.diagrams.net` with the XML payload (render-only, no execution in our sandbox). This gives a working integration without bundling the entire mxGraph renderer.

## 3. Files

- Rust: `render_d2(source)` command in lib.rs (shells out to `d2`).
- Frontend: `src/components/library/D2.tsx`, `src/components/library/Drawio.tsx`; register both in `index.ts`.
- Mock: `render_d2` returns a minimal SVG in the browser.

## 4. Testing

- Rust unit: `render_d2` returns an error string when `d2` is absent (not a panic).
- Frontend: both components register and render without error in the master walkthrough.

## 5. Non-goals

- Bundling the `d2` binary (user installs it).
- A full in-app draw.io editor (render + open-in-browser is the v1 surface).
- Live-editing diagram source in a peek (the existing CodePeek handles raw editing).
