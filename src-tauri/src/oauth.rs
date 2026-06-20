//! OAuth 2.0 Device Authorization Grant (RFC 8628) client.
//!
//! A reusable state machine both GitHub Copilot and Codex (OpenAI) configure
//! with their own client_id, endpoints, and scope. The flow:
//!   1. POST to device_authorization_endpoint → get device_code + user_code +
//!      verification_uri. Show user_code/verification_uri to the user.
//!   2. Poll token_endpoint at `interval` seconds until the user authorizes
//!      (or it errors / expires / is denied).
//!   3. On success, store the access_token via SecretStore.
//!
//! Testable against a mock HTTP server; no real credentials needed.

use crate::secret::SecretStore;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum OAuthError {
    #[error("upstream request failed: {0}")]
    Upstream(String),
    #[error("malformed response: {0}")]
    Malformed(String),
    #[error("authorization pending (user has not yet visited the URL)")]
    Pending,
    #[error("authorization denied by user")]
    Denied,
    #[error("authorization expired")]
    Expired,
    #[error("authorization slow down (increase interval)")]
    SlowDown,
    #[error("timed out after {0} polls")]
    Timeout(usize),
    #[error("secret store error: {0}")]
    Secret(String),
}

impl From<reqwest::Error> for OAuthError {
    fn from(e: reqwest::Error) -> Self {
        OAuthError::Upstream(e.to_string())
    }
}

impl From<crate::secret::SecretError> for OAuthError {
    fn from(e: crate::secret::SecretError) -> Self {
        OAuthError::Secret(e.to_string())
    }
}

/// Provider-specific OAuth configuration.
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub provider: String,             // e.g. "copilot", "codex"
    pub client_id: String,
    pub device_authorization_endpoint: String,
    pub token_endpoint: String,
    pub scopes: Vec<String>,
}

/// The device-code request response (RFC 8628 §3.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// What the user needs to see to authorize.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAuthInstructions {
    pub user_code: String,
    pub verification_uri: String,
}

pub struct DeviceFlowClient {
    config: OAuthConfig,
    http: reqwest::Client,
}

impl DeviceFlowClient {
    pub fn new(config: OAuthConfig) -> Self {
        Self {
            config,
            http: reqwest::Client::new(),
        }
    }

    /// Step 1: request a device code. Returns the user-facing instructions.
    pub async fn request_device_code(&self) -> Result<(DeviceCode, UserAuthInstructions), OAuthError> {
        let resp = self
            .http
            .post(&self.config.device_authorization_endpoint)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", self.config.client_id.as_str()),
                ("scope", &self.config.scopes.join(" ")),
            ])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(OAuthError::Upstream(format!("HTTP {status}: {text}")));
        }

        let dc: DeviceCode = resp
            .json()
            .await
            .map_err(|e| OAuthError::Malformed(e.to_string()))?;

        let instructions = UserAuthInstructions {
            user_code: dc.user_code.clone(),
            verification_uri: dc.verification_uri.clone(),
        };
        Ok((dc, instructions))
    }

    /// Step 2: poll once for a token. Returns Ok(Some(token)) on success,
    /// Ok(None) if still pending, Err on denial/expiry/slowdown/upstream error.
    pub async fn poll_once(&self, device_code: &str) -> Result<Option<String>, OAuthError> {
        let resp = self
            .http
            .post(&self.config.token_endpoint)
            .header("Accept", "application/json")
            .form(&[
                ("client_id", self.config.client_id.as_str()),
                ("device_code", device_code),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ])
            .send()
            .await?;

        let status = resp.status();
        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| OAuthError::Malformed(format!("HTTP {status}: {e}")))?;

        // Success: access_token present.
        if let Some(token) = body.get("access_token").and_then(|v| v.as_str()) {
            return Ok(Some(token.to_string()));
        }

        // Error response: dispatch on error code.
        let err_code = body.get("error").and_then(|v| v.as_str()).unwrap_or("");
        match err_code {
            "authorization_pending" => Ok(None),
            "slow_down" => Err(OAuthError::SlowDown),
            "access_denied" => Err(OAuthError::Denied),
            "expired_token" => Err(OAuthError::Expired),
            other => Err(OAuthError::Upstream(format!("oauth error: {other}"))),
        }
    }

    /// Drive the full flow to completion: request code, poll at `interval`
    /// until success or terminal error. The caller should call
    /// `request_device_code` first to show the user their code/URL, then call
    /// this to block on the token. (Split so the UI can surface instructions
    /// before the blocking poll begins.)
    pub async fn await_token(
        &self,
        device_code: &str,
        interval_secs: u64,
        max_polls: usize,
        secret: &dyn SecretStore,
    ) -> Result<(), OAuthError> {
        let mut interval = Duration::from_secs(interval_secs.max(1));
        for _ in 0..max_polls {
            tokio::time::sleep(interval).await;
            match self.poll_once(device_code).await {
                Ok(Some(token)) => {
                    secret.set(&self.config.provider, &token).await?;
                    return Ok(());
                }
                Ok(None) => continue, // still pending
                Err(OAuthError::SlowDown) => {
                    interval = interval.saturating_mul(2); // server asked for less frequent polling
                    continue;
                }
                Err(e) => return Err(e), // Denied / Expired / Upstream — terminal
            }
        }
        Err(OAuthError::Timeout(max_polls))
    }
}
