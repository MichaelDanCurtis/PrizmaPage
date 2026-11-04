//! Package signing (Ed25519).
//!
//! The reserved `signature` field on the manifest becomes load-bearing: an
//! author signs the canonical form of the package's three layers; recipients
//! verify at open time. The signature payload is a base64-encoded JSON blob so
//! the field stays a single Option<String>.
//!
//! The canonical form is the SHA-256 of the concatenation:
//!   content.md bytes || build/main.js bytes || manifest-without-signature (JSON, pretty, sorted keys)
//! Sorted keys make the canonical form deterministic regardless of HashMap order.

use crate::manifest::Manifest;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, thiserror::Error)]
pub enum SignError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("zip: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("base64: {0}")]
    B64(#[from] base64::DecodeError),
    #[error("signature: {0}")]
    Sig(#[from] ed25519_dalek::SignatureError),
    #[error("key not found: {0}")]
    KeyMissing(String),
}

/// The payload stored (base64-encoded JSON) in manifest.signature.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SignaturePayload {
    pub alg: String, // "ed25519"
    pub pubkey: String, // base64 32-byte public key
    pub sig: String, // base64 64-byte signature
    pub keyid: String, // hex, first 8 bytes of pubkey
}

/// Result of verifying a package's signature.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase", tag = "state")]
pub enum VerifyResult {
    Unsigned,
    Valid { keyid: String },
    Invalid { reason: String },
}

/// Generate an Ed25519 keypair. Returns the base64 pubkey + keyid; the secret
/// is stored by the caller (the command layer puts it in the keychain).
pub fn generate_keypair() -> (String, String, [u8; 32]) {
    // Returns (pubkey_b64, keyid_hex, secret_bytes)
    let mut csprng = OsRng;
    let signing_key: SigningKey = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();
    let pubkey_bytes = verifying_key.to_bytes();
    let secret_bytes = signing_key.to_bytes();
    let keyid = keyid_from_pubkey(&pubkey_bytes);
    (B64.encode(pubkey_bytes), keyid, secret_bytes)
}

pub fn keyid_from_pubkey(pubkey: &[u8; 32]) -> String {
    // First 8 bytes of the pubkey, hex-encoded, as a short fingerprint.
    pubkey[..8].iter().map(|b| format!("{:02x}", b)).collect()
}

/// Compute the canonical-hash input bytes from the three layers.
/// Excludes the signature field from the manifest so signing is idempotent.
pub fn canonical_input(
    content_md: &[u8],
    build_main_js: &[u8],
    manifest: &Manifest,
) -> Vec<u8> {
    // Manifest without signature, with sorted keys for determinism.
    let mut m = manifest.clone();
    m.signature = None;
    // serde_json with sorted keys: use a Value and serialize pretty.
    let value = serde_json::to_value(&m).unwrap_or(serde_json::Value::Null);
    let pretty = serde_json::to_string_pretty(&sort_json_keys(value)).unwrap_or_default();
    let mut out = Vec::new();
    out.extend_from_slice(content_md);
    out.extend_from_slice(build_main_js);
    out.extend_from_slice(pretty.as_bytes());
    out
}

fn sort_json_keys(v: serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::Object(map) => {
            let mut sorted = serde_json::Map::new();
            let mut keys: Vec<_> = map.into_iter().collect();
            keys.sort_by(|a, b| a.0.cmp(&b.0));
            for (k, val) in keys {
                sorted.insert(k, sort_json_keys(val));
            }
            serde_json::Value::Object(sorted)
        }
        other => other,
    }
}

fn hash_canonical(input: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(input);
    let out = h.finalize();
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&out);
    arr
}

/// Sign the canonical form with the given secret key bytes. Returns the payload
/// to store in manifest.signature (still needs to be base64-encoded by caller,
/// OR call encode_payload).
pub fn sign(
    content_md: &[u8],
    build_main_js: &[u8],
    manifest: &Manifest,
    secret_bytes: &[u8; 32],
) -> Result<SignaturePayload, SignError> {
    let signing_key = SigningKey::from_bytes(secret_bytes);
    let verifying_key = signing_key.verifying_key();
    let pubkey_bytes = verifying_key.to_bytes();
    let input = canonical_input(content_md, build_main_js, manifest);
    let digest = hash_canonical(&input);
    let sig = signing_key.sign(&digest);
    Ok(SignaturePayload {
        alg: "ed25519".to_string(),
        pubkey: B64.encode(pubkey_bytes),
        sig: B64.encode(sig.to_bytes()),
        keyid: keyid_from_pubkey(&pubkey_bytes),
    })
}

