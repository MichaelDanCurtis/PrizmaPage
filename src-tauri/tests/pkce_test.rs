//! PKCE primitives + URL building tests. The full callback/listener flow needs
//! a real browser redirect and is covered by the bring-your-own-creds checklist;
//! these tests verify the pure logic.

use prizmapage::pkce::{PkceClient, PkceConfig, PkcePair};
use sha2::{Digest, Sha256};
use base64::Engine;

fn cfg() -> PkceConfig {
    PkceConfig {
        provider: "codex".into(),
        client_id: "app_test".into(),
        authorization_endpoint: "https://auth.openai.com/oauth/authorize".into(),
        token_endpoint: "https://auth.openai.com/oauth/token".into(),
        redirect_port: 1455,
        scopes: vec!["openid".into(), "email".into()],
    }
}

#[test]
fn pkce_pair_verifier_is_url_safe_and_derives_s256_challenge() {
    let pair = PkcePair::generate();
    // Verifier must be a non-empty URL-safe string.
    assert!(!pair.verifier.is_empty());
    assert!(
        pair.verifier.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
        "verifier must be URL-safe: got {}",
        pair.verifier
    );

    // Challenge must equal base64url(sha256(verifier)) per RFC 7636 §4.2.
    let mut hasher = Sha256::new();
    hasher.update(pair.verifier.as_bytes());
    let expected = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hasher.finalize());
    assert_eq!(pair.challenge, expected);
}

#[test]
fn pkce_pair_generates_fresh_verifier_each_call() {
    let a = PkcePair::generate();
    let b = PkcePair::generate();
    assert_ne!(a.verifier, b.verifier, "verifiers must be unique");
    assert_ne!(a.challenge, b.challenge);
}

#[test]
fn authorization_url_includes_all_required_pkce_params() {
    let client = PkceClient::new(cfg());
    let pair = PkcePair::generate();
    let req = client.build_authorization_url(&pair);

    assert!(req.url.starts_with("https://auth.openai.com/oauth/authorize?"));
    assert!(req.url.contains("response_type=code"));
    assert!(req.url.contains("client_id=app_test"));
    assert!(req.url.contains("redirect_uri=http%3A%2F%2Flocalhost%3A1455%2F"));
    assert!(req.url.contains("code_challenge_method=S256"));
    assert!(req.url.contains(&format!("code_challenge={}", pair.challenge)));
    assert!(req.url.contains(&format!("state={}", req.state)));
    assert!(!req.state.is_empty(), "state must be generated");
}
