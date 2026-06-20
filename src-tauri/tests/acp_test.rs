//! ACP client tests against a mock agent subprocess.
//!
//! The mock is a tiny Python script (python3 is available in this env) that
//! reads JSON-RPC requests line-by-line from stdin and writes canned JSON-RPC
//! responses to stdout. This proves the client's framing/parsing/transport
//! against a real spawned process without needing the actual `claude` binary.

use prizmapage::acp::{AcpClient, Spawner};
use std::process::Stdio;
use tokio::process::Child;

/// Returns a spawner that launches a mock ACP agent (python3 stdin/stdout
/// JSON-RPC echo). The agent responds to initialize / session/new /
/// session/prompt with fixed JSON-RPC messages.
fn mock_spawner() -> Spawner {
    let script = r#"
import sys, json
while True:
    line = sys.stdin.readline()
    if not line:
        break
    try:
        req = json.loads(line)
    except Exception:
        continue
    method = req.get("method")
    rid = req.get("id")
    if method == "initialize":
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":rid,"result":{"protocolVersion":1,"agentInfo":{"name":"mock-claude","version":"0.0.0-test"}}}) + "\n")
        sys.stdout.flush()
    elif method == "session/new":
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":rid,"result":{"sessionId":"sess-123"}}) + "\n")
        sys.stdout.flush()
    elif method == "session/prompt":
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","method":"session/update","params":{"text":"thinking..."}}) + "\n")
        sys.stdout.flush()
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":rid,"result":{"text":"Hello from mock Claude"}}) + "\n")
        sys.stdout.flush()
"#;
    let script = script.to_string();
    Box::new(move || {
        let mut cmd = tokio::process::Command::new("python3");
        cmd.arg("-c").arg(&script);
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        cmd.spawn().map(|c: Child| c)
    })
}

#[tokio::test]
async fn initialize_negotiates_protocol_version() {
    let mut client = AcpClient::spawn_with(Box::new(mock_spawner())).unwrap();
    let result = client.initialize().await.unwrap();
    assert_eq!(result.protocol_version, 1);
    assert_eq!(result.agent_info["name"], "mock-claude");
}

#[tokio::test]
async fn session_new_returns_a_session_id() {
    let mut client = AcpClient::spawn_with(Box::new(mock_spawner())).unwrap();
    client.initialize().await.unwrap();
    let session_id = client.session_new().await.unwrap();
    assert_eq!(session_id, "sess-123");
}

#[tokio::test]
async fn session_prompt_returns_final_text_ignoring_notifications() {
    let mut client = AcpClient::spawn_with(Box::new(mock_spawner())).unwrap();
    client.initialize().await.unwrap();
    let session_id = client.session_new().await.unwrap();
    let result = client.session_prompt(&session_id, "hi").await.unwrap();
    // The mock streams a session/update notification THEN the result; the
    // client must skip notifications and return the final text.
    assert_eq!(result.text.as_deref(), Some("Hello from mock Claude"));
}

#[tokio::test]
async fn full_initialize_new_prompt_sequence() {
    let mut client = AcpClient::spawn_with(Box::new(mock_spawner())).unwrap();
    client.initialize().await.unwrap();
    let sid = client.session_new().await.unwrap();
    let r1 = client.session_prompt(&sid, "first").await.unwrap();
    assert_eq!(r1.text.as_deref(), Some("Hello from mock Claude"));
}
