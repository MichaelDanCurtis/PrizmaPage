//! Save a .mdxz package: zip { manifest.json, content.md, build/main.js }
//! from the three layers passed in. Mirrors the inverse of package::open_package.

use crate::manifest::Manifest;
use std::io::Write;
use std::path::Path;
use thiserror::Error;
use zip::write::ZipWriter;
use zip::ZipArchive;

#[derive(Debug, Error)]
pub enum SaveError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub fn save_document(
    path: &Path,
    content_md: &str,
    compiled_js: &str,
    manifest: &Manifest,
) -> Result<(), SaveError> {
    // Ensure parent dir exists.
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let file = std::fs::File::create(path)?;
    let mut zip = ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default();

    // manifest.json (layer 3)
    zip.start_file("manifest.json", options)?;
    let manifest_json = serde_json::to_string_pretty(manifest)?;
    zip.write_all(manifest_json.as_bytes())?;

    // content.md (layer 1, always plaintext)
    zip.start_file("content.md", options)?;
    zip.write_all(content_md.as_bytes())?;

    // build/main.js (layer 2, compiled)
    zip.start_file("build/main.js", options)?;
    zip.write_all(compiled_js.as_bytes())?;

    zip.finish()?;

    // Sanity: confirm the zip is readable.
    let file = std::fs::File::open(path)?;
    let _archive = ZipArchive::new(file)?;
    Ok(())
}
