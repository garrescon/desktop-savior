use serde::{Deserialize, Serialize};

const TOKEN_URL: &str = "https://platform.ai.gloo.com/oauth2/token";
const COMPLETIONS_URL: &str = "https://platform.ai.gloo.com/ai/v2/chat/completions";
const SYSTEM_PROMPT: &str = include_str!("gloo_prompt.txt");

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

#[derive(Serialize, Deserialize)]
pub struct Guidance {
    references: Vec<String>,
    note: String,
}

async fn fetch_token(client: &reqwest::Client) -> Result<String, String> {
    let id = std::env::var("GLOO_CLIENT_ID")
        .map_err(|_| "GLOO_CLIENT_ID is not set".to_string())?;
    let secret = std::env::var("GLOO_CLIENT_SECRET")
        .map_err(|_| "GLOO_CLIENT_SECRET is not set".to_string())?;

    let response = client
        .post(TOKEN_URL)
        .basic_auth(id, Some(secret))
        .form(&[("grant_type", "client_credentials"), ("scope", "api/access")])
        .send()
        .await
        .map_err(|e| format!("token request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("token endpoint answered {}", response.status()));
    }

    let token: TokenResponse = response
        .json()
        .await
        .map_err(|e| format!("unexpected token response shape: {e}"))?;

    Ok(token.access_token)
}

fn is_usfm(reference: &str) -> bool {
    let parts: Vec<&str> = reference.split('.').collect();
    parts.len() == 3
        && parts[0].len() == 3
        && parts[0].chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        && !parts[1].is_empty() && parts[1].chars().all(|c| c.is_ascii_digit())
        && !parts[2].is_empty() && parts[2].chars().all(|c| c.is_ascii_digit())
}

fn validate(guidance: &Guidance) -> Result<(), String> {
    if guidance.references.is_empty() || guidance.references.len() > 6 {
        return Err(format!("expected 1-6 references, got {}", guidance.references.len()));
    }
    if guidance.note.trim().is_empty() {
        return Err("note is empty".to_string());
    }
    for reference in &guidance.references {
        if !is_usfm(reference) {
            return Err(format!("reference {reference:?} is not plain USFM"));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn ask_gloo(feelings: Vec<String>) -> Result<Guidance, String> {
    let client = reqwest::Client::new();
    let token = fetch_token(&client).await?;

    let body = serde_json::json!({
        "model": "gloo-google-gemma-4-31b",
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": format!("You received: {}", feelings.join(", ")) },
        ],
        "temperature": 0.4,
        "max_tokens": 500,
    });

    let response = client
        .post(COMPLETIONS_URL)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("completions request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("completions endpoint answered {}", response.status()));
    }

    let chat: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("unexpected completions shape: {e}"))?;

    let text = chat
        .choices
        .first()
        .map(|c| c.message.content.as_str())
        .ok_or("completions returned no choices".to_string())?;

    // cleans markdown-wrapped json
    let cleaned = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let guidance: Guidance = serde_json::from_str(cleaned)
        .map_err(|e| format!("model broke the JSON contract: {e}"))?;

    validate(&guidance)?;
    Ok(guidance)
}