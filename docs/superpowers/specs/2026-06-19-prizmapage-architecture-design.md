# PrizmaPage — Architecture Design

**Date:** 2026-06-19
**Status:** Draft — pending user review
**Authors:** Michael Curtis + GLM (collaborative design session)

---

## 1. Vision

PrizmaPage is a viewer and editor for **shareable, executable mini-apps** authored in the MDX format. The core insight is that MDX is not inert text — it compiles to executable JavaScript (a React component tree). PrizmaPage embraces that property: an MDX file is treated as a small, self-contained program that can be opened, run, shared, and — in editor mode — extended with AI-generated components.

This is **Vision B** of the project: MDX files as lightweight, shareable mini-apps that act like active websites. The PDF-style "read a static document" experience is explicitly *not* the goal.

### Guiding product principle

> "Safe to run" is the property. "Unreadable" is not.

Confidentiality (encryption) is an optional, future, per-layer concern. The security intent is **trust + integrity**: can the user establish that a document is safe to run, and can the system guarantee it runs isolated and with only declared capabilities.

---

## 2. Core Terminology

| Term | Meaning |
|------|---------|
| **`.mdxz`** | PrizmaPage's package format. MDX lineage, "Z" signals compressed/archived bundle. Open format; the product is PrizmaPage, the format is `.mdxz`. |
| **Viewer mode** | Thin UI. The document fills the window. Minimal chrome. The mode a *recipient* of a shared mini-app lives in. No AI integration, no MCP server. |
| **Editor mode** | Beefy, IDE-class UI. Full editing surface, AI panel, component palette, MCP server. The mode an *author* lives in. |
| **Trusted core** | The Rust binary + built-in component library. Signed with the viewer. Holds the highest capability tier. Finite, auditable, under our control. |
| **Document code** | Anything inside the `.mdxz` — bundled components, AI-generated components, the compiled MDX itself. Attributed to an author via signature. Low/zero default capabilities. |
| **Capability bridge** | The audited API surface through which sandboxed document code requests privileged actions from the Rust core. |
| **Runtime** | The combination of the browser engine sandbox + capability bridge that turns a `.mdxz` into a running mini-app. |

---

## 3. Architectural Decisions (Locked)

### 3.1 Technology stack — Rust-first Tauri

- **Rust** owns the trusted core: package format, crypto, capability bridge, policy engine, MCP plumbing, AI provider auth.
- **OS webview** (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) is a **contained renderer** for MDX output only. It is not the substance of the app.
- **No bundled browser.** Startup is fast; the app's identity is Rust, not "a website in a frame."
- **Tauri feels native, not like wrapping, because** all logic lives in Rust and the webview is purely a display layer.

### 3.2 Security model — two load-bearing layers

This is the single most important section. The security intent is trust + integrity, achieved through **two independent layers that must not be conflated.**

**Layer 1 — The browser engine sandbox (contains untrusted content).**
The OS webview is the most hardened sandbox ever built, maintained by Google, Apple, and Mozilla against every hostile actor on Earth for 20+ years. We **inherit it** rather than build our own. Every custom sandbox ever built (Flash, Java, PDF) has been broken. We do not build a sandbox. We use the best one in existence.

**Layer 2 — Rust as the trusted core (handles everything the sandbox is allowed to do).**
Rust gives us memory safety in *PrizmaPage's own code*. That is a real and important win, but it is explicitly *not* a substitute for Layer 1. The threats that matter under Vision B — logic injection, prompt injection, supply chain compromise, hostile content — are not memory-safety problems and Rust does not address them. Those are addressed by Layer 1 (sandbox) + the policy engine (capabilities) + the trusted-source system (signatures).

**The correct mental model:** *"Rust means I don't worry about memory corruption in the trusted core. I still worry about everything else, and the supply chain harder than most."*

### 3.3 What Rust does *not* cover (must be designed for explicitly)

- **Logic injection.** `Command::new("sh").arg("-c").arg(user_input)` is memory-safe and is full command injection. SQL injection, path traversal, SSRF — all trivially writable in safe Rust. The borrow checker has no opinion on logic.
- **Supply chain.** Rust's biggest real-world incidents have been crate typosquatting and maintainer account takeovers. Memory-safe malicious code is still malicious. **Defense:** `cargo-audit`, `cargo-deny`, pinned deps, reproducible builds, SLSA provenance, every release.
- **Memory hygiene.** A crashing process dumps secrets in core files. Rust does not scrub memory on panic. **Defense:** disable core dumps in release builds; `zeroize` for keys.

