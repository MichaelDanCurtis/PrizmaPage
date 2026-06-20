//! LIVE Codex OAuth verification against the real OpenAI auth endpoint.
//! Skips if no Codex auth.json is present on the machine.
//!
//! This proves the OAuth half of the Codex path against the real provider:
//! the public client_id `app_EMoamEEZ73f0CkXaXp7hrann` (extracted from the
//! official @openai/codex CLI binary — a public value, like Copilot's
//! Iv1.b507a08c87ecfe98) is accepted by auth.openai.com/oauth/token, and a
//! refresh-token exchange returns a fresh access_token. This is the live
//! OAuth handshake — the same path PrizmaPage's PKCE flow lands in.

use prizmapage::oauth_providers::codex_pkce_config;
use std::path::PathBuf;

fn codex_auth_present() -> Option<PathBuf> {
    let path = PathBuf::from(std::env::var("HOME").ok()?).join(".codex/auth.json");
    if path.exists() { Some(path) } else { None }
}

#[tokio::test]
async fn live_codex_client_id_accepted_by_real_openai_token_endpoint() {
    let auth_path = match codex_auth_present() {
        Some(p) => p,
        None => {
            eprintln!("skipping live test — no ~/.codex/auth.json (run `codex login` first)");
            return;
        }
    };

    // Read the existing refresh_token Michael already has from `codex login`.
    let auth_json: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string(&auth_path).expect("read auth.json"),
    )
    .expect("parse auth.json");
    let refresh_token = auth_json["tokens"]["refresh_token"]
        .as_str()
        .expect("refresh_token present")
        .to_string();

    let cfg = codex_pkce_config();
    // Sanity: confirm the config uses the real public client_id, not a placeholder.
    assert_eq!(
        cfg.client_id, "app_EMoamEEZ73f0CkXaXp7hrann",
        "config must use the real Codex CLI client_id"
    );
    assert_eq!(cfg.token_endpoint, "https://auth.openai.com/oauth/token");

    // POST the refresh-token grant to the REAL OpenAI endpoint.
    let client = reqwest::Client::new();
    let resp = client
        .post(&cfg.token_endpoint)
        .header("Accept", "application/json")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", cfg.client_id.as_str()),
        ])
        .send()
        .await
        .expect("token endpoint reachable");

    assert!(
        resp.status().is_success(),
        "OpenAI token endpoint must accept the real client_id; got HTTP {}",
        resp.status()
    );

    let body: serde_json::Value = resp.json().await.expect("json body");
    assert!(
        body.get("access_token").is_some(),
        "refresh must return an access_token"
    );
    assert_eq!(
        body.get("token_type").and_then(|v| v.as_str()),
        Some("Bearer"),
        "token_type must be Bearer"
    );
    assert!(
        body.get("expires_in").is_some(),
        "must include expires_in"
    );

    println!(
        "LIVE Codex OAuth refresh succeeded: client_id app_EMoamEEZ73f0CkXaXp7hrann accepted by auth.openai.com, returned fresh access_token + expires_in={}",
        body.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(0)
    );
}
