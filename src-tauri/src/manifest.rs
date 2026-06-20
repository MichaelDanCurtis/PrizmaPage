use serde::{Deserialize, Serialize};

/// The package manifest. Layer 3 of the .mdxz format.
/// The `signature` field is reserved and null in v1 so the format never has
/// to break to add the trusted-source signing system later.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Manifest {
    pub version: String,
    /// Origin domain for future DKIM-style signature verification.
    #[serde(default)]
    pub origin_domain: Option<String>,
    /// Capabilities the document requests. Starts empty; user-approved at open.
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    /// RESERVED. Null in v1. Future: signature over the package contents.
    #[serde(default)]
    pub signature: Option<String>,
}

/// A capability declaration. Granularity B: coarse category + optional domain scoping.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "category")]
pub enum Capability {
    #[serde(rename = "network")]
    Network { scopes: Vec<String> },
    #[serde(rename = "storage")]
    Storage { limit_bytes: u64 },
    #[serde(rename = "clipboard")]
    Clipboard,
    #[serde(rename = "mcp")]
    Mcp { servers: Vec<String> },
    #[serde(rename = "ai")]
    Ai { providers: Vec<String> },
}
