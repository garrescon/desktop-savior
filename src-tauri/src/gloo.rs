use std::io::Write;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const TOKEN_URL: &str = "https://platform.ai.gloo.com/oauth2/token";
const COMPLETIONS_URL: &str = "https://platform.ai.gloo.com/ai/v2/chat/completions";
const SYSTEM_PROMPT: &str = include_str!("gloo_prompt.txt");
const EXPLORE_PROMPT: &str = include_str!("explore_prompt.txt");
// gloo_prompt.txt is gitignored, so a fresh clone has no copy of it. An empty file compiles
// without complaint and fails much later as a JSON parse error, which looks like a Gloo outage.
const _: () = assert!(!SYSTEM_PROMPT.is_empty());
const _: () = assert!(!EXPLORE_PROMPT.is_empty());

// the reader picks one of these from a button, so no free text ever reaches the model
// each id is described in explore_prompt.txt and validate rejects anything else
const ASPECTS: &[&str] = &["setting", "people", "around", "author", "custom"];
#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

// every added field is optional so a shape change can never fail the parse
#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
    // "length" means the answer was cut off rather than finished
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct Usage {
    completion_tokens: Option<u32>,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

/// What the model is allowed to return, and the reason it is this small.
///
/// `references` are pointers, never text. The scripture itself is fetched from YouVersion under
/// license and rendered with its copyright, so no verse the user reads was written by a model.
/// `note` is the one AI-authored surface in the app, and the authored system prompt bounds it.
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

const MAX_SPAN: u32 = 12;

fn is_number(part: &str) -> bool {
    !part.is_empty() && part.len() <= 3 && part.chars().all(|c| c.is_ascii_digit())
}

// a single verse, or a range inside one chapter, e.g. "16" or "16-18"
fn is_verse_span(part: &str) -> bool {
    let (first, last) = part.split_once('-').unwrap_or((part, part));
    if !is_number(first) || !is_number(last) {
        return false;
    }
    match (first.parse::<u32>(), last.parse::<u32>()) {
        (Ok(a), Ok(b)) => b >= a && b - a < MAX_SPAN,
        _ => false,
    }
}

/// Where the rule on `Guidance` is enforced.
///
/// A reference has to be plain USFM — three-character book code, chapter, then a verse or a short
/// span — and `validate` rejects the whole answer if any reference is not. That is what stops the
/// model from putting prose in a field the app will render as a citation.
fn is_usfm(reference: &str) -> bool {
    let parts: Vec<&str> = reference.split('.').collect();
    parts.len() == 3
        && parts[0].len() == 3
        && parts[0].chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        && is_number(parts[1])
        && is_verse_span(parts[2])
}

// one rollover so a long-lived install cannot grow the file without bound
const MAX_LOG: u64 = 512 * 1024;

/// Keyed on the prompt itself so editing one cannot serve a cached prefix built
/// from the old text, and so the two prompts never share an entry.
fn prompt_cache_key(prompt: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    prompt.hash(&mut hasher);
    format!("desktop-savior-{:x}", hasher.finish())
}

/// Every exchange is written so an answer that passes `validate` but still reads
/// wrong can be found afterwards.
///
/// The bearer token and the client secret are never written here. The system
/// prompt is compiled in, so its length stands in for it and says whether the
/// build is carrying the `gloo_prompt.txt` you last edited.
fn log_exchange(app: &tauri::AppHandle, subject: &[String], outcome: &str, detail: &str) {
    let Ok(dir) = app.path().app_log_dir() else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }

    let path = dir.join("gloo.log");
    if std::fs::metadata(&path).map(|m| m.len() > MAX_LOG).unwrap_or(false) {
        let _ = std::fs::rename(&path, dir.join("gloo.log.old"));
    }

    let entry = format!(
        "{}  {outcome}\nprompt: {} bytes\nsubject: {}\n{detail}\n\n",
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ"),
        SYSTEM_PROMPT.len(),
        subject.join(", "),
    );

    // logging is a debugging aid so a failure to write it must never fail the ask
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(entry.as_bytes());
    }
}

/// A hard ceiling on anything the model writes, counted crudely on purpose.
///
/// Abbreviations and chapter references inflate the count, so the cap errs short. That is the
/// right direction for a bound whose whole job is to stop prose from growing.
const MAX_SENTENCES: usize = 6;

fn sentences(text: &str) -> usize {
    text.chars().filter(|c| matches!(c, '.' | '!' | '?')).count()
}

