use std::io::Write;

use serde::{Deserialize, Serialize};
use tauri::Manager;

const TOKEN_URL: &str = "https://platform.ai.gloo.com/oauth2/token";
const COMPLETIONS_URL: &str = "https://platform.ai.gloo.com/ai/v2/chat/completions";
const SYSTEM_PROMPT: &str = include_str!("gloo_prompt.txt");
const EXPLORE_PROMPT: &str = include_str!("explore_prompt.txt");
const TOPIC_PROMPT: &str = include_str!("topic_prompt.txt");
// gloo_prompt.txt is gitignored, so a fresh clone has no copy of it. An empty file compiles
// without complaint and fails much later as a JSON parse error, which looks like a Gloo outage.
const _: () = assert!(!SYSTEM_PROMPT.is_empty());
const _: () = assert!(!EXPLORE_PROMPT.is_empty());
const _: () = assert!(!TOPIC_PROMPT.is_empty());

// the reader picks one of these from a button, so no free text ever reaches the model
// each id is described in explore_prompt.txt and validate rejects anything else
const ASPECTS: &[&str] = &["setting", "people", "around", "author", "custom"];

// the subjects the reader can ask to read about, same rule as ASPECTS
// the model is sent these ids and never the labels printed on the buttons
// mirrored in src/lib/topics/topics.ts, so a new subject is added in both places
const TOPICS: &[&str] = &[
    "forgiveness",
    "gratitude",
    "prayer",
    "wisdom",
    "humility",
    "obedience",
    "generosity",
    "perseverance",
    "temptation",
    "doubt",
    "suffering",
    "purpose",
];

// the words on the feeling buttons, and the one list here that is labels rather than ids,
// because gloo_prompt.txt is written around the word a reader actually picked
// mirrored in src/lib/feelings/feelings.ts, so renaming a button is a change in both places
const FEELINGS: &[&str] = &[
    "Anxious",
    "Weary",
    "Discouraged",
    "Overwhelmed",
    "Restless",
    "Unmotivated",
    "Lonely",
    "Distant",
    "Afraid",
    "Angry",
    "Unforgiving",
    "Grieving",
];

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
/// `note` is AI-authored, and the authored system prompt bounds it.
///
/// Shared by `ask_gloo` and `ask_topic`, so widening it widens both.
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

/// How much one reference may pull, chosen by the caller.
///
/// A reference bound for His bubble is a line to sit with. One on the topics list is something to
/// sit down and read, and the best answers there are whole parables. The prodigal son is 22 verses.
const MAX_SPAN: u32 = 12;
const TOPIC_SPAN: u32 = 30;

fn is_number(part: &str) -> bool {
    !part.is_empty() && part.len() <= 3 && part.chars().all(|c| c.is_ascii_digit())
}

/// Where the rule on `Guidance` is enforced, and how long a reference is, in one pass.
///
/// A reference has to be plain USFM: a three-character book code, the chapter, then a verse or a
/// range inside that chapter. `None` means it is not one, and `validate` then rejects the whole
/// answer. That is what stops the model from putting prose in a field the app renders as a citation.
///
/// Length is deliberately a separate question, answered by the count rather than refused here.
/// See `keep_valid` for why the two are worth telling apart.
fn verses_in(reference: &str) -> Option<u32> {
    let parts: Vec<&str> = reference.split('.').collect();
    if parts.len() != 3 || parts[0].len() != 3 {
        return None;
    }
    if !parts[0].chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
        return None;
    }
    if !is_number(parts[1]) {
        return None;
    }

    // a single verse, or a range inside one chapter, e.g. "16" or "16-18"
    let (first, last) = parts[2].split_once('-').unwrap_or((parts[2], parts[2]));
    if !is_number(first) || !is_number(last) {
        return None;
    }
    let (a, b) = (first.parse::<u32>().ok()?, last.parse::<u32>().ok()?);
    if b < a {
        return None;
    }
    Some(b - a + 1)
}

