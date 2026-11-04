use prizmapage::capability::{CapabilityRequest, Decision};
use prizmapage::manifest::Capability;
use prizmapage::policy::PolicyEngine;

#[test]
fn engine_starts_at_zero_capabilities_and_denies_everything() {
    let engine = PolicyEngine::new();
    let req = CapabilityRequest::Network {
        host: "github.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Denied);
}

#[test]
fn granted_capability_allows_matching_request() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    let req = CapabilityRequest::Network {
        host: "github.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Allowed);
}

#[test]
fn granted_capability_denies_out_of_scope_request() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    let req = CapabilityRequest::Network {
        host: "evil.com".to_string(),
    };
    assert_eq!(engine.check(&req), Decision::Denied);
}

#[test]
fn granting_a_category_does_not_imply_other_categories() {
    let mut engine = PolicyEngine::new();
    engine.grant(Capability::Network {
        scopes: vec!["github.com".to_string()],
    });
    // Storage is a different category — granting network must not imply it.
    let req = CapabilityRequest::Storage { byte_count: 100 };
    assert_eq!(engine.check(&req), Decision::Denied);
}
