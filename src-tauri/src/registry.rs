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