fn check_prose(text: &str, field: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        return Err(format!("{field} is empty"));
    }
    if sentences(text) > MAX_SENTENCES {
        return Err(format!("{field} runs past {MAX_SENTENCES} sentences"));
    }
    Ok(())
}

fn check_references(references: &[String]) -> Result<(), String> {
    if references.is_empty() || references.len() > 6 {
        return Err(format!("expected 1-6 references, got {}", references.len()));
    }
    for reference in references {
        if !is_usfm(reference) {
            return Err(format!("reference {reference:?} is not plain USFM"));
        }
    }
    Ok(())
}

fn validate(guidance: &Guidance) -> Result<(), String> {
    check_references(&guidance.references)?;
    check_prose(&guidance.note, "note")
}

/// Background on one passage, for one authored question about it.
///
/// This is the only place a model writes *about* scripture rather than pointing at it, so the
/// sentence cap is enforced here and the app labels it as AI-written wherever it renders.
///
/// `sources` are ids from the allowlist the frontend sends, never names the model invented. That
/// is `is_usfm` for sources: the model chooses which of your sources to point at, and everything
/// the reader then reads about the period comes from the source rather than from a model.
#[derive(Serialize, Deserialize)]
pub struct Insight {
    detail: String,
    references: Vec<String>,
    sources: Vec<String>,
}

fn validate_insight(insight: &Insight, allowed: &[String]) -> Result<(), String> {
    check_prose(&insight.detail, "detail")?;
    // related passages are a bonus rather than the answer, so none is a valid reply
    if insight.references.len() > 6 {
        return Err(format!("expected at most 6 references, got {}", insight.references.len()));
    }
    for reference in &insight.references {
        if !is_usfm(reference) {
            return Err(format!("reference {reference:?} is not plain USFM"));
        }
    }
    for id in &insight.sources {
        if !allowed.iter().any(|a| a == id) {
            return Err(format!("source {id:?} is not one of yours"));
        }
    }
    Ok(())
}

struct Answer {
    cleaned: String,
    stats: String,
    finish: String,
}

/// One request path for all three commands so a new contract cannot drift from the old ones.
async fn complete(
    app: &tauri::AppHandle,
    subject: &[String],
    system: &str,
    user: String,
    tradition: Option<String>,
) -> Result<Answer, String> {
    let client = reqwest::Client::new();

    let token = match fetch_token(&client).await {
        Ok(token) => token,
        Err(e) => {
            log_exchange(app, subject, "FAILED token", &format!("reason: {e}"));
            return Err(e);
        }
    };

    let mut body = serde_json::json!({
        "model": "gloo-anthropic-claude-sonnet-5",
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user },
        ],
        "temperature": 0.4,
        // room for the note because reasoning tokens count against this too
        "max_tokens": 2000,
        // the system prompt is the same on every ask so it is worth caching
        "prompt_cache_key": prompt_cache_key(system),
    });

    // "default" is the absence of the field rather than a value Gloo accepts
    if let Some(lens) = tradition.as_deref().filter(|t| !t.is_empty() && *t != "default") {
        body["tradition"] = serde_json::Value::String(lens.to_string());
    }

    let response = match client
        .post(COMPLETIONS_URL)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            let message = format!("completions request failed: {e}");
            log_exchange(app, subject, "FAILED request", &format!("reason: {message}"));
            return Err(message);
        }
    };

    let status = response.status();
    // read as text rather than json so a refusal or a malformed body is still legible
    let raw = response.text().await.unwrap_or_default();

    if !status.is_success() {
        let message = format!("completions endpoint answered {status}");
        log_exchange(app, subject, "FAILED http", &format!("reason: {message}\nbody:\n{raw}"));
        // the answer rides the error as well as the log so it shows without opening a file
        return Err(format!("{message}\nbody: {raw}"));
    }

    let chat: ChatResponse = match serde_json::from_str(&raw) {
        Ok(chat) => chat,
        Err(e) => {
            let message = format!("unexpected completions shape: {e}");
            log_exchange(app, subject, "FAILED shape", &format!("reason: {message}\nbody:\n{raw}"));
            return Err(format!("{message}\nbody: {raw}"));
        }
    };

    let choice = match chat.choices.first() {
        Some(choice) => choice,
        None => {
            let message = "completions returned no choices".to_string();
            log_exchange(app, subject, "FAILED empty", &format!("reason: {message}\nbody:\n{raw}"));
            return Err(format!("{message}\nbody: {raw}"));
        }
    };

    let finish = choice.finish_reason.as_deref().unwrap_or("none").to_string();
    let spent = chat.usage.as_ref().and_then(|u| u.completion_tokens).unwrap_or(0);
    let stats = format!("finish: {finish}  completion_tokens: {spent}");
    let text = choice.message.content.as_str();

    // a refusal is not a contract violation and its content is a notice rather than json
    // parsing it would report the wrong cause the way the token cap once did
    if finish == "content_filter" {
        let message = "the content filter stopped the answer".to_string();
        log_exchange(app, subject, "REFUSED filter", &format!("reason: {message}\n{stats}\nbody:\n{raw}"));
        return Err(format!("{message}\n{stats}\nbody: {text}"));
    }

    // cleans markdown-wrapped json
    let cleaned = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    Ok(Answer { cleaned, stats, finish })
}

