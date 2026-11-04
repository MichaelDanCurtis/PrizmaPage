//! Agent Client Protocol (ACP) client.
//!
//! ACP is JSON-RPC 2.0 over stdin/stdout, by Zed Industries. It lets a client
//! (editor) drive an AI coding agent (server) like Claude Code. Spec:
//! https://agentclientprotocol.com/protocol/v1/
//!
//! Baseline method sequence:
//!   1. initialize  — negotiate protocol version + capabilities
//!   2. session/new — create a conversation session, returns sessionId
//!   3. session/prompt — send a user message; agent streams session/update
//!      notifications and finishes with a session/prompt result
//!
//! The client is testable by injecting a Command-spawner: production spawns
//! `claude` (or a configured binary), tests spawn a mock script.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use thiserror::Error;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};

#[derive(Debug, Error)]
pub enum AcpError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("agent process exited unexpectedly")]
    ProcessExited,
    #[error("malformed JSON-RPC line: {0}")]
    Malformed(String),
    #[error("JSON-RPC error from agent (code {code}): {message}")]
    Rpc { code: i64, message: String },
    #[error("unexpected response: expected method '{expected}', got {got}")]
    Unexpected { expected: String, got: String },
}

// ===== JSON-RPC 2.0 message types =====

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: i64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse<T> {
    pub jsonrpc: String,
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

/// Initialize params the client sends.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeParams {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: i64,
    #[serde(rename = "clientCapabilities")]
    pub client_capabilities: serde_json::Value,
    #[serde(rename = "clientInfo")]
    pub client_info: ClientInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InitializeResult {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: i64,
    #[serde(rename = "agentInfo")]
    pub agent_info: serde_json::Value,
    #[serde(default)]
    pub capabilities: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionNewResult {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionPromptResult {
    /// The agent's final text response (or a summary). The full transcript
    /// arrives via session/update notifications during the prompt.
    #[serde(default)]
    pub text: Option<String>,
}

/// How to spawn the agent process. Production uses a real binary; tests inject
/// a mock. Returns the Child (whose stdin/stdout we own).
pub type Spawner = Box<dyn Fn() -> std::io::Result<Child> + Send + Sync>;

pub struct AcpClient {
    // Held (unread) to keep the agent subprocess alive for the client's lifetime.
    // stdin/stdout are taken into their own fields; the Child itself just owns the
    // process handle so it isn't reaped early.
    #[allow(dead_code)]
    child: Child,
    stdin: tokio::process::ChildStdin,
    stdout_rx: tokio::sync::mpsc::Receiver<Result<String, AcpError>>,
    next_id: i64,
}

impl AcpClient {
    /// Production constructor: spawn the given binary with args.
    pub fn spawn(binary: &str, args: &[&str]) -> Result<Self, AcpError> {
        let binary = binary.to_string();
        let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();
        Self::spawn_with(Box::new(move || {
            let mut cmd = Command::new(&binary);
            cmd.args(&args);
            spawn_child(&mut cmd)
        }))
    }

    /// Test constructor: inject a custom spawner (e.g. spawn a mock script).
    pub fn spawn_with(spawner: Spawner) -> Result<Self, AcpError> {
        let mut child = spawner()?;
        let stdin = child
            .stdin
            .take()
            .ok_or(AcpError::ProcessExited)?;
        let stdout = child
            .stdout
            .take()
            .ok_or(AcpError::ProcessExited)?;

        let (tx, rx) = tokio::sync::mpsc::channel(64);
        // Reader task: pump stdout lines into the channel.
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            loop {
                match reader.next_line().await {
                    Ok(Some(line)) => {
                        if tx.send(Ok(line)).await.is_err() {
                            break;
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        let _ = tx.send(Err(AcpError::Io(e))).await;
                        break;
                    }
                }
            }
        });

        Ok(Self {
            child,
            stdin,
            stdout_rx: rx,
            next_id: 1,
        })
    }

    fn next_request_id(&mut self) -> i64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    async fn write_line(&mut self, line: &str) -> Result<(), AcpError> {
        self.stdin.write_all(line.as_bytes()).await?;
        self.stdin.write_all(b"\n").await?;
        self.stdin.flush().await?;
        Ok(())
    }

    /// Read the next line and parse as a JSON-RPC response matching `id`.
    async fn read_response<T: serde::de::DeserializeOwned>(
        &mut self,
        expected_id: i64,
    ) -> Result<T, AcpError> {
        loop {
            let line = self
                .stdout_rx
                .recv()
                .await
                .ok_or(AcpError::ProcessExited)??;
            // A line could be a notification or a response. Parse generically first.
            let v: serde_json::Value = serde_json::from_str(&line)
                .map_err(|e| AcpError::Malformed(e.to_string()))?;

            // Skip notifications (no "id") — they're out-of-band updates.
            if v.get("id").is_none() {
                continue;
            }

            let id = v.get("id").and_then(|i| i.as_i64()).unwrap_or(0);
            if id != expected_id {
                // Not ours; skip (or stash — for now skip).
                continue;
            }

            if let Some(err) = v.get("error") {
                let code = err.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
                let message = err
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("unknown error")
                    .to_string();
                return Err(AcpError::Rpc { code, message });
            }

            let result = v
                .get("result")
                .ok_or_else(|| AcpError::Malformed("response missing result".into()))?;
            let typed: T = serde_json::from_value(result.clone())
                .map_err(|e| AcpError::Malformed(e.to_string()))?;
            return Ok(typed);
        }
    }

    /// ACP initialize: negotiate protocol version + capabilities.
    pub async fn initialize(&mut self) -> Result<InitializeResult, AcpError> {
        let id = self.next_request_id();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id,
            method: "initialize".into(),
            params: Some(serde_json::to_value(InitializeParams {
                protocol_version: 1,
                client_capabilities: serde_json::json!({}),
                client_info: ClientInfo {
                    name: "prizmapage".into(),
                    version: "0.1.0".into(),
                },
            })?),
        };
        self.write_line(&serde_json::to_string(&req)?).await?;
        self.read_response::<InitializeResult>(id).await
    }

    /// ACP session/new: create a conversation session.
    pub async fn session_new(&mut self) -> Result<String, AcpError> {
        let id = self.next_request_id();
        // cwd MUST be absolute — the Claude adapter rejects "." with
        // "must be an absolute path".
        let cwd = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/tmp".to_string());
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id,
            method: "session/new".into(),
            // mcpServers MUST be an array per the ACP schema (the Claude adapter
            // rejects an object with "expected array, received object").
            params: Some(serde_json::json!({
                "cwd": cwd,
                "mcpServers": [],
                "sessionStrategy": "new"
            })),
        };
        self.write_line(&serde_json::to_string(&req)?).await?;
        let result: SessionNewResult = self.read_response(id).await?;
        Ok(result.session_id)
    }

    /// ACP session/prompt: send a user message, accumulate streamed
    /// `agent_message_chunk` notifications into the final text, and return
    /// when the matching response (id) arrives.
    ///
    /// The ACP spec streams the agent's text via session/update notifications
    /// (update.sessionUpdate == "agent_message_chunk", update.content.text);
    /// the final session/prompt response carries only stopReason + usage.
    pub async fn session_prompt(
        &mut self,
        session_id: &str,
        prompt: &str,
    ) -> Result<SessionPromptResult, AcpError> {
        let id = self.next_request_id();
        let req = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id,
            method: "session/prompt".into(),
            params: Some(serde_json::json!({
                "sessionId": session_id,
                "prompt": [{"type": "text", "text": prompt}]
            })),
        };
        self.write_line(&serde_json::to_string(&req)?).await?;

        // Accumulate text chunks from notifications until the response arrives.
        let mut accumulated = String::new();
        loop {
            let line = self
                .stdout_rx
                .recv()
                .await
                .ok_or(AcpError::ProcessExited)??;
            let v: serde_json::Value = serde_json::from_str(&line)
                .map_err(|e| AcpError::Malformed(e.to_string()))?;

            // Notification with agent text?
            if v.get("id").is_none() {
                if v.get("method").and_then(|m| m.as_str()) == Some("session/update") {
                    let update = &v["params"]["update"];
                    if update.get("sessionUpdate").and_then(|s| s.as_str())
                        == Some("agent_message_chunk")
                    {
                        if let Some(text) = update.get("content").and_then(|c| c.get("text")).and_then(|t| t.as_str()) {
                            accumulated.push_str(text);
                        }
                    }
                }
                continue;
            }

            // It's a response — must be ours.
            let resp_id = v.get("id").and_then(|i| i.as_i64()).unwrap_or(0);
            if resp_id != id {
                continue;
            }
            if let Some(err) = v.get("error") {
                let code = err.get("code").and_then(|c| c.as_i64()).unwrap_or(-1);
                let message = err
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("unknown error")
                    .to_string();
                return Err(AcpError::Rpc { code, message });
            }
            // Result present means completion. Text came from notifications.
            let _result = v.get("result").ok_or_else(|| {
                AcpError::Malformed("session/prompt response missing result".into())
            })?;
            return Ok(SessionPromptResult {
                text: if accumulated.is_empty() {
                    None
                } else {
                    Some(accumulated)
                },
            });
        }
    }
}

/// Shared spawn helper: pipes everything, returns a Child.
fn spawn_child(cmd: &mut Command) -> std::io::Result<Child> {
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}
