pub mod acp;
pub mod acp_provider;
pub mod capability;
pub mod manifest;
pub mod mcp_server;
pub mod oauth;
pub mod oauth_providers;
pub mod package;
pub mod pkce;
pub mod policy;
pub mod provider;
pub mod recents;
pub mod save;
pub mod signing;
pub mod registry;
pub mod secret;
pub mod state;

use crate::capability::{CapabilityRequest, Decision};
use crate::package::{open_package, PackageContents};
use crate::provider::{CompletionRequest, CompletionResponse};
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
fn check_capability(state: State<AppState>, request: CapabilityRequest) -> Result<Decision, String> {
    let policy = state.policy.lock().map_err(|e| e.to_string())?;
    Ok(policy.check(&request))
}

// ===== AI provider commands =====

#[tauri::command]
fn ai_list_providers(state: State<AppState>) -> Vec<String> {
    state.providers.list()
}

#[tauri::command]
async fn ai_set_api_key(
    state: State<'_, AppState>,
    provider: String,
    api_key: String,
) -> Result<(), String> {
    state
        .secrets
        .set(&provider, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_clear_api_key(state: State<'_, AppState>, provider: String) -> Result<(), String> {
    state
        .secrets
        .delete(&provider)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_has_api_key(state: State<'_, AppState>, provider: String) -> Result<bool, String> {
    let got = state.secrets.get(&provider).await.map_err(|e| e.to_string())?;
    Ok(got.is_some())
}

/// List the models a provider offers. Fetches LIVE from the provider's models
/// endpoint using the stored credential — no hardcoded list. Returns an empty
/// vec if the provider can't enumerate (e.g. ACP, ollama without /models).
#[tauri::command]
async fn ai_list_models(
    state: State<'_, AppState>,
    provider: String,
) -> Result<Vec<String>, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;
    p.list_models(state.secrets.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ai_complete(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    messages: Vec<(String, String)>,
) -> Result<CompletionResponse, String> {
    // Capability gate: the open document must have declared this provider in
    // its `ai` capability. Phase 0 stubs the grant; Phase 2 ties this to the
    // open-time prompt.
    {
        let policy = state.policy.lock().map_err(|e| e.to_string())?;
        let decision = policy.check(&CapabilityRequest::Ai {
            provider: provider.clone(),
        });
        if decision == Decision::Denied {
            return Err(format!(
                "denied: document has not declared ai capability for provider '{provider}'"
            ));
        }
    }

    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;

    p.complete(
        state.secrets.as_ref(),
        &CompletionRequest { model, messages },
    )
    .await
    .map_err(|e| e.to_string())
}

/// Author-time component generation. Distinct from `ai_complete` (which is a
/// runtime capability gated by the document's manifest): this is an editor
/// affordance used while authoring, so it is NOT gated by the policy engine.
/// Per the architecture decision, AI generation is author-time only — the
/// generated component is just JSX inserted into the doc, never executed at
/// recipient-open-time.
#[tauri::command]
async fn ai_author_component(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;

    let system = "You generate a single React component as JSX for an MDX document. \
Reply with ONLY the component tag — no markdown fences, no explanation, no imports. \
The tag must be self-closing (<Name ... />) or open/close (<Name ...>text</Name>). \
Use only these built-in components: Callout, StatCard, CodeBlock, Divider, Table, \
Chart, Badge, FeatureCard, StatGroup, Tabs, Quote. Example for 'a warning box': \
<Callout type=\"warning\">Heads up!</Callout>";
    let messages = vec![
        ("system".to_string(), system.to_string()),
        ("user".to_string(), prompt),
    ];
    let resp = p
        .complete(
            state.secrets.as_ref(),
            &CompletionRequest {
                model,
                messages,
            },
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.text)
}

/// Author-time whole-document generation. Like ai_author_component but the
/// system prompt requests a full multi-block MDX document body (or, when
/// `selection` is Some, edits the given selection). NOT policy-gated
/// (author-time affordance). Returns the MDX source.
#[tauri::command]
async fn ai_generate_document(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    prompt: String,
    selection: Option<String>,
) -> Result<String, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;

    let system = if selection.is_some() {
        "You edit a short selection of an MDX document. Return ONLY the replacement \
MDX for that selection — no fences, no explanation. Preserve the meaning but apply \
the user's instruction. Use only built-in components: Callout, StatCard, CodeBlock, \
Divider, Table, Chart, Badge, FeatureCard, StatGroup, Tabs, Quote, Diagram."
    } else {
        "You generate a complete MDX document. Return ONLY the MDX source — no fences, \
no explanation. Use headings, paragraphs, lists, and built-in components where helpful: \
Callout, StatCard, CodeBlock, Divider, Table, Chart, Badge, FeatureCard, StatGroup, Tabs, \
Quote, Diagram. Start with a top-level # heading."
    };
    let user_msg = match &selection {
        Some(sel) => format!("Selection:\n{}\n\nInstruction: {}", sel, prompt),
        None => prompt,
    };
    let messages = vec![
        ("system".to_string(), system.to_string()),
        ("user".to_string(), user_msg),
    ];
    let resp = p
        .complete(
            state.secrets.as_ref(),
            &CompletionRequest { model, messages },
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.text)
}

/// Step 1 of OAuth device flow: request a device code for the named provider.
/// Only `copilot` supports device flow (GitHub). Codex uses PKCE — see
/// ai_start_codex_pkce.
#[tauri::command]
async fn ai_start_oauth(
    state: State<'_, AppState>,
    provider: String,
) -> Result<crate::oauth::UserAuthInstructions, String> {
    let config = match provider.as_str() {
        "copilot" => crate::oauth_providers::copilot_config(),
        other => return Err(format!(
            "provider '{other}' does not support device flow (codex uses PKCE — call ai_start_codex_pkce)"
        )),
    };
    let client = crate::oauth::DeviceFlowClient::new(config);
    let (device_code, instructions) = client.request_device_code().await.map_err(|e| e.to_string())?;
    state
        .pending_oauth
        .lock()
        .map_err(|e| e.to_string())?
        .insert(provider, device_code);
    Ok(instructions)
}

/// Step 2 of OAuth device flow: poll once for the token. Returns
/// "pending" | "complete" | an error. On complete, stores the token.
#[tauri::command]
async fn ai_poll_oauth(state: State<'_, AppState>, provider: String) -> Result<String, String> {
    let device_code = state
        .pending_oauth
        .lock()
        .map_err(|e| e.to_string())?
        .get(&provider)
        .map(|dc| dc.device_code.clone())
        .ok_or_else(|| format!("no pending OAuth flow for '{provider}'"))?;

    let config = match provider.as_str() {
        "copilot" => crate::oauth_providers::copilot_config(),
        other => return Err(format!(
            "provider '{other}' does not support device flow polling"
        )),
    };
    let client = crate::oauth::DeviceFlowClient::new(config);

    match client.poll_once(&device_code).await {
        Ok(Some(token)) => {
            state.secrets.set(&provider, &token).await.map_err(|e| e.to_string())?;
            state.pending_oauth.lock().map_err(|e| e.to_string())?.remove(&provider);
            Ok("complete".into())
        }
        Ok(None) => Ok("pending".into()),
        Err(crate::oauth::OAuthError::Denied) => Err("denied by user".into()),
        Err(crate::oauth::OAuthError::Expired) => Err("device code expired".into()),
        Err(e) => Err(e.to_string()),
    }
}

/// Codex PKCE: returns the authorization URL the UI should open in a browser.
/// The UI then calls ai_await_codex_callback to block on the redirect.
#[tauri::command]
async fn ai_start_codex_pkce(
    state: State<'_, AppState>,
) -> Result<crate::pkce::AuthorizationRequest, String> {
    let config = crate::oauth_providers::codex_pkce_config();
    let pair = crate::pkce::PkcePair::generate();
    let client = crate::pkce::PkceClient::new(config);
    let auth_req = client.build_authorization_url(&pair);
    state
        .pending_pkce
        .lock()
        .map_err(|e| e.to_string())?
        .insert("codex".to_string(), (pair, auth_req.state.clone()));
    Ok(auth_req)
}

/// Codex PKCE: block on the localhost callback + exchange the code for a token.
/// Stores the token on success.
#[tauri::command]
async fn ai_await_codex_callback(state: State<'_, AppState>) -> Result<(), String> {
    let (pair, expected_state) = {
        let g = state.pending_pkce.lock().map_err(|e| e.to_string())?;
        g.get("codex")
            .map(|(p, s)| (p.clone(), s.clone()))
            .ok_or_else(|| "no pending Codex PKCE flow".to_string())?
    };
    let config = crate::oauth_providers::codex_pkce_config();
    let client = crate::pkce::PkceClient::new(config);
    client
        .await_callback_and_exchange(&pair, &expected_state, 300, state.secrets.as_ref())
        .await
        .map_err(|e| e.to_string())?;
    state.pending_pkce.lock().map_err(|e| e.to_string())?.remove("codex");
    Ok(())
}

/// Configure the ACP agent binary (default: `claude --acp`). Lets the user
/// point at a custom Claude Code install path or another ACP-compliant agent.
#[tauri::command]
fn ai_set_acp_binary(state: State<AppState>, binary: String, args: Vec<String>) -> Result<(), String> {
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    state.acp_provider.set_binary(&binary, &arg_refs);
    Ok(())
}

/// Open a URL in the system default browser. Used by OAuth flows (Copilot
/// verification URL, Codex PKCE authorize URL). The opener plugin scopes this
/// to allow-listed URLs only — see src-tauri/capabilities/default.json.
#[tauri::command]
async fn open_in_browser(url: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Native file picker for .mdxz. Returns None if the user cancels.
#[tauri::command]
async fn open_file_dialog(
    app: tauri::AppHandle,
) -> Result<Option<std::path::PathBuf>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter("PrizmaPage document", &["mdxz"])
        .blocking_pick_file();
    Ok(file_path.map(|p| p.into_path().unwrap_or_default()))
}

/// Returns the last 5 opened documents, newest first.
#[tauri::command]
fn recent_documents(app: tauri::AppHandle) -> Result<Vec<recents::RecentEntry>, String> {
    let path = recents_path(&app).ok_or_else(|| "no app data dir".to_string())?;
    recents::load_recents(&path).map_err(|e| e.to_string())
}

/// Called after a successful open. Dedupes, prepends, truncates to 5.
#[tauri::command]
fn add_recent_document(app: tauri::AppHandle, path: std::path::PathBuf) -> Result<(), String> {
    let store_path = recents_path(&app).ok_or_else(|| "no app data dir".to_string())?;
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document")
        .to_string();
    let opened_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    recents::add_recent(
        &store_path,
        recents::RecentEntry {
            path,
            name,
            opened_at,
        },
    )
    .map_err(|e| e.to_string())
}

/// Layer 1 share stub: copies the current doc's absolute path to the clipboard.
#[tauri::command]
async fn share_document_path(
    app: tauri::AppHandle,
    path: std::path::PathBuf,
) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Reveal the document in the system file manager (Finder on macOS). This is
/// the universal "share" entry: from Finder the user can AirDrop, Message,
/// Mail, drag into another app, etc.
#[tauri::command]
async fn reveal_document(path: std::path::PathBuf) -> Result<(), String> {
    // opener::reveal highlights the file inside its containing folder.
    opener::reveal(&path).map_err(|e| e.to_string())
}

/// Copy a document to a chosen destination path (used by "Save a copy…").
#[tauri::command]
fn copy_document(src: std::path::PathBuf, dst: std::path::PathBuf) -> Result<(), String> {
    std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
    Ok(())
}

// ===== Vault (SP1) =====

#[derive(serde::Serialize)]
struct VaultEntry {
    name: String,
    path: String,
    is_folder: bool,
    modified: u64, // unix seconds
}

#[derive(serde::Serialize)]
struct VersionEntry {
    path: String,
    ts: u64, // unix seconds
    label: String,
}

/// Recursively list `.mdxz` files and folders under a vault root. Folders
/// always included; files only if they end in `.mdxz`. `modified` is the
/// entry's mtime in unix seconds (0 if unavailable).
#[tauri::command]
fn vault_list(vault_path: std::path::PathBuf) -> Result<Vec<VaultEntry>, String> {
    fn walk(dir: &std::path::Path, out: &mut Vec<VaultEntry>) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden files/folders.
            if name.starts_with('.') {
                continue;
            }
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            if meta.is_dir() {
                out.push(VaultEntry {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    is_folder: true,
                    modified,
                });
                walk(&path, out)?;
            } else if path.extension().and_then(|e| e.to_str()) == Some("mdxz") {
                out.push(VaultEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_folder: false,
                    modified,
                });
            }
        }
        Ok(())
    }
    let mut entries = Vec::new();
    walk(&vault_path, &mut entries)?;
    // Sort: folders first, then by name.
    entries.sort_by(|a, b| b.is_folder.cmp(&a.is_folder).then(a.name.cmp(&b.name)));
    Ok(entries)
}

