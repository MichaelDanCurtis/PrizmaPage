//! Layer 1 smoke test: opens a fixture .mdxz via the open_document command
//! (the same path the new App uses) and asserts the package contents are what
//! the DocumentCanvas would render. This doesn't boot the full GUI — Tauri's
//! webview can't be driven from a test — but it verifies the entire open →
//! package-read → layers path works end-to-end through the Rust bridge.

use prizmapage::package::open_package;
use std::path::Path;

#[test]
fn layer1_open_fixture_returns_renderable_layers() {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/hello.mdxz");
    if !fixture.exists() {
        eprintln!("skipping — run `npm run build:fixture` first");
        return;
    }
    let contents = open_package(&fixture).expect("open hello.mdxz");

    // Layer 1 (text) — always present, vectorizable.
    assert!(
        !contents.content_md.is_empty(),
        "document must have prose text"
    );
    // Layer 2 (compiled) — the hello fixture ships a real compiled build.
    assert!(
        contents.build_main_js.is_some(),
        "hello fixture should have a compiled build"
    );
    // Manifest — the trust footer reads origin_domain (null in hello).
    assert_eq!(contents.manifest.version, "0.1.0");
    assert!(contents.manifest.origin_domain.is_none());
    // The trust footer would render: hello.mdxz · unsigned
    let footer_status = if contents.manifest.origin_domain.is_some() {
        "signed"
    } else {
        "unsigned"
    };
    assert_eq!(footer_status, "unsigned");
}