---

## 4. The `.mdxz` Package Format

### 4.1 Three layers, never conflated

The PDF problem exists because PDF made *presentation* and *content* the same layer. PrizmaPage separates them by construction.

| Layer | What it is | Who needs it | Hardened? |
|-------|-----------|--------------|-----------|
| **Text (1)** | The prose — headings, paragraphs, lists, structure. | Vectorizers, search, RAG, screen readers, every AI tool. | **Never.** This is what makes it not-PDF. |
| **Executable (2)** | Compiled JS modules — mini-app logic, components, the AI-generated graph generator. | The runtime, only. | Yes — compiled at save; encryption is a future opt-in. |
| **Manifest (3)** | Metadata, capabilities, signature (reserved field), version, origin domain. | The viewer, the policy engine, the trust layer. | Signed, tamper-evident. |

### 4.2 Package layout

```
doc.mdxz  (zip archive)
├── manifest.json     # version, capabilities, signature (reserved), origin domain
├── content.md        # ← Layer 1: prose, ALWAYS plaintext, ALWAYS vectorizable
├── ast.json          # ← Layer 1 helper: structured form for fast indexing
├── build/            # ← Layer 2: compiled modules, runs at open
│   ├── main.js
│   └── components/
├── src/              # ← Layer 2 source, OPTIONAL (author's choice). Absent = IP-protected.
└── assets/           # images, D2, Mermaid, draw.io source, etc.
```

### 4.3 Compile-at-save

MDX is compiled to JS modules **at save time**, not at open time. Recipients run precompiled modules — fast, and not trivially readable as clean source. The source travels only if the author chooses to ship `src/`.

**Design rule:** Layer 1 (text) is *never* optional and *never* encrypted. Vectorizability is a guaranteed property of the format, not an author's good mood. Layer 2 encryption is an optional future phase, applied to the executable layer only.

### 4.4 Signature field — reserved from day one

The manifest reserves a `signature` field, empty in v1, so the format never has to break to add the trusted-source system later. **Forward-compatible design** — cheap now, expensive to retrofit.

---

## 5. Runtime & Sandbox Model

### 5.1 Per-document isolation (worm defense)

The scariest Vision-B threat is a worm that propagates between documents. It is designed out by construction:

- **Fresh, unique, ephemeral origin per open.** Every document opens in a throwaway UUID-scoped origin (like a one-off subdomain). Storage is scoped to that single document session and destroyed on close. **No document can see another's storage, ever.**
- **Stateless, per-session capability bridge.** The Rust bridge holds no state between documents — no cached capability, no reused connection, no carried token. Document A cannot plant something B inherits.
- **One fresh webview/renderer process per document.** Like browser site isolation: different memory space, different lifetime.
- **Trust can only come from a verified signature.** A worm inside a document can forge content but cannot forge the cryptographic signature without the private key it does not have. **The signature layer is what makes worm-escalation cryptographically impossible, not just policy-impossible.**

### 5.2 Compile-at-save runtime path

```
double-click .mdxz
  → Rust core unpacks zip, verifies manifest, reads signature (if present)
  → Rust core spawns fresh webview in ephemeral origin
  → webview loads build/main.js (precompiled; no open-time compile)
  → document runs in browser sandbox
  → privileged actions route through capability bridge → Rust core (gated by policy engine)
  → on close: ephemeral origin destroyed, process torn down
```

---

## 6. Capability Bridge & Policy Engine

### 6.1 Two capability tiers

- **Trusted core** — Rust bridge + built-in component library. Signed with the viewer binary. Holds the **highest** tier: elevated capabilities, because we wrote and audited them. E.g., a built-in `webhook` component can make specific network calls by default.
- **Document code** — bundled components, AI-generated components, anything from the package. Attributed to an author via signature. **Low/zero default capabilities; must request via manifest; gated by the policy engine.**

The built-in library is **higher-trust, not exempt from rules.** It is the highest tier of a capability ladder. Everything else earns its tier by signature + manifest + user consent.

### 6.2 Granularity — coarse categories with optional domain scoping

Declarations take the form: `network:[github.com, api.openai.com]`, `storage:10MB`, `clipboard`, etc.

This matches the phone-app mental model (model B: manifest declares, one prompt at open) and attenuates capabilities so a doc cannot get more than it needs. The prompt is meaningful and limited: *"This document wants network access to github.com and api.openai.com, and 10MB storage. Allow?"*

