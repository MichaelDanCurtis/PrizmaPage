//! AI provider abstraction.
//!
//! A `Provider` answers a `CompletionRequest` (a model name + a list of
//! role/content messages) with a `CompletionResponse`. Concrete providers
//! fetch credentials from the SecretStore so secrets never flow through
//! document code or the frontend.
//!
//! Today: OpenAiCompatibleProvider — speaks the /v1/chat/completions shape used
//! by OpenAI, OpenRouter, Ollama, LM Studio, vLLM, etc. via a user-supplied
//! API key. OAuth (Copilot/Codex) and ACP (Claude Code) providers come later.

use crate::secret::{SecretError, SecretStore};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("provider '{0}' is not configured (no credential stored)")]
    NotConfigured(String),
    #[error("upstream request failed: {0}")]
    Upstream(String),
    #[error("upstream returned malformed response: {0}")]
    Malformed(String),
    #[error("secret store error: {0}")]
    Secret(String),
}

impl From<SecretError> for ProviderError {
    fn from(e: SecretError) -> Self {
        ProviderError::Secret(e.to_string())
    }
}

impl From<reqwest::Error> for ProviderError {
    fn from(e: reqwest::Error) -> Self {
        ProviderError::Upstream(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub model: String,
    pub messages: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub text: String,
}

#[async_trait]
pub trait Provider: Send + Sync {
    fn name(&self) -> &str;
    async fn complete(
        &self,
        secret: &dyn SecretStore,
        request: &CompletionRequest,
    ) -> Result<CompletionResponse, ProviderError>;
}

/// Provider that authenticates with a bearer API key and POSTs OpenAI-shaped
/// chat completions to a configurable base URL.
pub struct OpenAiCompatibleProvider {
    name: String,
    base_url: String,
    client: reqwest::Client,
}

impl OpenAiCompatibleProvider {
    pub fn new(name: &str, base_url: &str) -> Self {
        Self {
            name: name.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl Provider for OpenAiCompatibleProvider {
    fn name(&self) -> &str {
        &self.name
    }

    async fn complete(
        &self,
        secret: &dyn SecretStore,
        request: &CompletionRequest,
    ) -> Result<CompletionResponse, ProviderError> {
        let key = secret
            .get(&self.name)
            .await?
            .ok_or_else(|| ProviderError::NotConfigured(self.name.clone()))?;

        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages.iter().map(|(role, content)| {
                serde_json::json!({ "role": role, "content": content })
            }).collect::<Vec<_>>(),
        });

        let url = format!("{}/v1/chat/completions", self.base_url);
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&key)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(ProviderError::Upstream(format!("HTTP {status}: {text}")));
        }

        let parsed: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| ProviderError::Malformed(e.to_string()))?;

        let text = parsed["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| ProviderError::Malformed("missing choices[0].message.content".into()))?
            .to_string();

        Ok(CompletionResponse { text })
    }
}
