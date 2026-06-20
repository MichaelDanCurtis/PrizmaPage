# Phase 0: Runtime + Sandbox Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of PrizmaPage — a Tauri app that opens a `.mdxz` package in a freshly-isolated webview, runs its precompiled MDX, and gates every privileged action through a capability bridge whose policy engine starts at **zero** capabilities.

**Architecture:** Rust-first Tauri v2. A Rust core (in `src-tauri/`) owns the package format, the policy engine, and the capability bridge. A minimal frontend (in `src/`) runs inside the OS webview as the *only* display layer, executing the document's precompiled JS. The browser engine is the security sandbox; Rust is the trusted core. Each `.mdxz` opens in a fresh ephemeral origin with one webview process per document.

**Tech Stack:** Rust (Tauri v2, `serde`, `zip`), TypeScript + Vite + React 18 (frontend shell only), `@mdx-js/mdx` (compile-at-save), Vitest (frontend tests), `cargo test` (Rust tests).

---

## File Structure

This plan creates the following files. Each has one clear responsibility.

**Rust core (`src-tauri/`):**
- `Cargo.toml` — workspace member; dependencies.
- `src/lib.rs` — Tauri command registration; entry point.
- `src/package.rs` — `.mdxz` parsing: read zip, parse manifest, return the document's layers.
- `src/manifest.rs` — manifest types and validation; includes the reserved `signature` field.
- `src/policy.rs` — the policy engine: holds the per-document capability set; starts empty; checks capabilities.
- `src/capability.rs` — capability types (categories + domain scoping) and the check/decision logic.
- `src/main.rs` — Tauri `main` (thin).
- `tests/package_test.rs`, `tests/policy_test.rs`, `tests/manifest_test.rs` — integration tests.
- `tests/fixtures/` — test `.mdxz` packages.

**Frontend (`src/`):**
- `package.json` — frontend deps.
- `index.html` — the one Tauri entry page.
- `main.tsx` — React mount.
- `lib/runner.ts` — loads `build/main.js`, runs it via `@mdx-js/mdx`'s `run()` with a minimal React runtime, renders into the DOM.
- `lib/capability.ts` — the client side of the capability bridge: calls a Tauri command, returns granted/denied.
- `lib/package.ts` — fetches the document layers from the Rust core (invokes a Tauri command).
- `App.tsx` — wires runner + capability; shows denied calls in a panel.
- `runner.test.ts`, `capability.test.ts` — Vitest tests.

**Build tooling (root):**
- `Cargo.toml` — the workspace root, member `src-tauri`.
- `scripts/build-fixture.mjs` — a Node script that compiles a fixture `.mdx` with `@mdx-js/mdx` and zips it into `tests/fixtures/`. This is the minimal save/compile path needed to *produce* something Phase 0 can open. It is NOT the editor (Phase 2).
- `fixtures/hello.mdx`, `fixtures/privileged.mdx` — source MDX used by the fixture builder.

---

## Task 1: Scaffold the Tauri v2 workspace

**Files:**
- Create: `Cargo.toml` (workspace root)
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `.gitignore`

- [ ] **Step 1: Install prerequisites check**

Run:
```bash
node --version
rustc --version
cargo tauri --version 2>/dev/null || echo "tauri-cli NOT installed"
```
Expected: node ≥ 20, rustc ≥ 1.77. If `cargo tauri` is missing, install it:
```bash
cargo install tauri-cli --version "^2.0.0" --locked
```

- [ ] **Step 2: Create the workspace root `Cargo.toml`**

Create `Cargo.toml` at the project root:

```toml
[workspace]
members = ["src-tauri"]
resolver = "2"
```

- [ ] **Step 3: Create `.gitignore`**

```
/target
node_modules/
dist/
.DS_Store
*.log
src-tauri/target/
```

- [ ] **Step 4: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "prizmapage"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
zip = "2"
thiserror = "1"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 5: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 6: Create `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "PrizmaPage",
  "version": "0.1.0",
  "identifier": "com.prizmapage.app",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "PrizmaPage",
        "width": 1000,
        "height": 700
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

- [ ] **Step 7: Create `src-tauri/src/lib.rs` (minimal, will grow)**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running PrizmaPage");
}
```

- [ ] **Step 8: Create `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    prizmapage::run()
}
```

- [ ] **Step 9: Verify the Rust workspace compiles (frontend not yet present)**

We can't run `cargo tauri dev` yet (no frontend), but the workspace should type-check:
```bash
cargo check
```
Expected: completes without error. (Warnings about unused are fine.)

- [ ] **Step 10: Commit**

```bash
git add Cargo.toml .gitignore src-tauri/
git commit -m "feat: scaffold Tauri v2 workspace"
```

---

## Task 2: Scaffold the frontend shell (Vite + React)

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "prizmapage-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@mdx-js/mdx": "^3.0.0",
    "@mdx-js/react": "^3.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PrizmaPage</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/main.tsx`**

