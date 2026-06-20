use prizmapage::provider::{CompletionRequest, OpenAiCompatibleProvider, Provider, ProviderError};
use prizmapage::secret::{InMemorySecretStore, SecretStore};

#[tokio::test]
async fn completes_a_prompt_against_an_openai_compatible_endpoint() {
    let server = httpmock::MockServer::start();
    let secret = InMemorySecretStore::new();
    secret.set("openai", "sk-test").await.unwrap();

    let mock = server.mock(|when, then| {
        when.method(httpmock::Method::POST)
            .path("/v1/chat/completions")
            .header("authorization", "Bearer sk-test");
        then.status(200)
            .header("content-type", "application/json")
            .json_body(serde_json::json!({
                "choices": [{
                    "message": { "role": "assistant", "content": "Hello back!" }
                }]
            }));
    });

    let provider = OpenAiCompatibleProvider::new("openai", &server.base_url());
    let resp = provider
        .complete(
            &secret,
            &CompletionRequest {
                model: "gpt-test".into(),
                messages: vec![("user".into(), "Hello".into())],
            },
        )
        .await
        .unwrap();

    mock.assert();
    assert_eq!(resp.text, "Hello back!");
}

#[tokio::test]
async fn returns_error_when_no_api_key_configured() {
    let secret = InMemorySecretStore::new(); // no key set
    let provider = OpenAiCompatibleProvider::new("openai", "http://unused.example");
    let result = provider
        .complete(
            &secret,
            &CompletionRequest {
                model: "gpt-test".into(),
                messages: vec![("user".into(), "Hello".into())],
            },
        )
        .await;
    assert!(matches!(result, Err(ProviderError::NotConfigured(_))));
}

#[tokio::test]
async fn surfaces_http_error_status() {
    let server = httpmock::MockServer::start();
    let secret = InMemorySecretStore::new();
    secret.set("openai", "sk-test").await.unwrap();

    server.mock(|when, then| {
        when.method(httpmock::Method::POST)
            .path("/v1/chat/completions");
        then.status(401).json_body(serde_json::json!({
            "error": { "message": "invalid api key" }
        }));
    });

    let provider = OpenAiCompatibleProvider::new("openai", &server.base_url());
    let result = provider
        .complete(
            &secret,
            &CompletionRequest {
                model: "gpt-test".into(),
                messages: vec![("user".into(), "Hello".into())],
            },
        )
        .await;
    assert!(matches!(result, Err(ProviderError::Upstream(_))));
}