/// Create a new empty note in the vault. Reuses the minimal-document logic
/// from `new_document`. Returns the path of the created note.
#[tauri::command]
fn vault_create_note(vault_path: std::path::PathBuf, title: String) -> Result<std::path::PathBuf, String> {
    let safe_title: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' })
        .collect::<String>()
        .trim()
        .to_string();
    let filename = if safe_title.is_empty() {
        "Untitled.mdxz".to_string()
    } else {
        format!("{safe_title}.mdxz")
    };
    let path = vault_path.join(filename);
    let content_md = format!("# {title}\n\nStart writing…\n");
    let compiled_js = "return { default: () => null }";
    let manifest = crate::manifest::Manifest {
        version: "0.1.0".to_string(),
        origin_domain: Some("local".to_string()),
        capabilities: Vec::new(),
        signature: None,
    };
    crate::save::save_document(&path, &content_md, compiled_js, &manifest)
        .map_err(|e| e.to_string())?;
    Ok(path)
}

/// Deposit a memory note in <vault>/Memories/. Mirrors the mcp_server
/// `vault.remember` logic so users (not only agents) can save memories. SP8.
#[tauri::command]
fn vault_create_memory(
    vault_path: std::path::PathBuf,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<std::path::PathBuf, String> {
    let memories_dir = vault_path.join("Memories");
    std::fs::create_dir_all(&memories_dir).map_err(|e| e.to_string())?;
    let safe: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { ' ' })
        .collect::<String>()
        .trim()
        .to_string();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let filename = format!(
        "{}-{}.mdxz",
        if safe.is_empty() { "memory" } else { &safe },
        timestamp
    );
    let path = memories_dir.join(&filename);
    let note_content = format!(
        "# {title}\n\n**Tags:** {}  \n**Deposited:** unix:{timestamp}\n\n---\n\n{content}\n",
        tags.join(", ")
    );
    let manifest = crate::manifest::Manifest {
        version: "0.1.0".to_string(),
        origin_domain: Some("memory".to_string()),
        capabilities: Vec::new(),
        signature: None,
    };
    crate::save::save_document(&path, &note_content, "return { default: () => null }", &manifest)
        .map_err(|e| e.to_string())?;
    Ok(path)
}