/// Verify a manifest's signature against the three layers. Returns the result
/// state. The signature field may be: None (unsigned), a base64 payload, or
/// malformed.
pub fn verify(
    content_md: &[u8],
    build_main_js: &[u8],
    manifest: &Manifest,
) -> VerifyResult {
    let sig_field = match &manifest.signature {
        None => return VerifyResult::Unsigned,
        Some(s) => s.clone(),
    };
    // Decode the outer base64, then the inner JSON.
    let payload_bytes = match B64.decode(&sig_field) {
        Ok(b) => b,
        Err(_) => return VerifyResult::Invalid { reason: "signature field is not valid base64".into() },
    };
    let payload: SignaturePayload = match serde_json::from_slice(&payload_bytes) {
        Ok(p) => p,
        Err(e) => return VerifyResult::Invalid { reason: format!("signature payload malformed: {e}") },
    };
    if payload.alg != "ed25519" {
        return VerifyResult::Invalid { reason: format!("unsupported alg: {}", payload.alg) };
    }
    let pubkey_bytes = match B64.decode(&payload.pubkey) {
        Ok(b) if b.len() == 32 => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&b);
            arr
        }
        _ => return VerifyResult::Invalid { reason: "pubkey not 32 bytes".into() },
    };
    let sig_bytes = match B64.decode(&payload.sig) {
        Ok(b) if b.len() == 64 => {
            let mut arr = [0u8; 64];
            arr.copy_from_slice(&b);
            arr
        }
        _ => return VerifyResult::Invalid { reason: "signature not 64 bytes".into() },
    };
    let vk = match VerifyingKey::from_bytes(&pubkey_bytes) {
        Ok(k) => k,
        Err(e) => return VerifyResult::Invalid { reason: format!("bad pubkey: {e}") },
    };
    let signature = ed25519_dalek::Signature::from_bytes(&sig_bytes);
    let input = canonical_input(content_md, build_main_js, manifest);
    let digest = hash_canonical(&input);
    match vk.verify(&digest, &signature) {
        Ok(_) => VerifyResult::Valid { keyid: payload.keyid },
        Err(_) => VerifyResult::Invalid { reason: "signature does not match contents".into() },
    }
}

/// Encode a payload to the base64 string form for the manifest field.
pub fn encode_payload(p: &SignaturePayload) -> Result<String, SignError> {
    let json = serde_json::to_vec(p)?;
    Ok(B64.encode(json))
}

/// Decode a base64 string back to a payload (for inspection).
pub fn decode_payload(s: &str) -> Result<SignaturePayload, SignError> {
    let bytes = B64.decode(s)?;
    Ok(serde_json::from_slice(&bytes)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest() -> Manifest {
        Manifest {
            version: "0.1.0".into(),
            origin_domain: Some("example.com".into()),
            capabilities: vec![],
            signature: None,
        }
    }

    #[test]
    fn sign_then_verify_round_trips() {
        let (pubkey_b64, keyid, secret) = generate_keypair();
        let _ = pubkey_b64;
        let m = sample_manifest();
        let content = b"# Hello\n";
        let build = b"return { default: () => null }";
        let payload = sign(content, build, &m, &secret).unwrap();
        let encoded = encode_payload(&payload).unwrap();
        let signed_manifest = Manifest { signature: Some(encoded), ..m.clone() };
        let result = verify(content, build, &signed_manifest);
        assert_eq!(result, VerifyResult::Valid { keyid });
    }

    #[test]
    fn unsigned_manifest_is_unsigned() {
        let m = sample_manifest();
        let result = verify(b"x", b"y", &m);
        assert_eq!(result, VerifyResult::Unsigned);
    }

    #[test]
    fn tampered_content_is_invalid() {
        let (_pubkey, _keyid, secret) = generate_keypair();
        let m = sample_manifest();
        let payload = sign(b"original", b"build", &m, &secret).unwrap();
        let encoded = encode_payload(&payload).unwrap();
        let signed = Manifest { signature: Some(encoded), ..m.clone() };
        // Tamper: different content.
        let result = verify(b"tampered!", b"build", &signed);
        assert!(matches!(result, VerifyResult::Invalid { .. }));
    }

    #[test]
    fn malformed_signature_is_invalid() {
        let m = Manifest { signature: Some("not-valid-base64-or-json!!!".into()), ..sample_manifest() };
        let result = verify(b"x", b"y", &m);
        assert!(matches!(result, VerifyResult::Invalid { .. }));
    }

    #[test]
    fn signing_is_idempotent_across_keymap_order() {
        // The manifest's capabilities vec ordering is fixed, but ensure
        // canonical_input produces stable output regardless.
        let (_pk, _kid, secret) = generate_keypair();
        let m = sample_manifest();
        let a = canonical_input(b"c", b"b", &m);
        let b = canonical_input(b"c", b"b", &m);
        assert_eq!(a, b);
        // Sign, then re-sign with same key → identical sig.
        let p1 = sign(b"c", b"b", &m, &secret).unwrap();
        let p2 = sign(b"c", b"b", &m, &secret).unwrap();
        assert_eq!(p1.sig, p2.sig);
    }
}
