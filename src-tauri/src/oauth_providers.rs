//! Concrete OAuth provider configurations and their Provider-trait impls.
//!
//! GitHub Copilot and OpenAI Codex both authenticate via OAuth device flow
//! (RFC 8628). After auth, both serve OpenAI-shaped chat completions against
//! their respective endpoints. We reuse OpenAiCompatibleProvider's HTTP logic
//! by giving it the right base URL + bearer token (which OAuth stored in the
//! SecretStore under the provider's name).

use crate::oauth::OAuthConfig;
use crate::provider::{CompletionRequest, CompletionResponse, OpenAiCompatibleProvider, Provider, ProviderError};
use crate::secret::SecretStore;
use async_trait::async_trait;

/// GitHub Copilot device-flow config.
/// Client ID is the well-known Copilot VS Code extension client_id; users
/// authorize via github.com/login/device and receive a ghu_ token.
pub fn copilot_config() -> OAuthConfig {
    OAuthConfig {
        provider: "copilot".into(),
        client_id: "Iv1.b507a08c87ecfe98".into(),
        device_authorization_endpoint: "https://github.com/login/device/code".into(),
        token_endpoint: "https://github.com/login/oauth/access_token".into(),
        scopes: vec!["read:user".into()],
    }
}

/// OpenAI Codex device-flow config.
/// Codex uses OpenAI's own device-flow endpoints. (Live verification against
/// these requires a registered OpenAI OAuth app — see docs/verification.md.)
pub fn codex_config() -> OAuthConfig {
    OAuthConfig {
        provider: "codex".into(),
        client_id: "pdv_openai_codex".into(),
        device_authorization_endpoint: "https://auth.openai.com/oauth/device/code".into(),
        token_endpoint: "https://auth.openai.com/oauth/token".into(),
        scopes: vec!["openai.ignore".into()],
    }
}

/// An OAuth-authenticated provider that delegates completion to an
/// OpenAiCompatibleProvider pointed at the right base URL. The bearer token
/// is the OAuth access token, fetched from the SecretStore at call time.
pub struct OAuthProvider {
    name: String,
    base_url: String,
    inner: OpenAiCompatibleProvider,
}

impl OAuthProvider {
    pub fn new(name: &str, base_url: &str) -> Self {
        Self {
            name: name.to_string(),
            base_url: base_url.to_string(),
            inner: OpenAiCompatibleProvider::new(name, base_url),
        }
    }

    pub fn copilot() -> Self {
        // Copilot completions are served via the models proxy at
        // https://api.githubcopilot.com (OpenAI-shaped).
        Self::new("copilot", "https://api.githubcopilot.com")
    }

    pub fn codex() -> Self {
        Self::new("codex", "https://api.openai.com")
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

#[async_trait]
impl Provider for OAuthProvider {
    fn name(&self) -> &str {
        &self.name
    }

    async fn complete(
        &self,
        secret: &dyn SecretStore,
        request: &CompletionRequest,
    ) -> Result<CompletionResponse, ProviderError> {
        // Delegates to OpenAiCompatibleProvider, which pulls the bearer token
        // (here: the OAuth access token) from the secret store.
        self.inner.complete(secret, request).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copilot_config_uses_well_known_client_id() {
        let cfg = copilot_config();
        assert_eq!(cfg.client_id, "Iv1.b507a08c87ecfe98");
        assert_eq!(cfg.device_authorization_endpoint, "https://github.com/login/device/code");
        assert_eq!(cfg.provider, "copilot");
    }

    #[test]
    fn codex_config_targets_openai_auth() {
        let cfg = codex_config();
        assert_eq!(cfg.provider, "codex");
        assert!(cfg.token_endpoint.starts_with("https://auth.openai.com"));
    }

    #[test]
    fn oauth_providers_have_expected_base_urls() {
        assert_eq!(OAuthProvider::copilot().base_url(), "https://api.githubcopilot.com");
        assert_eq!(OAuthProvider::codex().base_url(), "https://api.openai.com");
    }
}
