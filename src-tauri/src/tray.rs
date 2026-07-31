use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::SAVIOR;

const COMPANION: &str = "companion";

const STASH: &str = "Stash Jesus";
const UNSTASH: &str = "Unstash Jesus";
const OPEN_COMPANION: &str = "Open the companion";

#[derive(Default)]
pub struct Tray {
    stash: Mutex<Option<MenuItem<Wry>>>,
}

/// His window owns its mode so the label follows the window rather than the click.
/// A drag into the corner stashes Him without the tray ever being touched.
#[tauri::command]
pub fn set_savior_mode(tray: tauri::State<'_, Tray>, mode: String) {
    let Ok(slot) = tray.stash.lock() else { return };
    let Some(item) = slot.as_ref() else { return };

    let _ = item.set_text(if mode == "stashed" { UNSTASH } else { STASH });
    // stashing mid-sitting would end it so the toggle stands down instead
    let _ = item.set_enabled(mode != "praying");
}

fn show_companion(app: &AppHandle) {
    let Some(window) = app.get_webview_window(COMPANION) else { return };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

/// Closing the companion hides it so the tray brings back the same window with
/// its state instead of reloading the route from scratch.
pub fn keep_companion_alive(app: &AppHandle) {
    let Some(window) = app.get_webview_window(COMPANION) else { return };
    let hidden = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = hidden.hide();
        }
    });
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let companion = MenuItem::with_id(app, "companion", OPEN_COMPANION, true, None::<&str>)?;
    let stash = MenuItem::with_id(app, "stash", STASH, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&companion, &stash, &quit])?;

    if let Ok(mut slot) = app.state::<Tray>().stash.lock() {
        *slot = Some(stash.clone());
    }

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Desktop Savior")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "companion" => show_companion(app),
            // His window decides what stashing means and this only asks
            "stash" => {
                let _ = app.emit_to(SAVIOR, "toggle-stash", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}
