# Trusted-Source Signing — Design

> **Roadmap position:** Sub-project 3 of 7.
> **Architecture ref:** §9 Trusted-Source System; §4.4 reserved signature field.

## 1. Goal

Make the reserved `signature` field load-bearing. Authors sign their `.mdxz` packages with an Ed25519 keypair; recipients verify the signature at open time. A verified signature displays as a trust indicator in the viewer; a missing or invalid signature is shown neutrally (not blocked — signing is opt-in for v1).

This delivers the "worm brake" backbone: a signed document from a known author can be auto-trusted in a future phase; unsigned documents continue to go through the consent prompt.

## 2. Scope decisions (pragmatic for v1)

- **Ed25519** (not DKIM/RSA). Smaller signatures, faster, modern, well-supported via the `ed25519-dalek` Rust crate.
- **Author keypair stored locally** (in the OS keychain alongside API keys). The public key is embedded in the signature payload so recipients can verify without a directory lookup.
- **Signature covers the canonical form** of all three layers: `content.md` + `build/main.js` + `manifest.json` (minus the signature field itself), SHA-256 hashed then signed.
- **DNS-bound public keys** (the full DKIM-style trust model) are explicitly a *future* extension. This phase proves the sign/verify loop with local keys; the signature payload format is designed so a `domain` + `selector` can be added without breaking.

## 3. Signature payload format

The `signature` field is a base64-encoded JSON string (so it stays a single string field, no schema change):

```json
{
  "alg": "ed25519",
  "pubkey": "<base64 32-byte public key>",
  "sig": "<base64 64-byte signature over SHA256(canonical)",
  "keyid": "<short fingerprint of pubkey, hex, first 8 bytes>"
}
```

If `signature` is `null` → unsigned (the current default). If present but malformed → verification fails (shown as invalid). If present and valid → verified.

## 4. Commands (Rust)

- `signing_generate_keypair()` → returns `{ pubkey, keyid }`; stores the secret key in the keychain under `prizma.signing.<keyid>`.
- `signing_list_keys()` → returns the stored public keys (for the settings UI).
- `signing_sign(path, keyid)` → reads the package, canonicalizes, signs, writes the signature into the manifest, re-saves.
- `signing_verify(path)` → reads the package, returns `{ state: "unsigned" | "valid" | "invalid", keyid?, origin? }`.

## 5. UI

- **Settings → Signing tab** (new): generate a keypair, list existing keys, "Sign this document" button in the editor (signs on save when a key is selected).
- **Viewer trust footer**: shows ✓ Signed (keyid) / ⚠ Unsigned / ✗ Invalid signature — already has the reserved area in `TrustFooter`.

## 6. Testing

- Rust unit: canonicalize → sign → verify round-trip; tampered content → invalid; missing key → unsigned.
- Frontend: `signing_verify` result drives the TrustFooter label.
- Visual: sign a doc, reopen → footer shows signed; tamper → invalid.

## 7. Non-goals

- DNS/DNSSEC public-key publication.
- Key revocation / rotation UX.
- Auto-trust from verified signatures (still goes through consent for now).
- Signing the welcome doc (it's unsigned by design).
