mod device_manager;
mod device_registration;

use device_manager::{get_settings, is_device_registered};
use device_registration::register_device_with_server;

#[tauri::command]
async fn get_device_info() -> Result<device_manager::Settings, String> {
    device_manager::get_settings().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_registration_status() -> Result<bool, String> {
    Ok(is_device_registered().await)
}

#[tauri::command]
async fn submit_ticket(ticket_data: serde_json::Value) -> Result<String, String> {
    let settings = get_settings().await.map_err(|e| e.to_string())?;
    
    if settings.device_id.is_none() {
        return Err("Device not registered".to_string());
    }
    
    let api_url = device_manager::get_api_endpoint("/api/tickets/submit")
        .await
        .map_err(|e| e.to_string())?;
    
    #[derive(serde::Serialize)]
    struct TicketRequest {
        device_id: String,
        site_id: String,
        data: serde_json::Value,
    }
    
    let request = TicketRequest {
        device_id: settings.device_id.unwrap(),
        site_id: settings.site_id,
        data: ticket_data,
    };
    
    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        Ok("Ticket submitted successfully".to_string())
    } else {
        Err(format!("Failed to submit ticket: {}", response.status()))
    }
}

#[tauri::command]
async fn fetch_my_tickets() -> Result<serde_json::Value, String> {
    let settings = get_settings().await.map_err(|e| e.to_string())?;
    
    if settings.device_id.is_none() {
        return Err("Device not registered".to_string());
    }
    
    let api_url = device_manager::get_api_endpoint("/api/tickets/mine")
        .await
        .map_err(|e| e.to_string())?;
    
    #[derive(serde::Serialize)]
    struct TicketFetchRequest {
        device_id: String,
        site_id: String,
    }
    
    let request = TicketFetchRequest {
        device_id: settings.device_id.unwrap(),
        site_id: settings.site_id,
    };
    
    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    if response.status().is_success() {
        let tickets = response.json().await.map_err(|e| e.to_string())?;
        Ok(tickets)
    } else {
        Err(format!("Failed to fetch tickets: {}", response.status()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
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
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_device_info,
            check_registration_status,
            submit_ticket,
            fetch_my_tickets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