/// Write a timestamped snapshot of a document to <vault>/.versions/. Version
/// history (SP-ish): called by the frontend after each successful save.
#[tauri::command]
fn vault_snapshot(
    vault_path: std::path::PathBuf,
    doc_path: std::path::PathBuf,
    content_md: String,
    compiled_js: String,
) -> Result<std::path::PathBuf, String> {
    let versions_dir = vault_path.join(".versions");
    std::fs::create_dir_all(&versions_dir).map_err(|e| e.to_string())?;
    let stem = doc_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let filename = format!("{stem}-{timestamp}.mdxz");
    let path = versions_dir.join(&filename);
    let manifest = crate::manifest::Manifest {
        version: "0.1.0".to_string(),
        origin_domain: Some("snapshot".to_string()),
        capabilities: Vec::new(),
        signature: None,
    };
    crate::save::save_document(&path, &content_md, &compiled_js, &manifest)
        .map_err(|e| e.to_string())?;
    Ok(path)
}

/// List version snapshots for a document (newest first).
#[tauri::command]
fn vault_list_versions(
    vault_path: std::path::PathBuf,
    doc_path: std::path::PathBuf,
) -> Result<Vec<VersionEntry>, String> {
    let versions_dir = vault_path.join(".versions");
    if !versions_dir.is_dir() {
        return Ok(Vec::new());
    }
    let stem = doc_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("document");
    let prefix = format!("{stem}-");
    let mut entries: Vec<VersionEntry> = std::fs::read_dir(&versions_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if !name.starts_with(&prefix) || !name.ends_with(".mdxz") {
                return None;
            }
            // Parse the trailing timestamp.
            let ts = name
                .trim_start_matches(&prefix)
                .trim_end_matches(".mdxz")
                .parse::<u64>()
                .ok()?;
            Some(VersionEntry {
                path: e.path().to_string_lossy().to_string(),
                ts,
                label: name,
            })
        })
        .collect();
    entries.sort_by(|a, b| b.ts.cmp(&a.ts));
    Ok(entries)
}

