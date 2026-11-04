# Capability Consent Prompt — Design

> **Roadmap position:** Sub-project 2 of 7 (UX-first sequence).
> **Status:** Design

## 1. Goal

Replace the Phase 0 stub that auto-grants every declared capability at open time with a real consent dialog. When a document declares capabilities (network hosts, storage, clipboard, MCP servers, AI providers), the user sees a prompt at open time and chooses what to allow. Nothing is granted without explicit approval — the security model's load-bearing feature.

## 2. Non-goals

- Per-request prompts at runtime (the manifest-level grant is sufficient for v1; runtime per-call prompts are a later refinement if needed).
- Remembering decisions across documents (each open is a fresh prompt; the OS keychain already handles credential persistence separately).
- Trusted-source signing integration (sub-project 3) — a verified signature could auto-trust, but that's deferred.

## 3. UX

### 3.1 When the prompt appears

On `openPath`, AFTER the document is read but BEFORE it renders, if `manifest.capabilities` is non-empty, show the consent modal. If empty (the common case for prose-only docs), skip straight to the viewer — no prompt.

### 3.2 The modal

Centered modal, blocks the document behind a backdrop. Shows:

- The document's origin domain (from `manifest.origin_domain`) — sets trust context
- One row per **distinct capability kind** the document declares, grouped:
  - **Network**: "Access these hosts:" + the listed scopes (chips)
  - **Storage**: "Store up to {N} on disk"
  - **Clipboard**: "Read/write the clipboard"
  - **MCP**: "Connect to MCP servers:" + the listed servers
  - **AI**: "Use AI providers:" + the listed providers
- Each row has an Allow/Deny toggle (Allow default for clipboard-like, Deny default for network/MCP — conservative).
- Two buttons: **Open** (grants the allowed set, opens the doc) and **Cancel** (returns to empty state, grants nothing).

### 3.3 Trust framing

The modal's header reads: *"This document wants to:"* — phrased as a request, not a demand. The origin domain is shown with a neutral ⓘ tooltip: "Documents from unverified origins can request capabilities. You're in control."

## 4. Data flow

1. `openPath(path)` reads the doc → checks `manifest.capabilities`.
2. If empty → proceed to viewer (current behavior).
3. If non-empty → set a `pendingConsent` state holding the manifest; render the `ConsentModal` instead of the viewer.
4. User picks Allow/Deny per kind → on Open, `grant_declared_capabilities` is called with a **filtered** capability list (only allowed ones), then the viewer opens.
5. On Cancel → clear pendingConsent, return to empty state.

## 5. Rust changes

`grant_declared_capabilities` already accepts a `Manifest`. The frontend will call it with a modified manifest whose `capabilities` field contains only the user-approved subset. No Rust change needed — the command grants whatever it's given.

## 6. File-level summary

**New (frontend):** `src/components/ConsentModal.tsx` + test. `src/lib/capabilityLabels.ts` (human-readable labels per capability kind, with test).

**Modified:** `src/hooks/useOpenDocument.ts` — add `pendingConsent` state; gate the open flow. `src/App.tsx` — render ConsentModal when pending. `src/lib/package.ts` — split `openDocument` so the grant is separate (or keep as-is and just don't call grant in openPath; the hook calls grant with the filtered set on Open).

## 7. Testing

- Unit: `capabilityLabels` produces correct labels per kind.
- Unit: `ConsentModal` renders rows per declared capability; toggling changes the allowed set; Open calls onGrant with the filtered list; Cancel calls onCancel.
- Visual: open a fixture doc with network+AI capabilities → modal appears with both rows → toggle one off → Open → viewer shows.
- The existing welcome doc (empty capabilities) opens without a prompt.

## 8. Definition of done

1. A doc with zero capabilities opens with no prompt (unchanged).
2. A doc declaring capabilities shows the modal; nothing is granted until Open.
3. Denying a capability means that capability's runtime requests are denied by the policy engine (verified via the existing `check_capability`).
4. Cancel returns to empty state with nothing granted.
