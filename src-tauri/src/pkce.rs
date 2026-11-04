//! OAuth 2.0 Authorization Code flow with PKCE (RFC 7636).
//!
//! Used by Codex (OpenAI ChatGPT sign-in), which does NOT support device flow.
//! The flow:
//!   1. Generate a random code_verifier + derive code_challenge (S256).
//!   2. Build an authorization URL; open it in the user's browser.
//!   3. Listen on localhost:port for the redirect callback; capture `code`.
//!   4. POST code + code_verifier to the token endpoint; receive access_token.
//!   5. Store the access_token via SecretStore.
//!
//! Mock-testable: the HTTP listener + token exchange use reqwest, so tests
//! point them at a mock server. The PKCE primitives (verifier/challenge) are
//! pure functions tested directly.

use crate::secret::SecretStore;
use base64::Engine;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PkceError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("upstream request failed: {0}")]
    Upstream(String),
    #[error("malformed response: {0}")]
    Malformed(String),
    #[error("callback error: {0}")]
    Callback(String),
    #[error("timed out waiting for callback")]
    Timeout,
    #[error("secret store error: {0}")]
    Secret(String),
}

impl From<reqwest::Error> for PkceError {
    fn from(e: reqwest::Error) -> Self {
        PkceError::Upstream(e.to_string())
    }
}

impl From<crate::secret::SecretError> for PkceError {
    fn from(e: crate::secret::SecretError) -> Self {
        PkceError::Secret(e.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct PkceConfig {
    pub provider: String,
    pub client_id: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub redirect_port: u16,
    pub scopes: Vec<String>,
}

/// PKCE verifier + derived S256 challenge.
#[derive(Debug, Clone)]
pub struct PkcePair {
    pub verifier: String,
    pub challenge: String,
}

impl PkcePair {
    /// Generate a fresh verifier (43-128 random URL-safe chars) and derive
    /// the S256 challenge per RFC 7636 §4.2.
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes);
        let challenge = {
            let mut hasher = Sha256::new();
            hasher.update(verifier.as_bytes());
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize())
        };
        Self { verifier, challenge }
    }
}

/// What the user needs: an authorization URL to open in the browser.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationRequest {
    pub url: String,
    pub state: String,
}

pub struct PkceClient {
    config: PkceConfig,
    http: reqwest::Client,
}

impl PkceClient {
    pub fn new(config: PkceConfig) -> Self {
        Self {
            config,
            http: reqwest::Client::new(),
        }
    }