### 6.3 MCP as its own manifest category, routed through the bridge

- **What the user sees:** MCP is a top-level category. `mcp:[github, slack, filesystem]`. The prompt reads naturally: *"This document wants to use GitHub, Slack, and filesystem tools. Allow?"*
- **What actually happens:** when document code invokes an MCP tool, that tool's *effects* still flow through attenuated capabilities. A GitHub tool hitting the network → `network:api.github.com` check. Writing a file → `storage` check. **MCP never bypasses the capability ladder; it is sugar over the bridge.**

---

## 7. Component Model

### 7.1 Resolution order (D — all sources, with a fixed order)

1. **Built-in component library** — trusted core, signed with viewer, elevated capabilities.
2. **Bundled components** — shipped in the package's `build/`, signed with the author's key, treated as document code.
3. **AI-generated components** — created at **author time only**, frozen into `build/` on save, signed with author key, treated as document code.

### 7.2 The hard rule: AI generation is author-time only

**No AI code generation ever occurs on a recipient's machine at open time.** A recipient who chooses to edit becomes an author — generation then runs in editor mode with their consent, and the result is signed by them. Silent auto-generation on open is forbidden by design.

A recipient's open-time experience is: *run signed, precompiled components.* Never: *let the AI write and run new code on your machine.*

### 7.3 Security model is author-agnostic

It does not matter who wrote the code — human, AI, or monkey with a keyboard. All code runs in the same sandbox, through the same capability bridge, attributed by the same signature. **The AI does not get a special lane.** Its output goes through the exact pipeline as everyone else's.

The only AI-specific risk is **prompt injection from document content** — a hostile document containing prose designed to manipulate the AI during generation. This is mitigated by: AI generation runs only in editor mode (user consented); generated code is still sandboxed on the author's own machine; on save it is attributed to the author via their signature. Even a successful injection results in the author shipping a hostile component under their *own* signature — identical to an author maliciously writing hostile code themselves, which is a case already designed for. Prompt injection does not create a new threat class; it is a new path to an existing one.

---

## 8. Bidirectional MCP

### 8.1 The mode gate (the most important constraint)

**The MCP server only exists in editor mode.** Viewer mode exposes zero incoming-connection surface.

- **Viewer mode:** zero network surface for inbound. The doc can call *out* to manifest-declared MCP tools (client direction), but nothing *connects in*. A recipient's machine never listens. This eliminates the "every recipient runs a server" problem entirely.
- **Editor mode:** the author's machine runs the MCP server. Other agents connect *to* the document. The author is in control, has consented, and the trust boundary for inbound connections is "the author's own machine."

### 8.2 Direction 1 — Document as MCP client (viewer + editor modes)

The document calls MCP tools: `weather.lookup()`, `github.create_issue()`, `db.query()`. Capabilities are manifest-declared, user-approved at open, and capability-bridge-gated. This is how a mini-app *does stuff*.

### 8.3 Direction 2 — Document as MCP server (editor mode only)

The document *exposes* tools that external agents can call. This is the "ask the AI to build a graph generator that becomes part of this file" idea at full power: the author defines a tool — e.g., `document.generate_graph(data)` — and Claude, Copilot, Codex, Kimi, or GLM can connect and call it. The document becomes a programmable resource that agents integrate with.

- **Transport:** localhost-only by default (`127.0.0.1:port` or Unix domain socket). External machines cannot connect; only local agents can.
- **Remote agents** require an explicit, deliberate opt-in by the author.
- **Tool execution:** when an agent calls a document-exported tool, it executes in the sandbox and routes privileged actions through the same capability bridge.

### 8.4 Mode transition is explicit

Switching from viewer to editor is a deliberate act that:
1. Brings up the MCP server (document starts listening on localhost).
2. Unlocks AI generation on the author's machine.
3. Registers the document's exported tools with connecting agents.

**Editor mode is "authoring with power tools, on a machine you control." Viewer mode is "running something someone else made, with strict limits."** No silent blending.

---

## 9. Trusted-Source System (future phase — designed for now)

The author's DKIM-style intuition: a company publishes a public key in a DNS TXT record (DNSSEC-protected) at e.g. `_prizm.acme.com`. Their authoring tool signs each `.mdxz` with the private key and embeds the signature + signing domain in the manifest. The viewer fetches the public key over DNSSEC, verifies the signature, and checks the domain against a trusted-domains list. Trusted domains get reduced or skipped permission prompts; unknown domains get the full model-B manifest prompt.

