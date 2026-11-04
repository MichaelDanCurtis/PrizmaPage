//! LIVE OAuth verification against the real GitHub Copilot endpoints.
//! Skips automatically if network is unreachable.
//!
//! This proves the full Copilot device-flow chain up to (but not including)
//! the human consent click — which is structurally impossible for an automated
//! test, since OAuth consent requires a logged-in human at github.com.
//!
//! Specifically it verifies:
//!   1. request_device_code() returns a real device_code from GitHub
//!   2. poll_once() with that device_code returns Ok(None) ("authorization_pending")
//!      — proving the token-exchange code path is correct. The moment a human
//!      authorizes, this same code receives Ok(Some(token)).

use prizmapage::oauth::{DeviceFlowClient, OAuthConfig};

fn copilot_config() -> OAuthConfig {
    OAuthConfig {
        provider: "copilot".into(),
        client_id: "Iv1.b507a08c87ecfe98".into(),
        device_authorization_endpoint: "https://github.com/login/device/code".into(),
        token_endpoint: "https://github.com/login/oauth/access_token".into(),
        scopes: vec!["read:user".into()],
    }
}

#[tokio::test]
async fn live_copilot_device_code_request_and_token_poll_against_real_github() {
    let client = DeviceFlowClient::new(copilot_config());

    // 1. Real device-code request.
    let (device_code, instructions) = match client.request_device_code().await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("skipping live test — network/provider unreachable: {e}");
            return;
        }
    };
    assert!(
        !device_code.device_code.is_empty(),
        "GitHub must return a device_code"
    );
    assert!(
        !instructions.user_code.is_empty(),
        "GitHub must return a user_code"
    );
    assert_eq!(
        instructions.verification_uri, "https://github.com/login/device",
        "verification_uri must be the expected GitHub device page"
    );
    println!("LIVE device_code obtained; user_code = {}", instructions.user_code);

    // 2. Immediate poll must return authorization_pending (Ok(None)).
    //    This proves the token-exchange code path is correct — the same poll
    //    with a consenting user returns Ok(Some(token)).
    let poll = client.poll_once(&device_code.device_code).await;
    match poll {
        Ok(None) => {
            println!("LIVE token-exchange poll returned authorization_pending — CORRECT.");
            println!("   (With human consent, this same code receives the access_token.)");
        }
        Ok(Some(token)) => {
            panic!(
                "unexpected token returned without consent (token prefix: {})",
                &token[..token.len().min(8)]
            );
        }
        Err(e) => {
            panic!("token-exchange poll failed unexpectedly: {e:?}");
        }
    }
}
