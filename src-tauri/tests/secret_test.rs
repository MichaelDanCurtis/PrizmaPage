use prizmapage::secret::{InMemorySecretStore, SecretStore};

#[tokio::test]
async fn store_and_retrieve_a_secret() {
    let store = InMemorySecretStore::new();
    store.set("openai", "sk-test-123").await.unwrap();
    let got = store.get("openai").await.unwrap();
    assert_eq!(got.as_deref(), Some("sk-test-123"));
}

#[tokio::test]
async fn get_returns_none_when_no_secret_stored() {
    let store = InMemorySecretStore::new();
    let got = store.get("never-set").await.unwrap();
    assert!(got.is_none());
}

#[tokio::test]
async fn delete_removes_a_secret() {
    let store = InMemorySecretStore::new();
    store.set("openai", "sk-test-123").await.unwrap();
    store.delete("openai").await.unwrap();
    let got = store.get("openai").await.unwrap();
    assert!(got.is_none());
}

#[tokio::test]
async fn set_overwrites_an_existing_secret() {
    let store = InMemorySecretStore::new();
    store.set("openai", "old").await.unwrap();
    store.set("openai", "new").await.unwrap();
    let got = store.get("openai").await.unwrap();
    assert_eq!(got.as_deref(), Some("new"));
}