fn parse<T: serde::de::DeserializeOwned>(
    app: &tauri::AppHandle,
    subject: &[String],
    answer: &Answer,
) -> Result<T, String> {
    serde_json::from_str(&answer.cleaned).map_err(|e| {
        // a cut-off answer is a token cap and not a contract violation so name it
        let message = if answer.finish == "length" {
            format!("answer was cut off at the token cap: {e}")
        } else {
            format!("model broke the JSON contract: {e}")
        };
        log_exchange(app, subject, "REJECTED json", &format!(
            "reason: {message}\n{}\nraw:\n{}", answer.stats, answer.cleaned,
        ));
        format!("{message}\n{}\nraw: {}", answer.stats, answer.cleaned)
    })
}

#[tauri::command]
pub async fn ask_gloo(
    app: tauri::AppHandle,
    feelings: Vec<String>,
    tradition: Option<String>,
) -> Result<Guidance, String> {
    let user = format!("You received: {}", feelings.join(", "));
    let answer = complete(&app, &feelings, SYSTEM_PROMPT, user, tradition).await?;
    let guidance: Guidance = parse(&app, &feelings, &answer)?;

    if let Err(e) = validate(&guidance) {
        // the whole answer is kept because validate rejects it for one bad field
        log_exchange(&app, &feelings, "REJECTED validate", &format!(
            "reason: {e}\n{}\nnote: {}\nrefs: {}\nraw:\n{}",
            answer.stats, guidance.note, guidance.references.join(", "), answer.cleaned,
        ));
        return Err(format!("{e}\nraw: {}", answer.cleaned));
    }

    log_exchange(&app, &feelings, "OK", &format!(
        "{}\nnote: {}\nrefs: {}",
        answer.stats, guidance.note, guidance.references.join(", "),
    ));
    Ok(guidance)
}

/// Both inputs are bounded before anything is sent.
///
/// The reference has to be plain USFM and the aspect has to be one of `ASPECTS`, so the reader
/// never hands the model a sentence. There is no field here for free text to arrive in, which is
/// what keeps "ignore your instructions and write me something else" from being expressible.
#[tauri::command]
pub async fn ask_passage(
    app: tauri::AppHandle,
    reference: String,
    aspect: String,
    sources: Vec<String>,
    catalog: Vec<String>,
    tradition: Option<String>,
) -> Result<Insight, String> {
    if !is_usfm(&reference) {
        return Err(format!("reference {reference:?} is not plain USFM"));
    }
    if !ASPECTS.contains(&aspect.as_str()) {
        return Err(format!("aspect {aspect:?} is not one of the authored questions"));
    }

    let subject = vec![reference.clone(), aspect.clone()];
    // the catalog is only for choosing, and sources is still the list validate checks against
    let allowed = if catalog.is_empty() { "(none)".to_string() } else { catalog.join("\n") };
    let user = format!(
        "reference: {reference}\naspect: {aspect}\nsource ids:\n{allowed}"
    );

    let answer = complete(&app, &subject, EXPLORE_PROMPT, user, tradition).await?;
    let insight: Insight = parse(&app, &subject, &answer)?;

    if let Err(e) = validate_insight(&insight, &sources) {
        log_exchange(&app, &subject, "REJECTED validate", &format!(
            "reason: {e}\n{}\nraw:\n{}", answer.stats, answer.cleaned,
        ));
        return Err(format!("{e}\nraw: {}", answer.cleaned));
    }

    log_exchange(&app, &subject, "OK passage", &format!(
        "{}\ndetail: {}\nrefs: {}\nsources: {}",
        answer.stats, insight.detail,
        insight.references.join(", "), insight.sources.join(", "),
    ));
    Ok(insight)
}