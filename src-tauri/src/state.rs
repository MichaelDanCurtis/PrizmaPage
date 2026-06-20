use crate::policy::PolicyEngine;
use std::sync::Mutex;

/// App state held in Tauri's managed state. The policy engine is per-document;
/// for Phase 0 we hold a single engine keyed to the currently-open document.
/// (Multi-document windows arrive with the UI in Phase 2.)
pub struct AppState {
    pub policy: Mutex<PolicyEngine>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            policy: Mutex::new(PolicyEngine::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
