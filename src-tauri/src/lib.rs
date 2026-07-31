mod gloo;
mod stage;
mod tray;

// the window He lives in
// the label stays "main" because that is what tauri.conf.json creates
pub const SAVIOR: &str = "main";


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    
    let from_exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(".env")))
        .and_then(|path| dotenvy::from_path(&path).ok());

    if from_exe_dir.is_none() {
        dotenvy::dotenv().ok();
    }

    tauri::Builder::default()
        // registered before setup, which is where the poll thread starts
        .manage(stage::Stage::default())
        .manage(tray::Tray::default())
        .setup(|app| {
            // the tray is the only way out of a click-through failure, so it is
            // built before the poll thread starts and never depends on it
            tray::build(app.handle())?;
            tray::keep_companion_alive(app.handle());

            stage::watch(app.handle().clone());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            debug_log,
            gloo::ask_gloo,
            gloo::ask_passage,
            stage::set_hit_rects,
            tray::set_savior_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Savior-window tracing, batched by dev.ts and printed where the dev server runs.
#[tauri::command]
fn debug_log(lines: Vec<String>) {
    for line in lines {
        eprintln!("[savior] {line}");
    }
}

