use prizmapage::package::{open_package, PackageContents};
use std::io::Write;
use zip::write::ZipWriter;

fn build_fixture_zip(path: &std::path::Path) {
    let file = std::fs::File::create(path).unwrap();
    let mut zip = ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();

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

    let PackageContents {
        manifest,
        content_md,
        build_main_js,
    } = open_package(tmp.path()).unwrap();

    assert_eq!(manifest.version, "0.1.0");
    assert_eq!(content_md, "# Hello");
    assert_eq!(build_main_js.as_deref(), Some("/* compiled */"));
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
    zip.write_all(br#"{"version":"0.1.0","capabilities":[],"signature":null}"#)
        .unwrap();
    zip.start_file("content.md", opts).unwrap();
    zip.write_all(b"# Prose only").unwrap();
    zip.finish().unwrap();

    let PackageContents {
        content_md,
        build_main_js,
        ..
    } = open_package(tmp.path()).unwrap();
    assert_eq!(content_md, "# Prose only");
    assert!(
        build_main_js.is_none(),
        "build/main.js absent is fine for prose-only docs"
    );
}

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
