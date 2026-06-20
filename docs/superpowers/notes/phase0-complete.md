# Phase 0 Complete — Runtime + Sandbox Core

**Date:** 2026-06-20
**Branch:** `phase0/runtime-sandbox`
**Commits:** `a1f71d4` … `29fe24f` (11 task commits)

## What works

- **`.mdxz` packages** (zip) open via the Rust core; `manifest.json` is required; layer 1 (text) is always extractable; layer 2 (compiled JS) is optional for prose-only docs.
- **Manifest types** (`src-tauri/src/manifest.rs`) include the reserved `signature` field — forward-compatible with the trusted-source system, no format break later.
- **Policy engine** (`src-tauri/src/policy.rs`) starts at **zero** capabilities; only explicit grants allow requests; out-of-scope requests denied; categories never imply each other. The four policy tests are the security invariant made executable.
- **Capability granularity B**: coarse categories (`network`, `storage`, `clipboard`, `mcp`, `ai`) with optional domain scoping (`network:[github.com]`), matching the manifest format.
- **Fixture builder** (`npm run build:fixture`) compiles MDX at save via `@mdx-js/mdx` with `outputFormat: 'function-body'` and zips the three-layer layout. This is the minimal save/compile path — not the editor.
- **Precompiled MDX runs inside the webview** via `@mdx-js/mdx`'s `run()` with only the React jsx-runtime provided. Document code receives no host APIs.
- **Capability bridge** gates privileged calls; the hello fixture (no capabilities) yields `Denied` for an undeclared network request, proven by `engine_starts_at_zero_capabilities_and_denies_everything`. The privileged fixture path (`Allowed` for in-scope `github.com`) is proven by `granted_capability_allows_matching_request`.

## Corrections made to the plan during execution

Two plan bugs were caught and fixed during TDD (documented in their commits):

1. **Icon requirement** — Tauri's `generate_context!()` requires `src-tauri/icons/`. The plan didn't include it. Generated a proper icon set with `cargo tauri icon`. *(commit a1f71d4)*
2. **`run()` API misuse** — `@mdx-js/mdx`'s `run()` requires (a) `outputFormat: 'function-body'` output, not a program with import/export, and (b) a `RunOptions` object `{Fragment, jsx, jsxs, baseUrl}`, not the bare runtime. Fixed in `runner.ts` *and* the fixture builder's `compile()` call so end-to-end stayed consistent. *(commit 59ac4a1)*

Plus two smaller test-code fixes (unused import, `Option<String>` assertion) in the package test. *(commit 3d7a69c)*

## Known limits (by design, deferred to later phases)

- **Single document per app instance.** Multi-window/multi-doc arrives in Phase 2 with the viewer UI.
- **`grant_declared_capabilities` grants declared caps directly.** The open-time user prompt lands in Phase 2.
- **Ephemeral-origin isolation not yet enforced.** Tauri serves from one origin in dev. Per-document origin + per-process webview isolation arrives with the viewer UI in Phase 2. *Note:* the **policy** side of isolation (stateless engine, zero defaults, scope checks) IS in place, and the **browser sandbox** for content is inherited from the webview already (document code has no host APIs in `runner.ts`). Full origin/process isolation is the remaining piece.
- No AI, MCP plumbing, multi-format rendering, or editor UI yet — all later phases.

## Supply-chain note (tracked, not fixed)

`npm audit` reports 4 vulnerabilities, all tracing to one chain: **esbuild ≤ 0.24.2** (GHSA-67mh-4wv8-2f99), used transitively by Vite/Vitest. This is a **dev-server CSRF advisory affecting dev tooling only** — a malicious website you visit could send requests to your local Vite dev server. It does **not** affect the shipped app or the runtime sandbox (recipients never run Vite). `npm audit fix --force` would jump Vite 5 → 8 (unvalidated major) to silence a dev-only advisory. Decision: track, don't force-fix. Revisit when bumping Vite for real reasons.

This is exactly the supply-chain discipline the spec calls for: pin deps, audit, decide deliberately.

## How to run

```
npm install
npm run build:fixture   # compile-at-save the fixtures
cargo tauri dev         # open the viewer; deny path verified by default
```

## Test commands

```
cargo test           # Rust: manifest (2), policy (4), package (4) — 10 tests
npm test             # Frontend: capability (2), runner (2) — 4 tests
```

## End-to-end verification status

| Check | Status |
|-------|--------|
| `cargo test` — 10 Rust tests | ✅ pass |
| `npm test` — 4 frontend tests | ✅ pass |
| `npm run build:fixture` — produces both `.mdxz` | ✅ pass |
| `npm run build` — frontend builds (302 modules) | ✅ pass |
| `cargo build --release` — binary links | ✅ pass |
| `cargo tauri dev` — boots vite, compiles, launches window | ✅ pass (no errors in log) |
| Policy deny path (hello fixture) | ✅ proven by policy_test |
| Policy allow path (privileged fixture) | ✅ proven by policy_test |
| Rendered "Denied" text visible in window | ⚠️ not visually inspected (headless env) — **user to confirm** |

The last row is the only thing not verifiable from this environment. Everything upstream of the pixels is green.
