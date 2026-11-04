//! Provider registry.
//!
//! Maps a provider name (e.g. "openai", "copilot") to a concrete Provider.
//! Built-in OpenAI-compatible endpoints (OpenAI, OpenRouter, Ollama, LM Studio)
//! are pre-registered. OAuth and ACP providers get registered once connected.
//!
//! Providers are held behind Arc<dyn Provider> so a caller can clone a handle
//! and use it without holding a lock during the (async, slow) completion call.

use crate::provider::{OpenAiCompatibleProvider, Provider};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub struct Registry {
    providers: RwLock<HashMap<String, Arc<dyn Provider>>>,
}

impl Registry {
    pub fn with_builtin_openai_compatible() -> Self {
        let mut providers: HashMap<String, Arc<dyn Provider>> = HashMap::new();
        providers.insert(
            "openai".into(),
            Arc::new(OpenAiCompatibleProvider::new("openai", "https://api.openai.com")),
        );
        providers.insert(
            "openrouter".into(),
            Arc::new(OpenAiCompatibleProvider::new(
                "openrouter",
                "https://openrouter.ai/api",
            )),
        );
        providers.insert(
            "ollama".into(),
            Arc::new(OpenAiCompatibleProvider::new("ollama", "http://localhost:11434")),
        );
        // OAuth-authenticated providers. Their bearer token is the OAuth access
        // token, stored under the provider name in the SecretStore after the
        // device flow completes (see ai_start_oauth / ai_poll_oauth commands).
        providers.insert(
            "copilot".into(),
            Arc::new(crate::oauth_providers::OAuthProvider::copilot()),
        );
        providers.insert(
            "codex".into(),
            Arc::new(crate::oauth_providers::OAuthProvider::codex()),
        );
        // ACP-backed agent. Default spawns `claude --acp`; configurable at
        // runtime via the ai_set_acp_binary command.
        providers.insert(
            "claude".into(),
            Arc::new(crate::acp_provider::AcpProvider::claude_code()),
        );
        Self {
            providers: RwLock::new(providers),
        }
    }

    /// Like with_builtin_openai_compatible, but injects a shared ACP provider
    /// instance so AppState can reconfigure it directly (used by
    /// ai_set_acp_binary). The same Arc is registered under "claude".
    pub fn with_acp(acp: Arc<crate::acp_provider::AcpProvider>) -> Self {
        let mut providers: HashMap<String, Arc<dyn Provider>> = HashMap::new();
        providers.insert(
            "openai".into(),
            Arc::new(OpenAiCompatibleProvider::new("openai", "https://api.openai.com")),
        );
        providers.insert(
            "openrouter".into(),
            Arc::new(OpenAiCompatibleProvider::new(
                "openrouter",
                "https://openrouter.ai/api",
            )),
        );
        providers.insert(
            "ollama".into(),
            Arc::new(OpenAiCompatibleProvider::new("ollama", "http://localhost:11434")),
        );
        providers.insert(
            "copilot".into(),
            Arc::new(crate::oauth_providers::OAuthProvider::copilot()),
        );
        providers.insert(
            "codex".into(),
            Arc::new(crate::oauth_providers::OAuthProvider::codex()),
        );
        providers.insert("claude".into(), acp as Arc<dyn Provider>);
        Self {
            providers: RwLock::new(providers),
        }
    }

    pub fn list(&self) -> Vec<String> {
        self.providers
            .read()
            .map(|g| {
                let mut names: Vec<String> = g.keys().cloned().collect();
                names.sort();
                names
            })
            .unwrap_or_default()
    }

    pub fn register(&self, name: &str, provider: Arc<dyn Provider>) {
        if let Ok(mut g) = self.providers.write() {
            g.insert(name.to_string(), provider);
        }
    }

    /// Clones out an Arc handle to the named provider, if registered.
    pub fn get(&self, name: &str) -> Option<Arc<dyn Provider>> {
        self.providers.read().ok()?.get(name).cloned()
    }
}