This is the **worm brake** (§5.1) and the **trust mechanism** that makes model B scale. Reserved in the manifest now; shipped in a later phase.

---

## 10. Multi-Format Rendering

Layer-1-adjacent rendering of embedded formats, all **render-only** (no execution surface):

- **D2** diagrams
- **Mermaid** diagrams
- **draw.io** diagrams

Safe to add once the runtime is solid because they introduce no new execution surface.

---

## 11. AI Provider Integration (later phase)

Vision-B magic: "ask the AI to build a graph generator and it becomes part of this file." Planned providers:

- GitHub Copilot (OAuth)
- Codex (ACP / OAuth)
- Kimi Code (ACP)
- GLM

All provider calls route through the capability bridge as `ai` capabilities. Generated components follow §7 (author-time only, frozen into `build/`, signed with author key).

---

## 12. Build Order (Phased Decomposition)

Each phase produces something usable and testable. No big-bang integration.

| Phase | Sub-project | Why this order |
|-------|------------|----------------|
| **0** | Runtime + sandbox core — compile (already compiled at save), execute isolated, capability bridge with zero default capabilities | *This is the product.* Nothing else is buildable until untrusted MDX runs without escaping. |
| **1** | Package format (`.mdxz` zip, three-layer layout, manifest with reserved signature) | A mini-app that can't be saved and reopened is a demo, not a product. |
| **2** | Viewer + editor UI (lean viewer, beefy editor, clean runtime↔UI boundary) | Bolt the UI onto a runtime that already works safely. Editor last because mini-apps don't need editing to be shareable. |
| **3** | Built-in component library (charts, tables, etc.) | Gives authors something to compose with before AI exists. |
| **4** | Multi-format rendering (D2, Mermaid, draw.io) | Render-only; no execution surface; safe once runtime is solid. |
| **5** | Single AI provider + MCP client direction (pick ONE of Copilot/Codex/Kimi/GLM) | Prove the pattern with one before generalizing. |
| **5.5** | Trusted-source signing system (worm brake, model-B scaling) | Backbone of trust; reserved since phase 1. |
| **6** | Multi-provider + bidirectional MCP (server direction, editor-only) | Generalize the proven pattern. |
| **7** | Polish (code completion, autocomplete, spell check, editor power features) | Refinement once the bones are solid. |

---

## 13. Open Questions / Future Work

- **Encryption phase** (post-7): optional per-layer encryption of the executable layer only. Layer 1 is excluded from encryption by policy.
- **Remote MCP server opt-in UX** (phase 6): how the author explicitly grants remote agent access; the "scary dialog" design.
- **Cross-platform webview CI matrix** (phase 0): pin minimum webview versions; run the MDX test suite against WebKit, WebView2, WebKitGTK before every release.
- **Supply-chain hardening** (phase 0 onward): `cargo-audit`, `cargo-deny`, pinned deps, reproducible builds, SLSA provenance as a standing release discipline.

---

## 14. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Format file extension | `.mdxz` | MDX lineage + "Z" signals compressed bundle; open format vs. branded product. |
| Tech stack | Rust-first Tauri, OS webview, no bundled browser | Execution speed; Rust boundary discipline; browser sandbox as security backbone. |
| Security model | Browser sandbox (Layer 1) + Rust trusted core (Layer 2) | Don't build a sandbox — inherit the best one ever built. Rust covers memory safety; everything else is designed for explicitly. |
| Package layers | Three: text / executable / manifest | Avoid the PDF problem (conflating content and presentation). |
| Vectorizability | Layer 1 always plaintext, never encrypted | Guaranteed property of the format. |
| Compile strategy | Compile at save, precompiled at open | Fast open; not trivially readable as source. |
| Component model | Resolution order: built-in → bundled → AI-gen-author-time | All sources, fixed order, author-agnostic security. |
| AI generation timing | Author-time only, never recipient-open-time | Security line: recipients never execute freshly AI-generated code. |
| Capability granularity | Coarse categories + domain scoping (B) | Phone-app mental model; meaningful, limited prompts. |
| MCP manifest treatment | Own category, routed through bridge | Clean UX on top; zero security bypass underneath. |
| MCP server direction | Editor mode only; localhost by default | Collapses the inbound attack surface to the author's trusted machine. |
| Trusted source | DKIM-style DNS + DNSSEC signing (future phase) | The worm brake; reserved in manifest from day one. |