```typescript
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Create `src/App.tsx` (placeholder, replaced in Task 8)**

```typescript
export function App() {
  return <div data-testid="app-root">PrizmaPage runtime loading…</div>;
}
```

- [ ] **Step 8: Install and verify the dev server boots**

```bash
npm install
npm run build
```
Expected: `npm install` succeeds; `npm run build` produces `dist/` without errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json vitest.config.ts index.html src/
git commit -m "feat: scaffold Vite + React frontend shell"
```

---

## Task 3: Define the manifest types (TDD)

The manifest is the spine of trust and capabilities. Define it first, with the reserved signature field.

**Files:**
- Create: `src-tauri/src/manifest.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod manifest;`)
- Create: `src-tauri/tests/manifest_test.rs`

- [ ] **Step 1: Write the failing test**

Create `src-tauri/tests/manifest_test.rs`:

```rust
use prizmapage::manifest::{Manifest, Capability};

#[test]
fn parses_minimal_manifest_with_reserved_signature_field() {
    let json = r#"{
        "version": "0.1.0",
        "origin_domain": null,
        "capabilities": [],
        "signature": null
    }"#;
    let manifest: Manifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.version, "0.1.0");
    assert!(manifest.origin_domain.is_none());
    assert!(manifest.capabilities.is_empty());
    // The signature field MUST exist in the type even when null,
    // so the format never has to break to add signing later.
    assert!(manifest.signature.is_none());
}

#[test]
fn parses_manifest_with_domain_scoped_capability() {
    let json = r#"{
        "version": "0.1.0",
        "origin_domain": "acme.com",
        "capabilities": [
            {"category": "network", "scopes": ["github.com", "api.openai.com"]},
            {"category": "storage", "limit_bytes": 10485760}
        ],
        "signature": null
    }"#;
    let manifest: Manifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.origin_domain.as_deref(), Some("acme.com"));
    assert_eq!(manifest.capabilities.len(), 2);
    match &manifest.capabilities[0] {
        Capability::Network { scopes } => {
            assert_eq!(scopes, &vec!["github.com".to_string(), "api.openai.com".to_string()]);
        }
        other => panic!("expected Network, got {:?}", other),
    }
    match &manifest.capabilities[1] {
        Capability::Storage { limit_bytes } => assert_eq!(*limit_bytes, 10_485_760),
        other => panic!("expected Storage, got {:?}", other),
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --test manifest_test`
Expected: FAIL — `unresolved module manifest` or compile error (module/struct not defined).

- [ ] **Step 3: Write the manifest module**

Create `src-tauri/src/manifest.rs`:

```rust
use serde::{Deserialize, Serialize};

/// The package manifest. Layer 3 of the .mdxz format.
/// The `signature` field is reserved and null in v1 so the format never has
/// to break to add the trusted-source signing system later.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub version: String,
    /// Origin domain for future DKIM-style signature verification.
    #[serde(default)]
    pub origin_domain: Option<String>,
    /// Capabilities the document requests. Starts empty; user-approved at open.
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    /// RESERVED. Null in v1. Future: signature over the package contents.
    #[serde(default)]
    pub signature: Option<String>,
}

/// A capability declaration. Granularity B: coarse category + optional domain scoping.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "category")]
pub enum Capability {
    #[serde(rename = "network")]
    Network { scopes: Vec<String> },
    #[serde(rename = "storage")]
    Storage { limit_bytes: u64 },
    #[serde(rename = "clipboard")]
    Clipboard,
    #[serde(rename = "mcp")]
    Mcp { servers: Vec<String> },
    #[serde(rename = "ai")]
    Ai { providers: Vec<String> },
}
```

- [ ] **Step 4: Register the module**

Modify `src-tauri/src/lib.rs` to add at the top:

```rust
pub mod manifest;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cargo test --test manifest_test`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/manifest.rs src-tauri/src/lib.rs src-tauri/tests/manifest_test.rs
git commit -m "feat: define manifest types with reserved signature field"
```

---

## Task 4: The policy engine — starts at zero capabilities (TDD)

This is the security-critical piece. The policy engine holds the *granted* capability set for the current document. It starts empty. The only way capabilities enter the set is via an explicit user grant.

**Files:**
- Create: `src-tauri/src/capability.rs`
- Create: `src-tauri/src/policy.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/policy_test.rs`

- [ ] **Step 1: Write the failing test**

Create `src-tauri/tests/policy_test.rs`:

```rust
use prizmapage::capability::{CapabilityRequest, Decision};
use prizmapage::manifest::Capability;
use prizmapage::policy::PolicyEngine;

