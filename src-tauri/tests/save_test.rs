//! Round-trip: save_document writes a .mdxz, open_document reads it back,
//! and the three layers match what was written. This is the end-to-end
//! save-pipeline test for Layer 2a.

use prizmapage::manifest::Manifest;
use prizmapage::save::save_document;
use prizmapage::package::open_package;
use tempfile::tempdir;

#[test]
fn save_then_open_round_trips_all_three_layers() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("round.mdxz");

    let content_md = "# Hello\n\nThis is **saved** prose.\n";
    let compiled_js = "/* compiled function-body */";
    let manifest = Manifest {
        version: "0.1.0".into(),
        origin_domain: None,
        capabilities: vec![],
        signature: None,
    };

    save_document(&path, content_md, compiled_js, &manifest).unwrap();

    let contents = open_package(&path).unwrap();
    assert_eq!(contents.content_md, content_md);
    assert_eq!(contents.build_main_js.as_deref(), Some(compiled_js));
    assert_eq!(contents.manifest.version, "0.1.0");
    assert!(contents.manifest.origin_domain.is_none());
}
