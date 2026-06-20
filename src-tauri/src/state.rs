use crate::policy::PolicyEngine;
use crate::registry::Registry;
use crate::secret::{KeyringSecretStore, SecretStore};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;

/// App state held in Tauri's managed state.
///
/// - `policy`: per-document policy engine (Phase 0). Single document for now.
/// - `secrets`: OS-keychain-backed credential store.
/// - `providers`: registry of configured AI providers.
/// - `pending_oauth`: in-flight device codes keyed by provider name, held
///   between the ai_start_oauth and ai_poll_oauth calls.
pub struct AppState {
    pub policy: Mutex<PolicyEngine>,
    pub secrets: Arc<dyn SecretStore>,
    pub providers: Registry,
    pub pending_oauth: Mutex<HashMap<String, crate::oauth::DeviceCode>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            policy: Mutex::new(PolicyEngine::new()),
            secrets: Arc::new(KeyringSecretStore::new("com.prizmapage.app")),
            providers: Registry::with_builtin_openai_compatible(),
            pending_oauth: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
