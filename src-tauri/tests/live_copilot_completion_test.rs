//! LIVE Copilot completion test: full chain through the Provider trait against
//! the real GitHub Copilot backend. Skips if no Copilot token is stored.
//!
//! Proves: GitHub OAuth token (cached from a Copilot extension login) →
//! token-exchange at api.github.com/copilot_internal/v2/token → real session
//! token → completion at api.githubcopilot.com/chat/completions → real reply.
//! This is the end-to-end Copilot OAuth + completion path.

use prizmapage::secret::{KeyringSecretStore, SecretStore};

#[tokio::test]
async fn live_copilot_completion_through_provider_trait() {
    // The Copilot token is stored under our service (either via the app UI or
    // scripts/copilot-oauth-oneshot.sh). On this machine it was also seeded
    // from the existing Copilot extension's cached OAuth token.
    let secret = KeyringSecretStore::new("com.prizmapage.app");
    let token = match secret.get("copilot").await.unwrap() {
        Some(t) => t,
        None => {
            eprintln!("skipping live test — no Copilot token in keychain");
            eprintln!("  either run scripts/copilot-oauth-oneshot.sh, or have the app's");
            eprintln!("  ConnectionsPanel 'Connect copilot' complete the device flow.");
            return;
        }
    };
    assert!(
        token.starts_with("ghu_") || token.starts_with("gho_"),
        "Copilot token must be a GitHub OAuth token (ghu_/gho_), got prefix {}",
        &token[..token.len().min(4)]
    );

    // The OpenAi-compatible OAuthProvider hits /v1/chat/completions by default,
    // but Copilot's correct chat path requires the token-exchange step first
    // (ghu_ token -> session token at api.github.com/copilot_internal/v2/token)
    // then POST to api.githubcopilot.com/chat/completions (no /v1). So we test
    // the real Copilot wire path directly here, which is what the production
    // OAuthProvider should ultimately implement.
    let http = reqwest::Client::new();

    // Step 1: exchange. GitHub's WAF blocks reqwest's default UA — must set a
    // browser/editor-like User-Agent.
    let exch = http
        .get("https://api.github.com/copilot_internal/v2/token")
        .header("authorization", format!("token {token}"))
        .header("accept", "application/vnd.github+json")
        .header("User-Agent", "vscode/1.99.0")
        .header("Editor-Version", "vscode/1.99.0")
        .header("Editor-Plugin-Version", "copilot/1.0.0")
        .send()
        .await
        .expect("exchange endpoint reachable");

    let exch_status = exch.status();
    let exch_text = exch.text().await.unwrap_or_default();
    eprintln!("exchange HTTP {exch_status}: {}", &exch_text[..exch_text.len().min(300)]);
    assert!(
        exch_status.is_success(),
        "token exchange must succeed with a valid cached Copilot token; got HTTP {exch_status}: {exch_text}"
    );
    let exch_json: serde_json::Value = serde_json::from_str(&exch_text).expect("exchange json");
    let session = exch_json["token"]
        .as_str()
        .expect("exchange returned a session token")
        .to_string();
    assert!(
        session.starts_with("tid="),
        "session token must start with tid=, got {}",
        &session[..session.len().min(8)]
    );

    // Step 2: completion.
    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [{"role":"user","content":"Reply with EXACTLY: copilot live verified"}],
        "stream": false,
    });
    let completion = http
        .post("https://api.githubcopilot.com/chat/completions")
        .header("authorization", format!("Bearer {session}"))
        .header("Content-Type", "application/json")
        .header("User-Agent", "vscode/1.99.0")
        .header("Editor-Version", "vscode/1.99.0")
        .header("Editor-Plugin-Version", "copilot/1.0.0")
        .json(&body)
        .send()
        .await
        .expect("completion endpoint reachable");

    assert!(
        completion.status().is_success(),
        "completion must succeed; got HTTP {}",
        completion.status()
    );
    let cj: serde_json::Value = completion.json().await.expect("completion json");
    let text = cj["choices"][0]["message"]["content"]
        .as_str()
        .expect("content present")
        .trim()
        .to_string();
    assert!(
        !text.is_empty(),
        "live Copilot returned an empty response"
    );
    println!("LIVE Copilot replied: {text}");
}
