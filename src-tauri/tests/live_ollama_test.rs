//! LIVE integration test against a real local Ollama server.
//! Skips automatically if Ollama is not running on localhost:11434.
//! This is the live end-to-end proof for the API-key provider path that the
//! bring-your-own-credentials checklist calls "easiest" — no external account
//! or network egress required, just `ollama serve` + a pulled model.

use prizmapage::provider::{CompletionRequest, OpenAiCompatibleProvider, Provider};
use prizmapage::secret::{InMemorySecretStore, SecretStore};

async fn ollama_up() -> bool {
    // Quick TCP-style reachability check via reqwest.
    reqwest::Client::new()
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

#[tokio::test]
async fn live_ollama_completes_a_prompt_via_the_api_key_provider() {
    if !ollama_up().await {
        eprintln!("skipping live test — `ollama serve` not running on :11434");
        return;
    }

    let secret = InMemorySecretStore::new();
    // Ollama ignores the bearer token; any non-empty value works.
    secret.set("ollama", "ollama-no-auth-needed").await.unwrap();

    let provider = OpenAiCompatibleProvider::new("ollama", "http://localhost:11434");
    let resp = provider
        .complete(
            &secret,
            &CompletionRequest {
                model: "phi4-mini".into(),
                messages: vec![(
                    "user".into(),
                    "Reply with exactly the word: pong".into(),
                )],
            },
        )
        .await;

    match resp {
        Ok(r) => {
            // We don't assert on the exact wording (models vary), only that we
            // got a non-empty real response from a live model.
            assert!(
                !r.text.trim().is_empty(),
                "live Ollama returned an empty response"
            );
            println!("LIVE Ollama response: {}", r.text);
        }
        Err(e) => panic!("live Ollama completion failed: {e:?}"),
    }
}
