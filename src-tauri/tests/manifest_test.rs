use prizmapage::manifest::{Capability, Manifest};

#[test]
fn parses_minimal_manifest_with_reserved_signature_field() {
    let json = r#"{
        "version": "0.1.0",
        "origin_domain": null,
        "capabilities": [],
        "signature": null
    }"#;
    let manifest: Manifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.version, "0.1.0");
    assert!(manifest.origin_domain.is_none());
    assert!(manifest.capabilities.is_empty());
    // The signature field MUST exist in the type even when null,
    // so the format never has to break to add signing later.
    assert!(manifest.signature.is_none());
}

#[test]
fn parses_manifest_with_domain_scoped_capability() {
    let json = r#"{
        "version": "0.1.0",
        "origin_domain": "acme.com",
        "capabilities": [
            {"category": "network", "scopes": ["github.com", "api.openai.com"]},
            {"category": "storage", "limit_bytes": 10485760}
        ],
        "signature": null
    }"#;
    let manifest: Manifest = serde_json::from_str(json).unwrap();
    assert_eq!(manifest.origin_domain.as_deref(), Some("acme.com"));
    assert_eq!(manifest.capabilities.len(), 2);
    match &manifest.capabilities[0] {
        Capability::Network { scopes } => {
            assert_eq!(scopes, &vec!["github.com".to_string(), "api.openai.com".to_string()]);
        }
        other => panic!("expected Network, got {:?}", other),
    }
    match &manifest.capabilities[1] {
        Capability::Storage { limit_bytes } => assert_eq!(*limit_bytes, 10_485_760),
        other => panic!("expected Storage, got {:?}", other),
    }
}
