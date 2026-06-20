use prizmapage::recents::{add_recent, load_recents, RecentEntry};
use std::path::PathBuf;
use tempfile::tempdir;

fn empty_store(dir: &std::path::Path) -> std::path::PathBuf {
    dir.join("recents.json")
}

#[test]
fn load_returns_empty_when_no_file() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    let recents = load_recents(&path).unwrap();
    assert!(recents.is_empty());
}

#[test]
fn add_then_load_returns_the_entry() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/q4.mdxz"),
            name: "q4".into(),
            opened_at: 1000,
        },
    )
    .unwrap();
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 1);
    assert_eq!(recents[0].name, "q4");
}

#[test]
fn add_dedupes_by_path_and_prepends() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/a.mdxz"),
            name: "a".into(),
            opened_at: 1000,
        },
    )
    .unwrap();
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/b.mdxz"),
            name: "b".into(),
            opened_at: 2000,
        },
    )
    .unwrap();
    // Re-add a — it should move to front, not duplicate.
    add_recent(
        &path,
        RecentEntry {
            path: PathBuf::from("/tmp/a.mdxz"),
            name: "a".into(),
            opened_at: 3000,
        },
    )
    .unwrap();
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 2);
    assert_eq!(recents[0].name, "a"); // prepended
    assert_eq!(recents[1].name, "b");
}

#[test]
fn add_truncates_to_five_entries() {
    let dir = tempdir().unwrap();
    let path = empty_store(dir.path());
    for i in 0..7 {
        add_recent(
            &path,
            RecentEntry {
                path: PathBuf::from(format!("/tmp/{i}.mdxz")),
                name: format!("doc{i}"),
                opened_at: 1000 + i as u64,
            },
        )
        .unwrap();
    }
    let recents = load_recents(&path).unwrap();
    assert_eq!(recents.len(), 5);
    // Most recent (last added) is first.
    assert_eq!(recents[0].name, "doc6");
}
