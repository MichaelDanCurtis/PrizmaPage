//! ACP-backed Provider: turns the JSON-RPC agent client into a Provider so
//! `ai_complete(provider="claude", ...)` works through the same bridge as
//! OpenAI/Copilot/Codex.
//!
//! On each complete() call we spawn the configured agent binary (Claude Code
//! or any ACP-compliant agent), run initialize → session/new → session/prompt,
//! and return the agent's final text. One subprocess per completion keeps the
//! trust boundary simple (no long-lived agent holding state across calls).

use crate::acp::{AcpClient, AcpError};
use crate::provider::{CompletionRequest, CompletionResponse, Provider, ProviderError};
use crate::secret::SecretStore;
use async_trait::async_trait;
use std::sync::RwLock;

pub struct AcpProvider {
    name: String,
    // The binary + args to spawn. Configurable at runtime via set_binary().
    binary: RwLock<(String, Vec<String>)>,
}

impl AcpProvider {
    pub fn new(name: &str, binary: &str, args: &[&str]) -> Self {
        Self {
            name: name.to_string(),
            binary: RwLock::new((
                binary.to_string(),
                args.iter().map(|s| s.to_string()).collect(),
            )),
        }
    }

    /// Default Claude Code config: spawn `claude` in ACP mode.
    pub fn claude_code() -> Self {
        Self::new("claude", "claude", &["--acp"])
    }

    /// Update the binary to spawn (used by ai_set_acp_binary).
    pub fn set_binary(&self, binary: &str, args: &[&str]) {
        if let Ok(mut g) = self.binary.write() {
            *g = (
                binary.to_string(),
                args.iter().map(|s| s.to_string()).collect(),
            );
        }
    }
}

impl From<AcpError> for ProviderError {
    fn from(e: AcpError) -> Self {
        ProviderError::Upstream(e.to_string())
    }
}

#[async_trait]
impl Provider for AcpProvider {
    fn name(&self) -> &str {
        &self.name
    }

    async fn complete(
        &self,
        _secret: &dyn SecretStore,
        request: &CompletionRequest,
    ) -> Result<CompletionResponse, ProviderError> {
        let (binary, args) = self
            .binary
            .read()
            .map_err(|e| ProviderError::Upstream(e.to_string()))?
            .clone();

        let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        let mut client = AcpClient::spawn(&binary, &arg_refs)?;
        client.initialize().await?;
        let session_id = client.session_new().await?;

        // Flatten the message list into a single prompt (ACP session/prompt
        // takes one text block). For multi-turn, the caller would manage
        // session continuity — out of scope for the minimal Provider shape.
        let prompt: String = request
            .messages
            .iter()
            .map(|(role, content)| format!("[{role}] {content}"))
            .collect::<Vec<_>>()
            .join("\n");

        let result = client.session_prompt(&session_id, &prompt).await?;
        Ok(CompletionResponse {
            text: result.text.unwrap_or_default(),
        })
    }
}
