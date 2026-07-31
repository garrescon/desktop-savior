use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::SAVIOR;

const POLL: Duration = Duration::from_millis(80);

const STALE: Duration = Duration::from_secs(15);

// CSS pixels because the rects it pads are scaled at the comparison
const HYSTERESIS: f64 = 6.0;

/// Traces every transition in a dev build and nothing in a release one. A hand
/// flipped constant here would be one more thing to remember before the build.
const TRACE: bool = cfg!(debug_assertions);

/// Wall clock milliseconds wrapped to five digits so a trace line stays short.
fn stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() % 100_000)
        .unwrap_or(0);
    format!("{ms:05}")
}

/// A rectangle in the Savior window's own CSS pixels, top-left origin.
///
/// Deliberately *not* screen coordinates. The window moves every frame He walks,
/// and republishing on each of those would add an IPC crossing to a loop that
/// already spends about 1.4ms of every frame on one. The poll thread adds the
/// window's current position instead, in-process and free.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

struct Published {
    rects: Vec<Rect>,
    at: Instant,
}

pub struct Stage {
    published: Mutex<Published>,
}

impl Default for Stage {
    fn default() -> Self {
        Self {
            published: Mutex::new(Published {
                rects: Vec::new(),
                at: Instant::now(),
            }),
        }
    }
}

/// Called by the Savior window whenever what is clickable changes, plus a heartbeat.
#[tauri::command]
pub fn set_hit_rects(stage: tauri::State<'_, Stage>, rects: Vec<Rect>) {
    if let Ok(mut published) = stage.published.lock() {
        published.rects = rects;
        published.at = Instant::now();
    }
}

/// Whether the pointer is over anything clickable right now.
///
/// Returns `None` for every failure, and the caller reads that as "no" — this is
/// where the fail-open rule in the module docs actually lives.
fn pointer_is_held(app: &AppHandle, already_held: bool) -> Option<bool> {
    let window = app.get_webview_window(SAVIOR)?;

    // copied out so the lock is not held across the platform calls below
    let stage = app.state::<Stage>();
    let (rects, published_at) = {
        let published = stage.published.lock().ok()?;
        (published.rects.clone(), published.at)
    };

    if rects.is_empty() || published_at.elapsed() > STALE {
        return Some(false);
    }

    let origin = window.outer_position().ok()?;
    let scale = window.scale_factor().ok()?;
    let cursor = app.cursor_position().ok()?;

    let margin = if already_held { HYSTERESIS * scale } else { 0.0 };

    Some(rects.iter().any(|rect| {
        let left = f64::from(origin.x) + rect.x * scale - margin;
        let top = f64::from(origin.y) + rect.y * scale - margin;
        let right = left + rect.w * scale + margin * 2.0;
        let bottom = top + rect.h * scale + margin * 2.0;

        cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom
    }))
}

pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        // pass clicks through
        let mut held = false;
        if let Some(window) = app.get_webview_window(SAVIOR) {
            let _ = window.set_ignore_cursor_events(true);
        }

        loop {
            std::thread::sleep(POLL);

            let wants = pointer_is_held(&app, held).unwrap_or(false);
            if wants == held {
                continue;
            }

            let Some(window) = app.get_webview_window(SAVIOR) else {
                continue;
            };
            // only believe the flip if the toggle actually took
            if window.set_ignore_cursor_events(!wants).is_ok() {
                held = wants;
                if TRACE {
                    eprintln!(
                        "{} [stage] {}",
                        stamp(),
                        if held { "holding the pointer" } else { "passing clicks through" }
                    );
                }
            }
        }
    });
}