/// Restore a version: copy the snapshot's content back to the live document
/// path. The frontend re-reads it.
#[tauri::command]
fn vault_restore_version(src: std::path::PathBuf, dst: std::path::PathBuf) -> Result<(), String> {
    std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
    Ok(())
}

/// Rename a vault entry (file or folder). For files, preserves the `.mdxz` ext.
#[tauri::command]
fn vault_rename(from: std::path::PathBuf, new_name: String) -> Result<std::path::PathBuf, String> {
    let parent = from.parent().ok_or("no parent")?;
    let was_mdxz = from.extension().and_then(|e| e.to_str()) == Some("mdxz");
    let ext = if was_mdxz { ".mdxz" } else { "" };
    let to = parent.join(format!("{new_name}{ext}"));
    std::fs::rename(&from, &to).map_err(|e| e.to_string())?;
    Ok(to)
}

/// Delete a vault entry. Folders recurse.
#[tauri::command]
fn vault_delete(path: std::path::PathBuf) -> Result<(), String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    } else {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// File a standalone .mdxz into the vault. `mode` is "copy" or "move".
/// Returns the new in-vault path.
#[tauri::command]
fn vault_file_in(
    src: std::path::PathBuf,
    vault_path: std::path::PathBuf,
    mode: String,
) -> Result<std::path::PathBuf, String> {
    let filename = src
        .file_name()
        .ok_or("no filename")?
        .to_string_lossy()
        .to_string();
    let dst = vault_path.join(&filename);
    match mode.as_str() {
        "copy" => {
            std::fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
        "move" => {
            std::fs::rename(&src, &dst).map_err(|e| e.to_string())?;
        }
        other => return Err(format!("unknown mode: {other}")),
    }
    Ok(dst)
}

#[derive(serde::Serialize)]
struct SearchResult {
    path: String,
    name: String,
    /// A short snippet of the match with surrounding context.
    snippet: String,
}

/// Full-text search across all .mdxz files in a vault. Reads each file's
/// content.md layer and matches the query (case-insensitive substring).
/// Returns up to 50 results with context snippets.
#[tauri::command]
fn vault_search(vault_path: std::path::PathBuf, query: String) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }
    let q = query.to_lowercase();
    let mut results = Vec::new();
    fn walk_search(
        dir: &std::path::Path,
        q: &str,
        results: &mut Vec<SearchResult>,
    ) -> Result<(), String> {
        for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
            if results.len() >= 50 {
                return Ok(());
            }
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            if meta.is_dir() {
                walk_search(&path, q, results)?;
            } else if path.extension().and_then(|e| e.to_str()) == Some("mdxz") {
                // Read content.md from the zip.
                let file = match std::fs::File::open(&path) {
                    Ok(f) => f,
                    Err(_) => continue,
                };
                let mut archive = match zip::ZipArchive::new(file) {
                    Ok(a) => a,
                    Err(_) => continue,
                };
                let mut content = String::new();
                if let Ok(mut c) = archive.by_name("content.md") {
                    use std::io::Read;
                    let _ = c.read_to_string(&mut content);
                }
                if let Some(idx) = content.to_lowercase().find(q) {
                    // Build a snippet around the match.
                    let start = idx.saturating_sub(40);
                    let end = (idx + q.len() + 60).min(content.len());
                    let prefix = if start > 0 { "…" } else { "" };
                    let suffix = if end < content.len() { "…" } else { "" };
                    let snippet = format!("{prefix}{}{suffix}", &content[start..end].replace('\n', " "));
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        name: name.replace(".mdxz", ""),
                        snippet,
                    });
                }
            }
        }
        Ok(())
    }
    walk_search(&vault_path, &q, &mut results)?;
    Ok(results)
}

