//! Integration test for the Layer 1 bridge commands. The open_file_dialog and
//! share_document_path commands are thin wrappers around Tauri plugins (hard to
//! unit-test without a running app), so we test the recents commands end-to-end
//! against a temp file, which is where the real logic lives.

use prizmapage::recents::{add_recent, load_recent, RecentEntry};
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn recents_round_trip_via_storage_module() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("recents.json");

    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/abs/q4.mdxz"),
            name: "q4".into(),
            opened_at: 1781983000,
        },
    )
    .unwrap();

    let loaded = load_recent(&path).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].name, "q4");
    assert_eq!(loaded[0].path, PathBuf::from("/abs/q4.mdxz"));
}
