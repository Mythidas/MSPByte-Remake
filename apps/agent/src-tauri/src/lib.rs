mod device_manager;
mod device_registration;

use base64::engine::general_purpose;
use base64::Engine;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, EventTarget, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_screenshots::{get_monitor_screenshot, get_screenshotable_monitors};

use device_manager::{get_settings, is_device_registered};
use device_registration::register_device_with_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_screenshots::init())
        .setup(|app| {
            // Check and register device on first launch
            tauri::async_runtime::spawn(async move {
                if !is_device_registered().await {
                    println!("First launch detected, registering device...");

                    match register_device_with_server().await {
                        Ok(response) => {
                            println!("Device registered successfully");
                            println!("Device ID: {}", response.data.device_id);
                            println!("GUID: {}", response.data.guid);
                        }
                        Err(e) => {
                            eprintln!("Failed to register device: {}", e);
                            eprintln!("Will retry on next launch");
                        }
                    }
                } else {
                    println!("Device already registered");
                }
            });

            // Create the tray application
            let request_support_sc_i = MenuItem::with_id(
                app,
                "request_support_sc",
                "Take Screenshot and Request Support",
                true,
                None::<&str>,
            )?;
            let request_support_i = MenuItem::with_id(
                app,
                "request_support",
                "Request Support",
                true,
                None::<&str>,
            )?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // Create menu with items
            let menu =
                Menu::with_items(app, &[&request_support_sc_i, &request_support_i, &quit_i])?;

            // Build tray icon with menu
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "request_support_sc" => {
                        handle_support_window(app, true);
                    }
                    "request_support" => {
                        handle_support_window(app, false);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the app from quitting when this window is closed
                api.prevent_close();
                let _ = window.hide();
                let _ = window.emit_to(EventTarget::Any, "on_hide", "");
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings_info,
            check_registration_status,
            hide_window,
            read_file_text,
            read_file_base64,
            read_registry_value
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn create_support_window(app: &AppHandle) {
    WebviewWindowBuilder::new(app, "support", WebviewUrl::App("support.html".into()))
        .title("Support Request")
        .inner_size(1000.0, 800.0)
        .build()
        .expect("Failed to create support window");
}

fn handle_support_window(app: &AppHandle, screenshot: bool) {
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut screenshot_path: Option<PathBuf> = None;

        // Step 1: Take screenshot first (if requested)
        if screenshot {
            if let Ok(path) = take_screenshot(app_handle.clone()).await {
                screenshot_path = Some(path);
            }
        }

        // Step 2: Ensure window exists (create if needed)
        let window = if let Some(window) = app_handle.get_webview_window("support") {
            let _ = window.show();
            let _ = window.set_focus();
            window
        } else {
            create_support_window(&app_handle);
            app_handle
                .get_webview_window("support")
                .expect("support window should exist after creation")
        };

        // Step 3: If screenshot was taken, notify window
        if let Some(path) = screenshot_path {
            let _ = window.emit_to(EventTarget::Any, "use_screenshot", path);
        }
    });
}


async fn take_screenshot(app: AppHandle) -> Result<PathBuf, PathBuf> {
    // Get first available window (your desktop)
    let monitors = get_screenshotable_monitors().await.unwrap();
    if monitors.is_empty() {
        return Err("No screenshotable windows found".into());
    }

    let path = get_monitor_screenshot(app, monitors[0].id).await.unwrap();

    Ok(path)
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle, label: &str) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(label) {
        window.hide().map_err(|e| e.to_string())
    } else {
        Err(format!("No window found with label '{}'", label))
    }
}

#[tauri::command]
async fn get_settings_info() -> Result<device_manager::Settings, String> {
    get_settings()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_registration_status() -> Result<bool, String> {
    Ok(is_device_registered().await)
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    std::fs::read(&path)
        .map_err(|e| e.to_string())
        .map(|bytes| general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn read_registry_value(path: &str, key: &str) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let subkey = hklm.open_subkey(path).map_err(|e| e.to_string())?;
        let result: String = subkey.get_value(key).map_err(|e| e.to_string())?;
        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Registry only works on Windows".into())
    }
}