    /// Step 1: build the authorization URL + state. The caller opens `url` in
    /// the browser, then calls await_callback.
    pub fn build_authorization_url(&self, pkce: &PkcePair) -> AuthorizationRequest {
        let state = {
            let mut b = [0u8; 16];
            rand::thread_rng().fill_bytes(&mut b);
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b)
        };
        let redirect_uri = format!("http://localhost:{}/", self.config.redirect_port);
        let scope_string = self.config.scopes.join(" ");
        let params = vec![
            ("response_type", "code"),
            ("client_id", &self.config.client_id),
            ("redirect_uri", &redirect_uri),
            ("scope", &scope_string),
            ("code_challenge", &pkce.challenge),
            ("code_challenge_method", "S256"),
            ("state", &state),
        ];
        let query: String = form_urlencoded(params);
        let url = format!("{}?{}", self.config.authorization_endpoint, query);
        AuthorizationRequest { url, state }
    }

    /// Step 2 + 3: listen on localhost:port for the callback, extract the auth
    /// code, then exchange it for a token. Stores the token via SecretStore.
    /// `timeout_secs` bounds how long we wait for the user to authorize.
    ///
    /// Robust to browsers that fire a favicon/preflight GET before the real
    /// redirect: loops accepting connections until it sees one carrying
    /// `code=` or `error=` in the query string, then closes the listener.
    pub async fn await_callback_and_exchange(
        &self,
        pkce: &PkcePair,
        expected_state: &str,
        timeout_secs: u64,
        secret: &dyn SecretStore,
    ) -> Result<(), PkceError> {
        // Bind the listener.
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", self.config.redirect_port))
            .await
            .map_err(PkceError::Io)?;

        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let deadline = tokio::time::Instant::now() + Duration::from_secs(timeout_secs);

        // Keep accepting connections until we see the code-bearing redirect
        // (or the deadline). Each non-code request (favicon, preflight) gets a
        // polite 404 so the browser doesn't retry-spam.
        let code: String = loop {
            let accept_fut = listener.accept();
            let (mut socket, _) = match tokio::time::timeout_at(deadline, accept_fut).await {
                Ok(Ok(c)) => c,
                Ok(Err(e)) => return Err(PkceError::Io(e)),
                Err(_) => return Err(PkceError::Timeout),
            };

            // Read up to 16KB so large cookie headers don't truncate the request line.
            let mut buf = vec![0u8; 16384];
            let n = match socket.read(&mut buf).await {
                Ok(n) => n,
                Err(_) => continue, // peer hung up; accept the next
            };
            let request = String::from_utf8_lossy(&buf[..n]).to_string();
            let request_line = request.lines().next().unwrap_or("");
            let path = request_line.split_whitespace().nth(1).unwrap_or("");
            let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");

            // Parse query params.
            let mut this_code: Option<String> = None;
            let mut this_state: Option<String> = None;
            let mut this_err: Option<String> = None;
            for pair in query.split('&') {
                if let Some((k, v)) = pair.split_once('=') {
                    match k {
                        "code" => this_code = Some(percent_decode(v)),
                        "state" => this_state = Some(percent_decode(v)),
                        "error" => this_err = Some(percent_decode(v)),
                        _ => {}
                    }
                }
            }

            // Respond so the browser doesn't hang.
            let (status, body) = if this_code.is_some() || this_err.is_some() {
                let b = if this_err.is_some() {
                    "Authorization failed. You can close this tab."
                } else {
                    "Authorization complete. You can close this tab."
                };
                ("200 OK", b)
            } else {
                ("404 Not Found", "")
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n<html><body><p>{body}</p></body></html>"
            );
            let _ = socket.write_all(response.as_bytes()).await;
            let _ = socket.flush().await;

            // Got the real redirect — dispatch on its contents.
            if let Some(e) = this_err {
                return Err(PkceError::Callback(e));
            }
            if this_code.is_some() {
                let got_state = this_state.unwrap_or_default();
                if got_state != expected_state {
                    return Err(PkceError::Callback(format!(
                        "state mismatch (expected {expected_state}, got {got_state})"
                    )));
                }
                break this_code.unwrap();
            }
            // else: favicon/preflight — keep the listener open for the next.
        };

        // Step 3: exchange.
        let redirect_uri = format!("http://localhost:{}/", self.config.redirect_port);
        let resp = self
            .http
            .post(&self.config.token_endpoint)
            .header("Accept", "application/json")
            .form(&[
                ("grant_type", "authorization_code"),
                ("code", code.as_str()),
                ("redirect_uri", redirect_uri.as_str()),
                ("client_id", self.config.client_id.as_str()),
                ("code_verifier", pkce.verifier.as_str()),
            ])
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(PkceError::Upstream(format!("HTTP {status}: {text}")));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| PkceError::Malformed(e.to_string()))?;
        let token = body
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| PkceError::Malformed("no access_token in response".into()))?;

        secret.set(&self.config.provider, token).await?;
        Ok(())
    }
}

fn form_urlencoded(params: Vec<(&str, &str)>) -> String {
    params
        .iter()
        .map(|(k, v)| {
            format!(
                "{}={}",
                url_encode(k),
                url_encode(v)
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn url_encode(s: &str) -> String {
    url::form_urlencoded::byte_serialize(s.as_bytes()).collect()
}

/// Decode a single percent-encoded value (e.g. "abc%20def" -> "abc def").
/// For a single callback param value this is all we need; full query parsing
/// is done by the caller's split('&')/split_once('=') loop.
fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""),
                16,
            ) {
                out.push(byte as char);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}
