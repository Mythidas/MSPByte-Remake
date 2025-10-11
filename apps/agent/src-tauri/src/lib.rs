mod device_manager;
mod device_registration;
mod heartbeat;
mod logger;

use base64::engine::general_purpose;
use base64::Engine;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{
    AppHandle, Emitter, EventTarget, Manager, WebviewUrl, WebviewWindowBuilder,
    tray::TrayIconBuilder,
    menu::{Menu, MenuItem}
};
use tauri_plugin_screenshots::{get_monitor_screenshot, get_screenshotable_monitors};

use device_manager::{get_settings, is_device_registered};
use device_registration::register_device_with_server;
use heartbeat::start_heartbeat_task;
use logger::log_to_file;

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
            // Create atomic flags for background task control
            let heartbeat_running = Arc::new(AtomicBool::new(true));
            let heartbeat_flag = heartbeat_running.clone();

            // Store the flags in app state for cleanup
            app.manage(heartbeat_running);

            // Check and register device on first launch
            tauri::async_runtime::spawn(async move {
                if !is_device_registered().await {
                    log_to_file(
                        "INFO".to_string(),
                        "First launch detected, registering device...".to_string(),
                    );

                    match register_device_with_server().await {
                        Ok(response) => {
                            log_to_file(
                                String::from("INFO"),
                                String::from("Device registered successfully"),
                            );
                            log_to_file(
                                String::from("INFO"),
                                format!("Device ID: {}", response.data.device_id),
                            );
                            log_to_file(
                                String::from("INFO"),
                                format!("GUID: {}", response.data.guid),
                            );
                        }
                        Err(e) => {
                            log_to_file(
                                String::from("ERROR"),
                                format!("Failed to regiter device: {}", e),
                            );
                            log_to_file(
                                String::from("ERROR"),
                                String::from("Will retry on next launch"),
                            );
                        }
                    }
                } else {
                    log_to_file(
                        String::from("INFO"),
                        "Device already registered".to_string(),
                    );
                }

                // Start background tasks after registration check
                start_heartbeat_task(heartbeat_flag.clone());
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
            show_window,
            take_screenshot,
            read_file_text,
            read_file_base64,
            read_file_binary,
            read_registry_value,
            log_to_file
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

    log_to_file(String::from("INFO"), format!("Opening support window with screenshot set to {}", screenshot));
    tauri::async_runtime::spawn(async move {
        let mut screenshot_path: Option<PathBuf> = None;

        // Step 1: Take screenshot first (if requested)
        if screenshot {
            if let Ok(path) = take_screenshot_internal(app_handle.clone()).await {
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

async fn take_screenshot_internal(app: AppHandle) -> Result<PathBuf, String> {
    log_to_file(String::from("INFO"), String::from("Starting screenshot capture"));

    // Hide window if it exists
    if let Some(window) = app.get_webview_window("support") {
        log_to_file(String::from("INFO"), String::from("Hiding support window before screenshot"));
        let _ = window.hide();
        // Give time for window to hide
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    } else {
        log_to_file(String::from("INFO"), String::from("No support window to hide"));
    }

    // Get first available monitor
    log_to_file(String::from("INFO"), String::from("Getting screenshotable monitors"));
    let monitors = get_screenshotable_monitors().await
        .map_err(|e| {
            let err_msg = format!("Failed to get monitors: {}", e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;

    if monitors.is_empty() {
        let err_msg = String::from("No screenshotable monitors found");
        log_to_file(String::from("ERROR"), err_msg.clone());
        return Err(err_msg);
    }

    log_to_file(String::from("INFO"), format!("Found {} monitor(s), capturing from first monitor", monitors.len()));
    let path = get_monitor_screenshot(app, monitors[0].id).await
        .map_err(|e| {
            let err_msg = format!("Failed to capture screenshot: {}", e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;

    log_to_file(String::from("INFO"), format!("Screenshot saved to: {}", path.display()));
    Ok(path)
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    log_to_file(String::from("INFO"), format!("Hiding window: {}", label));
    if let Some(window) = app.get_webview_window(&label) {
        window.hide().map_err(|e| {
            let err_msg = format!("Failed to hide window {}: {}", label, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;
        log_to_file(String::from("INFO"), format!("Successfully hidden window: {}", label));
    } else {
        log_to_file(String::from("WARN"), format!("Window not found: {}", label));
    }
    Ok(())
}

#[tauri::command]
fn show_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    log_to_file(String::from("INFO"), format!("Showing window: {}", label));
    if let Some(window) = app.get_webview_window(&label) {
        window.show().map_err(|e| {
            let err_msg = format!("Failed to show window {}: {}", label, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;
        window.set_focus().map_err(|e| {
            let err_msg = format!("Failed to focus window {}: {}", label, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;
        log_to_file(String::from("INFO"), format!("Successfully shown window: {}", label));
    } else {
        log_to_file(String::from("INFO"), format!("Window {} not found, creating new window", label));
        create_support_window(&app);
        if let Some(window) = app.get_webview_window(&label) {
            window.show().map_err(|e| {
                let err_msg = format!("Failed to show newly created window {}: {}", label, e);
                log_to_file(String::from("ERROR"), err_msg.clone());
                err_msg
            })?;
            window.set_focus().map_err(|e| {
                let err_msg = format!("Failed to focus newly created window {}: {}", label, e);
                log_to_file(String::from("ERROR"), err_msg.clone());
                err_msg
            })?;
            log_to_file(String::from("INFO"), format!("Successfully created and shown window: {}", label));
        } else {
            let err_msg = format!("Failed to get window {} after creation", label);
            log_to_file(String::from("ERROR"), err_msg.clone());
            return Err(err_msg);
        }
    }
    Ok(())
}

#[tauri::command]
async fn take_screenshot(app: tauri::AppHandle) -> Result<String, String> {
    log_to_file(String::from("INFO"), String::from("take_screenshot command invoked"));
    let path = take_screenshot_internal(app).await?;
    let path_str = path.to_string_lossy().to_string();
    log_to_file(String::from("INFO"), format!("Returning screenshot path: {}", path_str));
    Ok(path_str)
}

#[tauri::command]
async fn get_settings_info() -> Result<device_manager::Settings, String> {
    log_to_file(String::from("INFO"), String::from("get_settings_info command invoked"));
    get_settings().await.map_err(|e| {
        let err_msg = format!("Failed to get settings: {}", e);
        log_to_file(String::from("ERROR"), err_msg.clone());
        err_msg
    })
}

#[tauri::command]
async fn check_registration_status() -> Result<bool, String> {
    log_to_file(String::from("INFO"), String::from("check_registration_status command invoked"));
    let is_registered = is_device_registered().await;
    log_to_file(String::from("INFO"), format!("Device registration status: {}", is_registered));
    Ok(is_registered)
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    log_to_file(String::from("INFO"), format!("read_file_text command invoked for: {}", path));
    std::fs::read_to_string(&path).map_err(|e| {
        let err_msg = format!("Failed to read file {}: {}", path, e);
        log_to_file(String::from("ERROR"), err_msg.clone());
        err_msg
    })
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    log_to_file(String::from("INFO"), format!("read_file_base64 command invoked for: {}", path));
    std::fs::read(&path)
        .map_err(|e| {
            let err_msg = format!("Failed to read file {}: {}", path, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })
        .map(|bytes| {
            log_to_file(String::from("INFO"), format!("Successfully encoded {} bytes to base64", bytes.len()));
            general_purpose::STANDARD.encode(bytes)
        })
}

#[tauri::command]
fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    log_to_file(String::from("INFO"), format!("read_file_binary command invoked for: {}", path));
    std::fs::read(&path)
        .map_err(|e| {
            let err_msg = format!("Failed to read file {}: {}", path, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })
        .map(|bytes| {
            log_to_file(String::from("INFO"), format!("Successfully read {} bytes as binary", bytes.len()));
            bytes
        })
}

#[tauri::command]
fn read_registry_value(_path: &str, _key: &str) -> Result<String, String> {
    log_to_file(String::from("INFO"), format!("read_registry_value command invoked: path={}, key={}", _path, _key));

    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let subkey = hklm.open_subkey(_path).map_err(|e| {
            let err_msg = format!("Failed to open registry path {}: {}", _path, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;
        let result: String = subkey.get_value(_key).map_err(|e| {
            let err_msg = format!("Failed to read registry key {}: {}", _key, e);
            log_to_file(String::from("ERROR"), err_msg.clone());
            err_msg
        })?;
        log_to_file(String::from("INFO"), format!("Successfully read registry value for {}/{}", _path, _key));
        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let err_msg = String::from("Registry only works on Windows");
        log_to_file(String::from("ERROR"), err_msg.clone());
        Err(err_msg)
    }
}