/// Vault-wide AI chat: reads all .mdxz notes in the vault, includes them as
/// context, and answers the user's question about the vault as a whole. NOT
/// policy-gated (author-time affordance, like the other AI commands).
#[tauri::command]
async fn vault_chat(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    vault_path: std::path::PathBuf,
    question: String,
) -> Result<String, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;

    // Gather all note contents (capped to keep the prompt sane).
    let mut notes: Vec<(String, String)> = Vec::new();
    fn gather(dir: &std::path::Path, notes: &mut Vec<(String, String)>) {
        let Ok(rd) = std::fs::read_dir(dir) else { return };
        for entry in rd.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') { continue; }
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                gather(&path, notes);
            } else if path.extension().and_then(|e| e.to_str()) == Some("mdxz") {
                if notes.len() >= 30 { continue; } // cap
                if let Ok(file) = std::fs::File::open(&path) {
                    if let Ok(mut archive) = zip::ZipArchive::new(file) {
                        if let Ok(mut c) = archive.by_name("content.md") {
                            use std::io::Read;
                            let mut content = String::new();
                            let _ = c.read_to_string(&mut content);
                            // Cap each note's contribution.
                            let capped = if content.len() > 2000 { format!("{}…", &content[..2000]) } else { content };
                            notes.push((name.replace(".mdxz", ""), capped));
                        }
                    }
                }
            }
        }
    }
    gather(&vault_path, &mut notes);

    let corpus = notes
        .iter()
        .map(|(name, content)| format!("## {name}\n{content}"))
        .collect::<Vec<_>>()
        .join("\n\n---\n\n");

    let system = "You answer questions about the user's note vault. The notes are provided below. \
Answer based on what's in the notes; if the answer isn't there, say so. Be concise.";
    let user = format!("{corpus}\n\n---\n\nQuestion: {question}");
    let messages = vec![
        ("system".to_string(), system.to_string()),
        ("user".to_string(), user),
    ];
    let resp = p
        .complete(state.secrets.as_ref(), &CompletionRequest { model, messages })
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.text)
}