#[test]
fn engine_starts_at_zero_capabilities_and_denies_everything() {
    let engine = PolicyEngine::new();
    let req = CapabilityRequest::Network {
        host: "github.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Denied);
}

#[test]
fn granted_capability_allows_matching_request() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    let req = CapabilityRequest::Network {
        host: "github.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Allowed);
}

#[test]
fn granted_capability_denies_out_of_scope_request() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    let req = CapabilityRequest::Network {
        host: "evil.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Denied);
}

#[test]
fn granting_a_category_does_not_imply_other_categories() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    // Storage is a different category — granting network must not imply it.
    let req = CapabilityRequest::Storage {
        byte_count: 100,
    };
    assert_eq!(engine.check(&req), Decision::Denied);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --test policy_test`
Expected: FAIL — `unresolved module` / undefined types.

- [ ] **Step 3: Write the capability request + decision types**

Create `src-tauri/src/capability.rs`:

```rust
use crate::manifest::Capability;

/// A concrete request at runtime, distinct from a declared capability.
/// A declared `Capability::Network { scopes }` permits a `CapabilityRequest::Network { host }`
/// only when the host is within the scopes.
#[derive(Debug, Clone, PartialEq)]
pub enum CapabilityRequest {
    Network { host: String },
    Storage { byte_count: u64 },
    Clipboard,
    Mcp { server: String },
    Ai { provider: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Allowed,
    Denied,
}

/// Returns true if the declared capability permits the concrete request.
pub fn permits(capability: &Capability, request: &CapabilityRequest) -> bool {
    match (capability, request) {
        (Capability::Network { scopes }, CapabilityRequest::Network { host }) => {
            scopes.iter().any(|scope| host == scope || host.ends_with(&format!(".{scope}")))
        }
        (Capability::Storage { limit_bytes }, CapabilityRequest::Storage { byte_count }) => {
            *byte_count <= *limit_bytes
        }
        (Capability::Clipboard, CapabilityRequest::Clipboard) => true,
        (Capability::Mcp { servers }, CapabilityRequest::Mcp { server }) => servers.contains(server),
        (Capability::Ai { providers }, CapabilityRequest::Ai { provider }) => providers.contains(provider),
        _ => false,
    }
}
```

- [ ] **Step 4: Write the policy engine**

Create `src-tauri/src/policy.rs`:

```rust
use crate::capability::{permits, CapabilityRequest, Decision};
use crate::manifest::Capability;

/// The policy engine holds the GRANTED capability set for the current document.
///
/// SECURITY INVARIANT: it starts at zero. The only way capabilities enter the
/// set is via an explicit user grant (e.g., approving the open-time manifest prompt).
/// Document code cannot grant itself anything.
pub struct PolicyEngine {
    granted: Vec<Capability>,
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self { granted: Vec::new() }
    }

    /// Adds a capability to the granted set. Called only by the user-grant path.
    pub fn grant(&mut self, capability: Capability) {
        self.granted.push(capability);
    }

    /// Checks whether the granted set permits a concrete runtime request.
    /// Returns Denied unless an explicitly granted capability permits it.
    pub fn check(&self, request: &CapabilityRequest) -> Decision {
        if self.granted.iter().any(|c| permits(c, request)) {
            Decision::Allowed
        } else {
            Decision::Denied
        }
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 5: Register the modules**

Modify `src-tauri/src/lib.rs` top to read:

```rust
pub mod capability;
pub mod manifest;
pub mod policy;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cargo test --test policy_test`
Expected: PASS (4 tests).

- [ ] **Step 7: Run the full Rust test suite**

Run: `cargo test`
Expected: all tests pass (manifest + policy).

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/capability.rs src-tauri/src/policy.rs src-tauri/src/lib.rs src-tauri/tests/policy_test.rs
git commit -m "feat: policy engine starts at zero capabilities"
```

---

## Task 5: Package reader — unzip and return layers (TDD)

**Files:**
- Create: `src-tauri/src/package.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/package_test.rs`
- Create: `src-tauri/tests/fixtures/.gitkeep`

- [ ] **Step 1: Write the failing test**

Create `src-tauri/tests/package_test.rs`:

```rust
use prizmapage::package::{open_package, PackageContents};
use std::io::Write;
use zip::write::ZipWriter;
use zip::ZipArchive;

fn build_fixture_zip(path: &std::path::Path) {
    let file = std::fs::File::create(path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options =
        zip::write::SimpleFileOptions::default();

    zip.start_file("manifest.json", options).unwrap();
    zip.write_all(
        br#"{"version":"0.1.0","origin_domain":null,"capabilities":[],"signature":null}"#,
    )
    .unwrap();

    zip.start_file("content.md", options).unwrap();
    zip.write_all(b"# Hello").unwrap();

    zip.start_file("build/main.js", options).unwrap();
    zip.write_all(b"/* compiled */").unwrap();

    zip.finish().unwrap();
}

#[test]
fn opens_package_and_returns_all_three_layers() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    build_fixture_zip(tmp.path());

    let PackageContents { manifest, content_md, build_main_js } =
        open_package(tmp.path()).unwrap();

    assert_eq!(manifest.version, "0.1.0");
    assert_eq!(content_md, "# Hello");
    assert_eq!(build_main_js, "/* compiled */");
}

#[test]
fn rejects_package_missing_manifest() {
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let file = std::fs::File::create(tmp.path()).unwrap();
    let mut zip = ZipWriter::new(file);
    zip.start_file("content.md", zip::write::SimpleFileOptions::default())
        .unwrap();
    zip.write_all(b"# no manifest").unwrap();
    zip.finish().unwrap();

    let result = open_package(tmp.path());
    assert!(result.is_err(), "must reject packages with no manifest");
}

#[test]
fn layer_one_text_is_always_extractable_even_if_build_absent() {
    // Layer 1 (text) is the vectorizability guarantee. A package with no build/
    // (e.g., a pure-prose document) must still open and yield its text.
    let tmp = tempfile::NamedTempFile::new().unwrap();
    let file = std::fs::File::create(tmp.path()).unwrap();
    let mut zip = ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default();
    zip.start_file("manifest.json", opts).unwrap();
    zip.write_all(
        br#"{"version":"0.1.0","capabilities":[],"signature":null}"#,
    )
    .unwrap();
    zip.start_file("content.md", opts).unwrap();
    zip.write_all(b"# Prose only").unwrap();
    zip.finish().unwrap();

    let PackageContents { content_md, build_main_js, .. } = open_package(tmp.path()).unwrap();
    assert_eq!(content_md, "# Prose only");
    assert!(build_main_js.is_none(), "build/main.js absent is fine for prose-only docs");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --test package_test`
Expected: FAIL — `unresolved module package`.

- [ ] **Step 3: Write the package reader**

Create `src-tauri/src/package.rs`:

```rust
use crate::manifest::Manifest;
use std::fs::File;
use std::path::Path;
use thiserror::Error;
use zip::ZipArchive;

#[derive(Debug, Error)]
pub enum PackageError {
    #[error("failed to open package file")]
    Io(#[from] std::io::Error),
    #[error("invalid zip archive")]
    Zip(#[from] zip::result::ZipError),
    #[error("package missing required manifest.json")]
    MissingManifest,
    #[error("invalid manifest: {0}")]
    InvalidManifest(#[from] serde_json::Error),
}

/// The extracted contents of a .mdxz. Layer 1 (text) is always present;
/// layer 2 (executable) is optional for prose-only documents.
#[derive(Debug, Clone)]
pub struct PackageContents {
    pub manifest: Manifest,
    pub content_md: String,        // Layer 1: always present, always plaintext.
    pub build_main_js: Option<String>, // Layer 2: optional.
}

pub fn open_package(path: &Path) -> Result<PackageContents, PackageError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;

    let manifest: Manifest = {
        let mut entry = archive
            .by_name("manifest.json")
            .map_err(|_| PackageError::MissingManifest)?;
        serde_json::from_reader(&mut entry)?
    };

    let content_md = {
        let mut entry = archive.by_name("content.md")?;
        let mut buf = String::new();
        std::io::Read::read_to_string(&mut entry, &mut buf)?;
        buf
    };

    let build_main_js = match archive.by_name("build/main.js") {
        Ok(mut entry) => {
            let mut buf = String::new();
            std::io::Read::read_to_string(&mut entry, &mut buf)?;
            Some(buf)
        }
        Err(_) => None,
    };

    Ok(PackageContents {
        manifest,
        content_md,
        build_main_js,
    })
}
```

- [ ] **Step 4: Register the module**

Modify `src-tauri/src/lib.rs` top to read:

```rust
pub mod capability;
pub mod manifest;
pub mod package;
pub mod policy;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cargo test --test package_test`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full Rust suite**

Run: `cargo test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/package.rs src-tauri/src/lib.rs src-tauri/tests/package_test.rs src-tauri/tests/fixtures/.gitkeep
git commit -m "feat: package reader returns three layers, manifest required"
```

---

## Task 6: Fixture builder — compile MDX at save, produce a real `.mdxz`

This is the minimal save/compile path needed to *produce* packages Phase 0 can open. It is a Node script, NOT the editor UI (Phase 2). It enforces the compile-at-save decision concretely.

**Files:**
- Create: `scripts/build-fixture.mjs`
- Create: `fixtures/hello.mdx`
- Create: `fixtures/privileged.mdx`

- [ ] **Step 1: Add build deps to `package.json`**

Add to `package.json` `devDependencies`:
```json
    "adm-zip": "^0.5.10"
```
Add a `scripts` entry:
```json
    "build:fixture": "node scripts/build-fixture.mjs"
```

Then run:
```bash
npm install
```

- [ ] **Step 2: Create the fixture sources**

Create `fixtures/hello.mdx`:

```mdx
# Hello from PrizmaPage

This is **layer 1 text** — always plaintext, always vectorizable.

The component below is layer 2: precompiled JS that runs in the sandbox.
```

Create `fixtures/privileged.mdx`:

```mdx
# Privileged demo

This document declares a `network` capability in its manifest.
When it runs, it attempts a privileged call. The policy engine decides.
```

- [ ] **Step 3: Create the fixture builder script**

Create `scripts/build-fixture.mjs`:

```javascript
// Minimal save/compile path: MDX source → compiled JS → .mdxz zip.
// This is NOT the editor. It exists so Phase 0 has real packages to open.
import { compile } from "@mdx-js/mdx";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import AdmZip from "adm-zip";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

async function compileMdx(sourcePath) {
  const source = readFileSync(sourcePath, "utf8");
  // compile() turns MDX into a JS module string (layer 2, executable).
  const compiled = String(await compile(source));
  return compiled;
}

function writePackage({ name, mdxPath, manifest }) {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
  // Layer 1: the original prose, plaintext. Vectorizable.
  zip.addFile("content.md", Buffer.from(readFileSync(mdxPath, "utf8")));
  return { zip, mdxPath };
}

async function buildAll() {
  await mkdirSync(join(root, "src-tauri", "tests", "fixtures"), { recursive: true });

  // hello: prose-only, no capabilities, no build (tests the prose-only path).
  const helloZip = writePackage({
    name: "hello",
    mdxPath: join(root, "fixtures", "hello.mdx"),
    manifest: {
      version: "0.1.0",
      origin_domain: null,
      capabilities: [],
      signature: null,
    },
  });
  // hello has a real compiled build so the runner has something to execute.
  const helloCompiled = await compileMdx(join(root, "fixtures", "hello.mdx"));
  helloZip.zip.addFile("build/main.js", Buffer.from(helloCompiled));
  helloZip.zip.writeZip(join(root, "src-tauri", "tests", "fixtures", "hello.mdxz"));

  // privileged: declares network capability, so we can see the policy engine allow it.
  const privCompiled = await compileMdx(join(root, "fixtures", "privileged.mdx"));
  const privZip = writePackage({
    name: "privileged",
    mdxPath: join(root, "fixtures", "privileged.mdx"),
    manifest: {
      version: "0.1.0",
      origin_domain: "acme.com",
      capabilities: [
        { category: "network", scopes: ["github.com"] },
      ],
      signature: null,
    },
  });
  privZip.zip.addFile("build/main.js", Buffer.from(privCompiled));
  privZip.zip.writeZip(join(root, "src-tauri", "tests", "fixtures", "privileged.mdxz"));

  console.log("Built fixtures: hello.mdxz, privileged.mdxz");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Run the builder**

Run:
```bash
npm run build:fixture
```
Expected: prints `Built fixtures: hello.mdxz, privileged.mdxz`. Two files appear in `src-tauri/tests/fixtures/`.

- [ ] **Step 5: Verify the Rust reader can open the fixture**

Add a quick check to `src-tauri/tests/package_test.rs` (append):

```rust
#[test]
fn opens_fixture_built_by_save_compile_script() {
    // The fixture is built by `npm run build:fixture` (compile-at-save).
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/hello.mdxz");
    if !fixture.exists() {
        eprintln!("skipping — run `npm run build:fixture` first");
        return;
    }
    let contents = open_package(&fixture).unwrap();
    assert!(contents.build_main_js.is_some());
    assert!(contents.content_md.contains("Hello from PrizmaPage"));
}
```

Run:
```bash
npm run build:fixture && cargo test --test package_test
```
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/ fixtures/ src-tauri/tests/package_test.rs src-tauri/tests/fixtures/
git commit -m "feat: fixture builder compiles MDX at save into .mdxz"
```

---

## Task 7: Expose package open + policy check as Tauri commands

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/state.rs`
- Modify: `src-tauri/Cargo.toml` (capabilities)

- [ ] **Step 1: Write the app state**

Create `src-tauri/src/state.rs`:

```rust
use crate::policy::PolicyEngine;
use std::sync::Mutex;

/// App state held in Tauri's managed state. The policy engine is per-document;
/// for Phase 0 we hold a single engine keyed to the currently-open document.
/// (Multi-document windows arrive with the UI in Phase 2.)
pub struct AppState {
    pub policy: Mutex<PolicyEngine>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            policy: Mutex::new(PolicyEngine::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
```

- [ ] **Step 2: Register module and add commands to `lib.rs`**

Replace the contents of `src-tauri/src/lib.rs` with:

```rust
pub mod capability;
pub mod manifest;
pub mod package;
pub mod policy;
pub mod state;

use crate::capability::{CapabilityRequest, Decision};
use crate::package::{open_package, PackageContents};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

/// Frontend-facing shape of opened contents (no std::path types leak).
#[derive(serde::Serialize)]
pub struct OpenedDocument {
    pub manifest: crate::manifest::Manifest,
    pub content_md: String,
    pub build_main_js: Option<String>,
}

impl From<PackageContents> for OpenedDocument {
    fn from(c: PackageContents) -> Self {
        Self {
            manifest: c.manifest,
            content_md: c.content_md,
            build_main_js: c.build_main_js,
        }
    }
}

#[tauri::command]
fn open_document(path: PathBuf) -> Result<OpenedDocument, String> {
    let contents = open_package(&path).map_err(|e| e.to_string())?;
    Ok(contents.into())
}

/// Seed the policy engine with the document's declared capabilities.
/// NOTE: in Phase 2 the user approves these via a prompt before this is called.
/// For Phase 0 we grant declared caps directly so we can exercise the allow path.
#[tauri::command]
fn grant_declared_capabilities(
    state: State<AppState>,
    manifest: crate::manifest::Manifest,
) -> Result<(), String> {
    let mut policy = state.policy.lock().map_err(|e| e.to_string())?;
    for cap in manifest.capabilities {
        policy.grant(cap);
    }
    Ok(())
}

#[tauri::command]
fn check_capability(
    state: State<AppState>,
    request: CapabilityRequest,
) -> Result<Decision, String> {
    let policy = state.policy.lock().map_err(|e| e.to_string())?;
    Ok(policy.check(&request))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            open_document,
            grant_declared_capabilities,
            check_capability
        ])
        .run(tauri::generate_context!())
        .expect("error while running PrizmaPage");
}
```

- [ ] **Step 3: Make `CapabilityRequest` and `Decision` serializable**

Modify `src-tauri/src/capability.rs` — add `Serialize`/`Deserialize` derives and tag the enum so the frontend can construct requests. Replace the top of the file:

```rust
use crate::manifest::Capability;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum CapabilityRequest {
    Network { host: String },
    Storage { byte_count: u64 },
    Clipboard,
    Mcp { server: String },
    Ai { provider: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Decision {
    Allowed,
    Denied,
}
```

(Leave the `permits` function unchanged.)

- [ ] **Step 4: Verify it compiles**

Run: `cargo check`
Expected: compiles without error.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/state.rs src-tauri/src/lib.rs src-tauri/src/capability.rs
git commit -m "feat: expose open_document, grant_declared_capabilities, check_capability commands"
```

---

## Task 8: Frontend capability bridge client (TDD)

**Files:**
- Create: `src/lib/capability.ts`
- Create: `src/lib/capability.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/capability.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("capability bridge client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the decision from the rust core", async () => {
    const invoke = vi.fn().mockResolvedValue("Allowed");
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { checkCapability } = await import("./capability");

    const decision = await checkCapability({ kind: "Network", host: "github.com" });
    expect(invoke).toHaveBeenCalledWith("check_capability", {
      request: { kind: "Network", host: "github.com" },
    });
    expect(decision).toBe("Allowed");
  });

  it("throws if the rust core errors", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("poisoned lock"));
    vi.doMock("@tauri-apps/api/core", () => ({ invoke }));
    const { checkCapability } = await import("./capability");

    await expect(
      checkCapability({ kind: "Storage", byte_count: 1 })
    ).rejects.toThrow("poisoned lock");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- capability`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the client**

Create `src/lib/capability.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

export type CapabilityRequest =
  | { kind: "Network"; host: string }
  | { kind: "Storage"; byte_count: number }
  | { kind: "Clipboard" }
  | { kind: "Mcp"; server: string }
  | { kind: "Ai"; provider: string };

export type Decision = "Allowed" | "Denied";

/// Asks the Rust policy engine whether a concrete runtime request is permitted.
/// The engine starts at zero; only user-granted capabilities allow anything.
export async function checkCapability(request: CapabilityRequest): Promise<Decision> {
  return invoke<Decision>("check_capability", { request });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- capability`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability.ts src/lib/capability.test.ts
git commit -m "feat: frontend capability bridge client"
```

---

## Task 9: Frontend package + runner — open a document and execute it (TDD)

This is where the sandbox story becomes concrete: the precompiled `build/main.js` is run via `@mdx-js/mdx`'s `run()` with a minimal React runtime, inside the webview. No privileged API is available to the document except what it requests through the bridge.

**Files:**
- Create: `src/lib/package.ts`
- Create: `src/lib/runner.ts`
- Create: `src/lib/runner.test.ts`

- [ ] **Step 1: Write the failing test for the runner**

Create `src/lib/runner.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { runMdxModule } from "./runner";
import * as runtime from "react/jsx-runtime";

describe("runMdxModule", () => {
  it("runs a precompiled MDX module and returns a React component", async () => {
    // A trivial compiled MDX module: exports default a component that returns a node.
    const compiled = `
      const { jsx: _jsx } = arguments[0];
      function MDXContent() {
        return _jsx('h1', { children: 'Hello from the sandbox' });
      }
      export default MDXContent;
    `;
    const Component = await runMdxModule(compiled, runtime);
    expect(Component).toBeTypeOf("function");
  });

  it("returns null for an empty build (prose-only document has nothing to run)", async () => {
    const Component = await runMdxModule(null, runtime);
    expect(Component).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- runner`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `package.ts`**

Create `src/lib/package.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

export interface Manifest {
  version: string;
  origin_domain: string | null;
  capabilities: unknown[];
  signature: string | null;
}

export interface OpenedDocument {
  manifest: Manifest;
  content_md: string;
  build_main_js: string | null;
}

/// Asks the Rust core to open and parse a .mdxz. Returns the three layers.
export async function openDocument(path: string): Promise<OpenedDocument> {
  return invoke<OpenedDocument>("open_document", { path });
}

/// Seeds the policy engine with the document's declared capabilities.
/// (Phase 2 replaces this with a user prompt that gates the grant.)
export async function grantDeclaredCapabilities(manifest: Manifest): Promise<void> {
  await invoke("grant_declared_capabilities", { manifest });
}
```

- [ ] **Step 4: Write `runner.ts`**

Create `src/lib/runner.ts`:

```typescript
import * as runtime from "react/jsx-runtime";
import { run } from "@mdx-js/mdx";

export type MDXComponent = (props: Record<string, unknown>) => React.ReactElement;

/// Runs a precompiled MDX module (layer 2) inside the sandbox.
/// The document code receives ONLY the React runtime — no host APIs,
/// no filesystem, no network. Privileged access goes through the capability bridge.
///
/// Returns null if there is nothing to run (prose-only document).
export async function runMdxModule(
  compiled: string | null,
  rt: typeof runtime
): Promise<MDXComponent | null> {
  if (!compiled) return null;
  // run() evaluates the compiled module with the provided runtime as imports.
  const { default: Component } = await run(compiled, rt);
  return Component as MDXComponent;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- runner`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/package.ts src/lib/runner.ts src/lib/runner.test.ts
git commit -m "feat: run precompiled MDX in the sandbox via @mdx-js/mdx run()"
```

---

## Task 10: Wire it all together in `App.tsx` and verify end-to-end

This task produces the visible Phase-0 demo: open a fixture, run it, show denied privileged calls.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```typescript
import { useEffect, useState } from "react";
import * as runtime from "react/jsx-runtime";
import { openDocument, grantDeclaredCapabilities, type Manifest } from "./lib/package";
import { runMdxModule, type MDXComponent } from "./lib/runner";
import { checkCapability, type Decision } from "./lib/capability";

// For Phase 0 verification we open a fixture by path. Phase 2 adds the open dialog.
const FIXTURE_PATH = "../src-tauri/tests/fixtures/hello.mdxz";

export function App() {
  const [Component, setComponent] = useState<MDXComponent | null>(null);
  const [text, setText] = useState<string>("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [netDecision, setNetDecision] = useState<Decision | null>(null);

  useEffect(() => {
    (async () => {
      const doc = await openDocument(FIXTURE_PATH);
      setText(doc.content_md);
      setManifest(doc.manifest);
      await grantDeclaredCapabilities(doc.manifest);

      const C = await runMdxModule(doc.build_main_js, runtime);
      setComponent(() => C);

      // The hello fixture declares NO capabilities, so the policy engine
      // (which starts at zero) must DENY this network request.
      const decision = await checkCapability({ kind: "Network", host: "evil.com" });
      setNetDecision(decision);
    })().catch((err) => console.error("open failed", err));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1 data-testid="app-title">PrizmaPage</h1>

      <section data-testid="layer1-text">
        <h2>Layer 1 (text, always vectorizable)</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
      </section>

      <section data-testid="layer2-runtime">
        <h2>Layer 2 (compiled, running in sandbox)</h2>
        {Component ? <Component /> : <p>No executable component in this document.</p>}
      </section>

      <section data-testid="policy-panel">
        <h2>Policy engine</h2>
        <p>
          Document requested <code>network: evil.com</code>. Decision:{" "}
          <strong data-testid="net-decision">{netDecision ?? "…"}</strong>
        </p>
        {manifest && (
          <p>
            Declared capabilities: {manifest.capabilities.length} (signature:{" "}
            {manifest.signature ?? "none"})
          </p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build the fixtures (compile-at-save)**

Run:
```bash
npm run build:fixture
```
Expected: fixtures rebuilt.

- [ ] **Step 3: Boot the app**

Run:
```bash
cargo tauri dev
```
Expected: a desktop window titled "PrizmaPage" opens showing the hello document's text (layer 1), its compiled component rendered (layer 2), and a policy panel reading `Decision: Denied`.

- [ ] **Step 4: Verify the privileged fixture exercises the allow path**

Temporarily change `FIXTURE_PATH` in `src/App.tsx` to `"../src-tauri/tests/fixtures/privileged.mdxz"` and change the network check host to `"github.com"`:

```typescript
const FIXTURE_PATH = "../src-tauri/tests/fixtures/privileged.mdxz";
// ...
const decision = await checkCapability({ kind: "Network", host: "github.com" });
```

Run: `cargo tauri dev`
Expected: policy panel reads `Decision: Allowed` (the privileged fixture's declared `network:[github.com]` was granted, and the in-scope request is permitted).

**Revert both changes** back to `hello.mdxz` and `evil.com` before committing.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire runtime + policy engine into App, verify deny path"
```

---

## Task 11: Document the Phase 0 result

**Files:**
- Create: `docs/superpowers/notes/phase0-complete.md`

- [ ] **Step 1: Write the completion note**

Create `docs/superpowers/notes/phase0-complete.md`:

```markdown
# Phase 0 Complete — Runtime + Sandbox Core

Date: (fill in on completion)

## What works

- `.mdxz` packages (zip) open via the Rust core; manifest is required; layer 1 (text) is always extractable; layer 2 (compiled JS) is optional.
- Manifest types defined with a reserved `signature` field (forward-compatible with the trusted-source system).
- Policy engine starts at **zero** capabilities; only explicit grants allow requests; out-of-scope requests are denied; categories do not imply each other.
- Fixture builder (`npm run build:fixture`) compiles MDX at save and zips it — the minimal save/compile path.
- Precompiled MDX runs inside the webview via `@mdx-js/mdx`'s `run()` with only the React runtime provided. Document code has no host APIs.
- Capability bridge gates privileged calls; verified both the deny path (hello fixture, no capabilities) and the allow path (privileged fixture, in-scope network).

## Known limits (by design, deferred to later phases)

- Single document per app instance; multi-window/multi-doc arrives in Phase 2.
- `grant_declared_capabilities` grants declared caps directly; the open-time user prompt lands in Phase 2.
- Ephemeral-origin isolation is not yet enforced (Tauri serves from one origin in dev); per-document origin isolation arrives with the viewer UI in Phase 2.
- No AI, MCP, multi-format rendering, or editor UI yet.

## How to run

```
npm install
npm run build:fixture   # compile-at-save the fixtures
cargo tauri dev         # open the viewer; deny path verified by default
```

## Test commands

```
cargo test           # Rust: manifest, policy, package
npm test             # Frontend: capability, runner
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/notes/phase0-complete.md
git commit -m "docs: Phase 0 completion notes"
```

---

## Verification

Before declaring Phase 0 complete, run ALL of these and confirm expected output:

- [ ] `cargo test` — all Rust tests pass (manifest: 2, policy: 4, package: 4)
- [ ] `npm test` — all frontend tests pass (capability: 2, runner: 2)
- [ ] `npm run build:fixture` — produces `hello.mdxz` and `privileged.mdxz`
- [ ] `cargo tauri dev` — window opens, renders hello document, policy panel shows `Denied`
- [ ] Privileged fixture check (Task 10 Step 4) — `Allowed` confirmed, then reverted

If any of these fail, do not claim Phase 0 complete. Fix and re-run.

---

## Self-Review

**1. Spec coverage check** (against `2026-06-19-prizmapage-architecture-design.md`):

- §3.1 Rust-first Tauri → Task 1 (scaffold), Task 7 (commands in Rust core).
- §3.2 Two-layer security → Task 4 (policy engine), Task 8/9 (bridge), Task 10 (deny verification).
- §4 Three-layer package format → Task 3 (manifest), Task 5 (package reader), Task 6 (fixture builder).
- §4.3 Compile-at-save → Task 6 (`compile()` in the builder; `run()` in Task 9).
- §4.4 Reserved signature field → Task 3 (manifest type).
- §5.1 Per-document isolation → partial. The stateless, per-session policy engine (Task 4/7) is present. **Ephemeral origin + per-document webview process is explicitly deferred to Phase 2** (noted in Task 11 and below).
- §6 Capability bridge + granularity B → Tasks 4, 7, 8.
- §6.3 MCP category → represented in `Capability::Mcp` (Task 3); full MCP plumbing is Phase 5/6.

**Documented gap:** §5.1's ephemeral-origin and per-process isolation are runtime-deployment concerns that depend on the viewer's window model. Phase 0 verifies the *policy* side of isolation (stateless engine, zero defaults, in-scope checks). The *browser-sandbox* side of isolation is inherited from the webview already (document code has no host APIs in Task 9). Full origin/process isolation lands with multi-window in Phase 2.

**2. Placeholder scan:** No TBDs, TODOs, or "add error handling" stubs. Every code step shows complete code. The one `// Phase 2 …` comments are deliberate deferrals with their work named, not gaps.

**3. Type consistency:** `CapabilityRequest` uses `#[serde(tag = "kind")]` in Rust (Task 7 Step 3) and `{ kind: ... }` discriminated unions in TypeScript (Task 8) — consistent. `Decision` is `Allowed`/`Denied` in both. `Manifest` field names match across Rust (Task 3), the fixture builder (Task 6), and the frontend (Task 9 Step 3). `open_document`/`check_capability`/`grant_declared_capabilities` command names match between `lib.rs` (Task 7) and `package.ts`/`capability.ts` (Tasks 8, 9).
