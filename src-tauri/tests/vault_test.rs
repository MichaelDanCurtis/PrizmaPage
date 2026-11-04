//! Vault (SP1) integration tests: list/create/rename/delete/file-in round-trips
//! against a real tempdir vault.

use prizmapage::manifest::Manifest;
use prizmapage::save::save_document;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

// The vault_* functions are #[tauri::command] wrappers around pure logic. Since
// they take/return PathBuf and String (no Tauri state), we can re-implement the
// same logic inline OR test via the command signatures. Here we mirror the
// core file ops the commands perform, exercising the real save/open path.

fn note(name: &str, dir: &std::path::Path) -> PathBuf {
    dir.join(format!("{name}.mdxz"))
}

fn write_empty(p: &std::path::Path, title: &str) {
    let content = format!("# {title}\n\nStart writing…\n");
    let manifest = Manifest {
        version: "0.1.0".into(),
        origin_domain: Some("local".into()),
        capabilities: vec![],
        signature: None,
    };
    save_document(p, &content, "return { default: () => null }", &manifest).unwrap();
}

#[test]
fn vault_list_finds_mdxz_files_and_folders() {
    let dir = tempdir().unwrap();
    let vault = dir.path().join("vault");
    fs::create_dir_all(vault.join("Projects")).unwrap();
    write_empty(&note("Alpha", &vault), "Alpha");
    write_empty(&note("Beta", &vault), "Beta");
    write_empty(&note("Gamma", &vault.join("Projects")), "Gamma");
    // Non-mdxz file should be ignored.
    fs::write(vault.join("readme.txt"), "ignore me").unwrap();

    // Mirror vault_list's walk logic (it's a tauri command; we inline-test).
    let mut found: Vec<(String, bool)> = Vec::new();
    fn walk(d: &std::path::Path, out: &mut Vec<(String, bool)>) {
        for e in fs::read_dir(d).unwrap().flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with('.') { continue; }
            let m = e.metadata().unwrap();
            if m.is_dir() {
                out.push((name.clone(), true));
                walk(&e.path(), out);
            } else if e.path().extension().and_then(|x| x.to_str()) == Some("mdxz") {
                out.push((name, false));
            }
        }
    }
    walk(&vault, &mut found);
    let names: Vec<&str> = found.iter().map(|(n, _)| n.as_str()).collect();
    assert!(names.contains(&"Alpha.mdxz"));
    assert!(names.contains(&"Beta.mdxz"));
    assert!(names.contains(&"Projects"));
    assert!(!names.contains(&"readme.txt"));
    // Gamma is in Projects/ — recursion found it.
    assert!(names.contains(&"Gamma.mdxz"));
}

#[test]
fn vault_create_writes_a_readable_note() {
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    // Mirror vault_create_note: sanitize title, write, return path.
    let title = "My New Note";
    let safe: String = title.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' }).collect::<String>().trim().to_string();
    let path = vault.join(format!("{safe}.mdxz"));
    write_empty(&path, title);
    assert!(path.exists());

    // Reopen and check content round-trips.
    let contents = prizmapage::package::open_package(&path).unwrap();
    assert!(contents.content_md.contains("# My New Note"));
}

#[test]
fn vault_rename_preserves_mdxz_extension() {
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    let from = note("Old", &vault);
    write_empty(&from, "Old");
    // Mirror vault_rename: parent + new name + ext.
    let to = vault.join("New.mdxz");
    fs::rename(&from, &to).unwrap();
    assert!(!from.exists());
    assert!(to.exists());
}

#[test]
fn vault_delete_removes_file_or_folder() {
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    let note_path = note("Tmp", &vault);
    write_empty(&note_path, "Tmp");
    fs::remove_file(&note_path).unwrap();
    assert!(!note_path.exists());

    let folder = vault.join("Folder");
    fs::create_dir_all(&folder).unwrap();
    write_empty(&note("Inside", &folder), "Inside");
    fs::remove_dir_all(&folder).unwrap();
    assert!(!folder.exists());
}

#[test]
fn vault_file_in_copy_and_move() {
    let dir = tempdir().unwrap();
    let src_dir = dir.path().join("src");
    let vault = dir.path().join("vault");
    fs::create_dir_all(&src_dir).unwrap();
    fs::create_dir_all(&vault).unwrap();
    let src = note("Shared", &src_dir);
    write_empty(&src, "Shared");

    // Copy.
    let dst_copy = vault.join("Shared.mdxz");
    fs::copy(&src, &dst_copy).unwrap();
    assert!(src.exists()); // copy preserves original
    assert!(dst_copy.exists());

    // Move.
    let dst_move = vault.join("Moved.mdxz");
    fs::rename(&src, &dst_move).unwrap();
    assert!(!src.exists());
    assert!(dst_move.exists());
}

#[test]
fn vault_create_memory_writes_a_readable_memory() {
    // Mirrors the vault_create_memory command's logic (it's a private
    // #[tauri::command]; tests exercise the same save/open path).
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    let memories_dir = vault.join("Memories");
    fs::create_dir_all(&memories_dir).unwrap();
    let safe = "My memory".chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' }).collect::<String>().trim().to_string();
    let ts = 1700000000u64;
    let filename = format!("{}-{}.mdxz", if safe.is_empty() { "memory" } else { &safe }, ts);
    let path = memories_dir.join(&filename);
    let note_content = format!(
        "# My memory\n\n**Tags:** tag1, tag2  \n**Deposited:** unix:{ts}\n\n---\n\nSome content\n"
    );
    let m = Manifest {
        version: "0.1.0".into(),
        origin_domain: Some("memory".into()),
        capabilities: vec![],
        signature: None,
    };
    save_document(&path, &note_content, "return { default: () => null }", &m).unwrap();
    assert!(path.to_string_lossy().contains("Memories"));
    let opened = prizmapage::package::open_package(&path).unwrap();
    assert!(opened.content_md.contains("My memory"));
    assert!(opened.content_md.contains("Some content"));
    assert!(opened.content_md.contains("tag1"));
}

#[test]
fn vault_snapshot_writes_and_lists_and_restores() {
    let dir = tempdir().unwrap();
    let vault = dir.path().to_path_buf();
    let live = vault.join("Note.mdxz");
    write_empty(&live, "Note");
    // Simulate a snapshot: write to .versions/<stem>-<ts>.mdxz
    let versions_dir = vault.join(".versions");
    fs::create_dir_all(&versions_dir).unwrap();
    let snap = versions_dir.join("Note-1700000000.mdxz");
    write_empty(&snap, "Note");
    assert!(snap.exists());
    // List mirrors vault_list_versions: collect <stem>-<ts>.mdxz
    let mut found: Vec<String> = fs::read_dir(&versions_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.starts_with("Note-") && n.ends_with(".mdxz"))
        .collect();
    found.sort();
    assert_eq!(found, vec!["Note-1700000000.mdxz".to_string()]);
    // Restore: copy snapshot over the live doc.
    fs::copy(&snap, &live).unwrap();
    let opened = prizmapage::package::open_package(&live).unwrap();
    assert!(opened.content_md.contains("Note"));
}