/// Resolve the recents.json path inside the OS app-data dir.
fn recents_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().ok()?;
    Some(dir.join("recents.json"))
}

/// Returns the absolute path to the bundled welcome.mdxz (a first-run intro
/// doc shipped as a Tauri resource). The frontend opens it via open_document
/// just like any user-picked file.
#[tauri::command]
fn welcome_document_path(app: tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    app.path()
        .resolve("resources/welcome.mdxz", tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())
}

/// Writes a three-layer .mdxz from frontend-supplied layers.
/// The frontend compiles MDX -> compiled_js (function-body) before calling.
#[tauri::command]
fn save_document(
    path: std::path::PathBuf,
    content_md: String,
    compiled_js: String,
    manifest: crate::manifest::Manifest,
) -> Result<(), String> {
    crate::save::save_document(&path, &content_md, &compiled_js, &manifest)
        .map_err(|e| e.to_string())
}

/// Create a brand-new empty `.mdxz` document at the given path and return the
/// path so the frontend can open it straight into the editor. Writes a minimal
/// three-layer package: a near-empty content.md, a compiled no-op build, and a
/// manifest with no capabilities (author grants them later if needed).
#[tauri::command]
fn new_document(path: std::path::PathBuf) -> Result<std::path::PathBuf, String> {
    // Empty prose: just a top-level heading the author can overwrite.
    let content_md = "# Untitled\n\nStart writing…\n";
    // A compiled no-op MDX module body (function-body output format). Renders
    // the heading + paragraph above with no executable component code.
    let compiled_js = "return { default: () => null }";
    let manifest = crate::manifest::Manifest {
        version: "0.1.0".to_string(),
        origin_domain: Some("local".to_string()),
        capabilities: Vec::new(),
        signature: None,
    };
    crate::save::save_document(&path, content_md, compiled_js, &manifest)
        .map_err(|e| e.to_string())?;
    Ok(path)
}

