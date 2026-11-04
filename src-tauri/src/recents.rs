//! Recent-documents persistence: a JSON file in the OS app-data dir holding
//! the last 5 opened .mdxz paths, newest first, deduplicated by path.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecentEntry {
    pub path: PathBuf,
    pub name: String,
    pub opened_at: u64,
}

#[derive(Debug, Error)]
pub enum RecentsError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("parse error: {0}")]
    Parse(#[from] serde_json::Error),
}

#[derive(Serialize, Deserialize, Default)]
struct RecentsFile {
    recents: Vec<RecentEntry>,
}

const MAX_ENTRIES: usize = 5;

pub fn load_recents(path: &Path) -> Result<Vec<RecentEntry>, RecentsError> {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            let file: RecentsFile = serde_json::from_str(&contents)?;
            Ok(file.recents)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(RecentsError::Io(e)),
    }
}

pub fn add_recent(path: &Path, entry: RecentEntry) -> Result<(), RecentsError> {
    let mut current = load_recents(path)?;
    // Dedupe by path: remove any existing entry with the same path.
    current.retain(|e| e.path != entry.path);
    // Prepend the new entry.
    current.insert(0, entry);
    // Truncate to MAX_ENTRIES.
    current.truncate(MAX_ENTRIES);
    let file = RecentsFile { recents: current };
    let json = serde_json::to_string_pretty(&file)?;
    // Ensure parent dir exists.
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, json)?;
    Ok(())
}

/// Alias so bridge-command callers can use a singular name.
pub fn load_recent(path: &std::path::Path) -> Result<Vec<RecentEntry>, RecentsError> {
    load_recents(path)
}
