// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use rand::RngExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, roll_dice, get_app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn roll_dice(sides: u32) -> u32 {
    rand::rng().random_range(1..=sides)
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}