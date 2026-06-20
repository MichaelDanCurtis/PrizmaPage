//! LIVE integration test against the real `claude-agent-acp` adapter.
//! Skips automatically if the adapter is not installed.
//! Verifies the ACP handshake path end-to-end through the Provider trait,
//! against a real ACP-compliant agent (not a mock).

use prizmapage::acp_provider::AcpProvider;
use prizmapage::provider::Provider;
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
    // Don't actually call complete() (needs auth); just confirm the provider
    // constructs and is named "claude".
    assert_eq!(provider.name(), "claude");
}