/// Two different failures, kept apart on purpose.
///
/// A reference that is not USFM means the model stopped honouring the contract, so nothing in the
/// answer can be trusted and the caller throws all of it away. One that is merely longer than this
/// surface wants is dropped on its own, leaving a good answer with a passage missing.
///
/// Measured July 31: a single 22-verse reference cost three valid ones.
fn keep_valid(references: &[String], max_span: u32) -> Result<Vec<String>, String> {
    let mut kept = Vec::new();
    for reference in references {
        let Some(verses) = verses_in(reference) else {
            return Err(format!("reference {reference:?} is not plain USFM"));
        };
        if verses <= max_span {
            kept.push(reference.clone());
        }
    }
    Ok(kept)
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

// the survivors replace what was sent, so a dropped reference never reaches the app
fn validate(guidance: &mut Guidance, max_span: u32) -> Result<(), String> {
    if guidance.references.is_empty() || guidance.references.len() > 6 {
        return Err(format!("expected 1-6 references, got {}", guidance.references.len()));
    }

    let kept = keep_valid(&guidance.references, max_span)?;
    // a note with no passage beside it is the app speaking on its own
    if kept.is_empty() {
        return Err(format!("every reference ran past {max_span} verses"));
    }
    guidance.references = kept;

    check_prose(&guidance.note, "note")
}

/// Background on one passage, for one authored question about it.
///
/// This is the only place a model writes *about* scripture rather than pointing at it, so the
/// sentence cap is enforced here and the app labels it as AI-written wherever it renders.
///
/// `sources` are ids from the allowlist the frontend sends, never names the model invented. That
/// is `verses_in` for sources: the model chooses which of your sources to point at, and everything
/// the reader then reads about the period comes from the source rather than from a model.
#[derive(Serialize, Deserialize)]
pub struct Insight {
    detail: String,
    references: Vec<String>,
    sources: Vec<String>,
}

fn validate_insight(insight: &mut Insight, allowed: &[String]) -> Result<(), String> {
    check_prose(&insight.detail, "detail")?;
    // related passages are a bonus rather than the answer, so none is a valid reply
    // dropping an over-long one can empty the list without that being a failure
    if insight.references.len() > 6 {
        return Err(format!("expected at most 6 references, got {}", insight.references.len()));
    }
    insight.references = keep_valid(&insight.references, MAX_SPAN)?;

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
    // the same gate ask_topic and ask_passage put on their input, so all three commands
    // refuse anything the buttons could not have produced rather than trusting the caller
    if feelings.is_empty() || feelings.len() > FEELINGS.len() {
        return Err(format!("expected 1-{} feelings, got {}", FEELINGS.len(), feelings.len()));
    }
    for feeling in &feelings {
        if !FEELINGS.contains(&feeling.as_str()) {
            return Err(format!("feeling {feeling:?} is not one of the authored words"));
        }
    }

    let user = format!("You received: {}", feelings.join(", "));
    let answer = complete(&app, &feelings, SYSTEM_PROMPT, user, tradition).await?;
    let mut guidance: Guidance = parse(&app, &feelings, &answer)?;

    // a feelings reference lands in His bubble, so it keeps the tighter span
    if let Err(e) = validate(&mut guidance, MAX_SPAN) {
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

/// Passages to read on a subject the reader picked from buttons.
///
/// Every id is checked against `TOPICS` before anything is sent, the same way `ask_passage` checks
/// its aspect.
///
/// The model is sent the ids rather than the words on the buttons, so rewording a button never
/// changes what is asked for.
#[tauri::command]
pub async fn ask_topic(
    app: tauri::AppHandle,
    topics: Vec<String>,
    tradition: Option<String>,
) -> Result<Guidance, String> {
    if topics.is_empty() || topics.len() > TOPICS.len() {
        return Err(format!("expected 1-{} subjects, got {}", TOPICS.len(), topics.len()));
    }
    for topic in &topics {
        if !TOPICS.contains(&topic.as_str()) {
            return Err(format!("subject {topic:?} is not one of the authored subjects"));
        }
    }

    let user = format!("subjects: {}", topics.join(", "));
    let answer = complete(&app, &topics, TOPIC_PROMPT, user, tradition).await?;
    let mut guidance: Guidance = parse(&app, &topics, &answer)?;

    // a topic reference is something to sit down and read, so whole parables are in bounds
    if let Err(e) = validate(&mut guidance, TOPIC_SPAN) {
        // the whole answer is kept because validate rejects it for one bad field
        log_exchange(&app, &topics, "REJECTED validate", &format!(
            "reason: {e}\n{}\nnote: {}\nrefs: {}\nraw:\n{}",
            answer.stats, guidance.note, guidance.references.join(", "), answer.cleaned,
        ));
        return Err(format!("{e}\nraw: {}", answer.cleaned));
    }

    log_exchange(&app, &topics, "OK topic", &format!(
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
    let Some(verses) = verses_in(&reference) else {
        return Err(format!("reference {reference:?} is not plain USFM"));
    };
    if verses > MAX_SPAN {
        return Err(format!("reference {reference:?} covers {verses} verses, over the {MAX_SPAN} allowed"));
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
    let mut insight: Insight = parse(&app, &subject, &answer)?;

    if let Err(e) = validate_insight(&mut insight, &sources) {
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
