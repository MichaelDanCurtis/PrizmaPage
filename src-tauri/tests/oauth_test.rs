//! OAuth device-flow client tests against a mock auth server.
//! Mirrors RFC 8628 and the shape GitHub (Copilot) / OpenAI (Codex) expose.

use prizmapage::oauth::{DeviceFlowClient, OAuthConfig};
use prizmapage::secret::{InMemorySecretStore, SecretStore};

fn cfg(base_url: String) -> OAuthConfig {
    OAuthConfig {
        provider: "copilot".into(),
        client_id: "Iv1.test".into(),
        device_authorization_endpoint: format!("{base_url}/login/device/code"),
        token_endpoint: format!("{base_url}/login/oauth/access_token"),
        scopes: vec!["read:user".into()],
    }
}

#[tokio::test]
async fn requests_device_code_and_returns_user_instructions() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST).path("/login/device/code");
        then.status(200).json_body(serde_json::json!({
            "device_code": "DC123",
            "user_code": "ABCD-WXYZ",
            "verification_uri": "https://github.com/login/device",
            "expires_in": 900,
            "interval": 1
        }));
    });

    let client = DeviceFlowClient::new(cfg(server.base_url()));
    let (dc, instructions) = client.request_device_code().await.unwrap();
    assert_eq!(dc.device_code, "DC123");
    assert_eq!(instructions.user_code, "ABCD-WXYZ");
    assert_eq!(instructions.verification_uri, "https://github.com/login/device");
}

#[tokio::test]
async fn poll_returns_none_while_authorization_pending() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST)
            .path("/login/oauth/access_token");
        then.status(200)
            .json_body(serde_json::json!({ "error": "authorization_pending" }));
    });

    let client = DeviceFlowClient::new(cfg(server.base_url()));
    let r1 = client.poll_once("DC123").await.unwrap();
    assert!(r1.is_none(), "pending response yields Ok(None)");
    // Subsequent polls while still pending also return None (mock is stable).
    let r2 = client.poll_once("DC123").await.unwrap();
    assert!(r2.is_none());
}

#[tokio::test]
async fn poll_returns_token_when_user_has_authorized() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST)
            .path("/login/oauth/access_token");
        then.status(200)
            .json_body(serde_json::json!({ "access_token": "ghu_success" }));
    });

    let client = DeviceFlowClient::new(cfg(server.base_url()));
    let r = client.poll_once("DC123").await.unwrap();
    assert_eq!(r.as_deref(), Some("ghu_success"));
}

#[tokio::test]
async fn await_token_completes_full_flow_and_stores_secret() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST).path("/login/oauth/access_token");
        then.status(200).json_body(serde_json::json!({
            "access_token": "ghu_stored"
        }));
    });

    let secret = InMemorySecretStore::new();
    let client = DeviceFlowClient::new(cfg(server.base_url()));
    client
        .await_token("DC123", 0, 5, &secret)
        .await
        .unwrap();
    let stored = secret.get("copilot").await.unwrap();
    assert_eq!(stored.as_deref(), Some("ghu_stored"));
}

#[tokio::test]
async fn poll_surfaces_denied_as_terminal_error() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST).path("/login/oauth/access_token");
        then.status(200).json_body(serde_json::json!({ "error": "access_denied" }));
    });
    let client = DeviceFlowClient::new(cfg(server.base_url()));
    let result = client.poll_once("DC123").await;
    assert!(matches!(result, Err(prizmapage::oauth::OAuthError::Denied)));
}

#[tokio::test]
async fn poll_surfaces_expired_as_terminal_error() {
    let server = httpmock::MockServer::start();
    server.mock(|when, then| {
        when.method(httpmock::Method::POST).path("/login/oauth/access_token");
        then.status(200).json_body(serde_json::json!({ "error": "expired_token" }));
    });
    let client = DeviceFlowClient::new(cfg(server.base_url()));
    let result = client.poll_once("DC123").await;
    assert!(matches!(result, Err(prizmapage::oauth::OAuthError::Expired)));
}
