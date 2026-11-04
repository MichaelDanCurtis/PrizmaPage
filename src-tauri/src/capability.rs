use crate::manifest::Capability;
use serde::{Deserialize, Serialize};

/// A concrete request at runtime, distinct from a declared capability.
/// A declared `Capability::Network { scopes }` permits a `CapabilityRequest::Network { host }`
/// only when the host is within the scopes.
///
/// Tagged with `kind` so the frontend can construct requests as discriminated unions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum CapabilityRequest {
    Network { host: String },
    Storage { byte_count: u64 },
    Clipboard,
    Mcp { server: String },
    Ai { provider: String },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Decision {
    Allowed,
    Denied,
}

/// Returns true if the declared capability permits the concrete request.
pub fn permits(capability: &Capability, request: &CapabilityRequest) -> bool {
    match (capability, request) {
        (Capability::Network { scopes }, CapabilityRequest::Network { host }) => scopes
            .iter()
            .any(|scope| host == scope || host.ends_with(&format!(".{scope}"))),
        (Capability::Storage { limit_bytes }, CapabilityRequest::Storage { byte_count }) => {
            *byte_count <= *limit_bytes
        }
        (Capability::Clipboard, CapabilityRequest::Clipboard) => true,
        (Capability::Mcp { servers }, CapabilityRequest::Mcp { server }) => {
            servers.contains(server)
        }
        (Capability::Ai { providers }, CapabilityRequest::Ai { provider }) => {
            providers.contains(provider)
        }
        _ => false,
    }
}
