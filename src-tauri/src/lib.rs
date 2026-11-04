pub mod acp;
pub mod acp_provider;
pub mod capability;
pub mod manifest;
pub mod oauth;
pub mod oauth_providers;
pub mod package;
pub mod pkce;
pub mod policy;
pub mod provider;
pub mod recents;
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
            ai_complete,
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
            welcome_document_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running PrizmaPage");
}