// ===== Package signing (Ed25519) =====

#[derive(serde::Serialize)]
struct KeypairInfo {
    pubkey: String,
    keyid: String,
}

/// Generate a new Ed25519 keypair. Stores the secret in the keychain under
/// `prizma.signing.<keyid>` and returns the pubkey + keyid.
#[tauri::command]
async fn signing_generate_keypair(
    state: State<'_, AppState>,
) -> Result<KeypairInfo, String> {
    let (pubkey, keyid, secret) = crate::signing::generate_keypair();
    let secret_hex = secret.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    state
        .secrets
        .set(&format!("prizma.signing.{keyid}"), &secret_hex)
        .await
        .map_err(|e| e.to_string())?;
    Ok(KeypairInfo { pubkey, keyid })
}

/// Sign the package at `path` with the named keyid. Reads the three layers,
/// signs the canonical form, writes the signature into the manifest, re-saves.
#[tauri::command]
async fn signing_sign(
    state: State<'_, AppState>,
    path: std::path::PathBuf,
    keyid: String,
) -> Result<(), String> {
    use std::io::Read;
    // Fetch the secret.
    let secret_hex = state
        .secrets
        .get(&format!("prizma.signing.{keyid}"))
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("no signing key for {keyid}"))?;
    let mut secret = [0u8; 32];
    for i in 0..32 {
        secret[i] = u8::from_str_radix(&secret_hex[i * 2..i * 2 + 2], 16).map_err(|e| e.to_string())?;
    }
    // Read the package's three layers.
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut content_md = Vec::new();
    let mut build_main = Vec::new();
    let mut manifest: crate::manifest::Manifest;
    {
        let mut mf = archive.by_name("manifest.json").map_err(|e| e.to_string())?;
        let mut buf = String::new();
        mf.read_to_string(&mut buf).map_err(|e| e.to_string())?;
        manifest = serde_json::from_str(&buf).map_err(|e| e.to_string())?;
    }
    {
        let mut c = archive.by_name("content.md").map_err(|e| e.to_string())?;
        c.read_to_end(&mut content_md).map_err(|e| e.to_string())?;
    }
    if let Ok(mut b) = archive.by_name("build/main.js") {
        b.read_to_end(&mut build_main).map_err(|e| e.to_string())?;
    }
    let payload = crate::signing::sign(&content_md, &build_main, &manifest, &secret)
        .map_err(|e| e.to_string())?;
    manifest.signature = Some(crate::signing::encode_payload(&payload).map_err(|e| e.to_string())?);
    // Re-save with the signed manifest.
    let content_str = String::from_utf8_lossy(&content_md).into_owned();
    let build_str = String::from_utf8_lossy(&build_main).into_owned();
    crate::save::save_document(&path, &content_str, &build_str, &manifest)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Verify the package's signature. Returns Unsigned / Valid{keyid} / Invalid{reason}.
