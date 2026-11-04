use crate::capability::{permits, CapabilityRequest, Decision};
use crate::manifest::Capability;

/// The policy engine holds the GRANTED capability set for the current document.
///
/// SECURITY INVARIANT: it starts at zero. The only way capabilities enter the
/// set is via an explicit user grant (e.g., approving the open-time manifest prompt).
/// Document code cannot grant itself anything.
pub struct PolicyEngine {
    granted: Vec<Capability>,
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self { granted: Vec::new() }
    }

    /// Adds a capability to the granted set. Called only by the user-grant path.
    pub fn grant(&mut self, capability: Capability) {
        self.granted.push(capability);
    }

    /// Checks whether the granted set permits a concrete runtime request.
    /// Returns Denied unless an explicitly granted capability permits it.
    pub fn check(&self, request: &CapabilityRequest) -> Decision {
        if self.granted.iter().any(|c| permits(c, request)) {
            Decision::Allowed
        } else {
            Decision::Denied
        }
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}
