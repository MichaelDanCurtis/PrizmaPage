//! Secret storage abstraction.
//!
//! Document code never touches secrets directly — it requests `ai` capabilities
//! through the bridge, and the Rust core holds provider credentials in a
//! SecretStore. The trait makes the store testable without an OS keychain;
//! `InMemorySecretStore` is for tests, `KeyringSecretStore` is the production
//! backing (macOS Keychain / Windows Credential Manager / Linux Secret Service).

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Mutex;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SecretError {
    #[error("backend error: {0}")]
    Backend(String),
}

/// Stores provider credentials keyed by provider name (e.g. "openai", "copilot").
/// Implementations must guard secrets in memory and never log them.
#[async_trait]
pub trait SecretStore: Send + Sync {
    async fn set(&self, provider: &str, secret: &str) -> Result<(), SecretError>;
    async fn get(&self, provider: &str) -> Result<Option<String>, SecretError>;
    async fn delete(&self, provider: &str) -> Result<(), SecretError>;
}

/// Test-only store. Not for production: secrets live in process memory.
pub struct InMemorySecretStore {
    map: Mutex<HashMap<String, String>>,
}

impl InMemorySecretStore {
    pub fn new() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for InMemorySecretStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl SecretStore for InMemorySecretStore {
    async fn set(&self, provider: &str, secret: &str) -> Result<(), SecretError> {
        self.map
            .lock()
            .map_err(|e| SecretError::Backend(e.to_string()))?
            .insert(provider.to_string(), secret.to_string());
        Ok(())
    }

    async fn get(&self, provider: &str) -> Result<Option<String>, SecretError> {
        Ok(self
            .map
            .lock()
            .map_err(|e| SecretError::Backend(e.to_string()))?
            .get(provider)
            .cloned())
    }

    async fn delete(&self, provider: &str) -> Result<(), SecretError> {
        self.map
            .lock()
            .map_err(|e| SecretError::Backend(e.to_string()))?
            .remove(provider);
        Ok(())
    }
}

/// OS keychain-backed store. Service name scopes all PrizmaPage secrets together;
/// the provider name is the per-entry account/key.
pub struct KeyringSecretStore {
    service: String,
}

impl KeyringSecretStore {
    pub fn new(service: &str) -> Self {
        Self {
            service: service.to_string(),
        }
    }
}

#[async_trait]
impl SecretStore for KeyringSecretStore {
    async fn set(&self, provider: &str, secret: &str) -> Result<(), SecretError> {
        let entry = keyring::Entry::new(&self.service, provider)
            .map_err(|e| SecretError::Backend(e.to_string()))?;
        entry
            .set_password(secret)
            .map_err(|e| SecretError::Backend(e.to_string()))
    }

    async fn get(&self, provider: &str) -> Result<Option<String>, SecretError> {
        let entry = keyring::Entry::new(&self.service, provider)
            .map_err(|e| SecretError::Backend(e.to_string()))?;
        match entry.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(SecretError::Backend(e.to_string())),
        }
    }

    async fn delete(&self, provider: &str) -> Result<(), SecretError> {
        let entry = keyring::Entry::new(&self.service, provider)
            .map_err(|e| SecretError::Backend(e.to_string()))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(SecretError::Backend(e.to_string())),
        }
    }
}