#[tauri::command]
fn signing_verify(path: std::path::PathBuf) -> Result<crate::signing::VerifyResult, String> {
    use std::io::Read;
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut content_md = Vec::new();
    let mut build_main = Vec::new();
    let manifest: crate::manifest::Manifest;
    {
        let mut mf = archive.by_name("manifest.json").map_err(|e| e.to_string())?;
        let mut buf = String::new();
        mf.read_to_string(&mut buf).map_err(|e| e.to_string())?;
        manifest = serde_json::from_str(&buf).map_err(|e| e.to_string())?;
    }
    {
        let mut c = archive.by_name("content.md").map_err(|e| e.to_string())?;
        c.read_to_end(&mut content_md).map_err(|e| e.to_string())?;
    }
    if let Ok(mut b) = archive.by_name("build/main.js") {
        let _ = b.read_to_end(&mut build_main);
    }
    Ok(crate::signing::verify(&content_md, &build_main, &manifest))
}

/// Author-time inline completion. Returns a short continuation of the given
/// text (the current paragraph tail). NOT policy-gated (author-time). The
/// system prompt constrains to a brief, no-preamble continuation.
#[tauri::command]
async fn ai_complete_inline(
    state: State<'_, AppState>,
    provider: String,
    model: String,
    text: String,
) -> Result<String, String> {
    let p = state
        .providers
        .get(&provider)
        .ok_or_else(|| format!("unknown provider '{provider}'"))?;
    let system = "You complete the user's sentence. Return ONLY the continuation — no \
preamble, no quotes, no explanation. At most ~20 words. Match the voice and continue naturally.";
    let messages = vec![
        ("system".to_string(), system.to_string()),
        ("user".to_string(), text),
    ];
    let resp = p
        .complete(state.secrets.as_ref(), &CompletionRequest { model, messages })
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.text)
}

/// Render D2 source to SVG by shelling out to the `d2` binary. Returns the SVG
/// string, or an error message (e.g. "d2 not installed") that the frontend
/// surfaces gracefully.
#[tauri::command]
fn render_d2(source: String) -> Result<String, String> {
    use std::process::Command;
    // Write source to a temp file, run `d2 --layout=elk -` reading stdin.
    let output = Command::new("d2")
        .arg("-")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();
    let mut child = match output {
        Ok(c) => c,
        Err(_) => return Err("D2 is not installed. Install it from https://d2lang.com to render D2 diagrams.".into()),
    };
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let _ = stdin.write_all(source.as_bytes());
    }
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!("d2 failed: {}", String::from_utf8_lossy(&out.stderr)));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            open_document,
            grant_declared_capabilities,
            check_capability,
            ai_list_providers,
            ai_set_api_key,
            ai_clear_api_key,
            ai_has_api_key,
            ai_list_models,
            ai_complete,
            ai_author_component,
            ai_generate_document,
            ai_complete_inline,
            ai_start_oauth,
            ai_poll_oauth,
            ai_start_codex_pkce,
            ai_await_codex_callback,
            ai_set_acp_binary,
            open_in_browser,
            open_file_dialog,
            recent_documents,
            add_recent_document,
            share_document_path,
            reveal_document,
            copy_document,
            vault_list,
            vault_create_note,
            vault_create_memory,
            vault_rename,
            vault_delete,
            vault_file_in,
            vault_search,
            vault_chat,
            vault_snapshot,
            vault_list_versions,
            vault_restore_version,
            welcome_document_path,
            save_document,
            new_document,
            signing_generate_keypair,
            signing_sign,
            signing_verify,
            render_d2,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PrizmaPage");
}
