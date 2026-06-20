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
    pub content_md: String, // Layer 1: always present, always plaintext.
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
