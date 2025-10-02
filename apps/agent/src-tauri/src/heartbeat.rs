use crate::device_manager::{get_api_endpoint, get_primary_mac, get_settings};
use crate::logger::log_to_file;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{interval, Duration};

#[derive(Serialize, Debug)]
pub struct HeartbeatRequest {
    pub hostname: String,
    pub ip_address: Option<String>,
    pub ext_address: Option<String>,
    pub version: String,
    pub mac_address: Option<String>,
    pub guid: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct HeartbeatResponse {
    pub data: HeartbeatData,
}

#[derive(Deserialize, Debug)]
pub struct HeartbeatData {
    pub guid: String,
}

/// Gathers current system information for heartbeat
pub async fn gather_system_info() -> Result<HeartbeatRequest, Box<dyn std::error::Error>> {
    let settings = get_settings().await?;
    let hostname = settings
        .hostname
        .clone()
        .unwrap_or_else(|| hostname::get().unwrap().to_string_lossy().to_string());
    let mac_address = get_primary_mac();

    // Get local IP address
    let ip_address = get_local_ip();

    // Get external IP address (best effort, don't fail if unavailable)
    let ext_address = get_external_ip().await.ok();

    Ok(HeartbeatRequest {
        hostname,
        ip_address,
        ext_address,
        version: env!("CARGO_PKG_VERSION").to_string(),
        mac_address,
        guid: settings.guid,
    })
}

/// Gets the local IP address of the machine
fn get_local_ip() -> Option<String> {
    use local_ip_address::local_ip;

    match local_ip() {
        Ok(ip) => Some(ip.to_string()),
        Err(_) => None,
    }
}

/// Gets the external IP address by querying an external service
async fn get_external_ip() -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()?;

    let response = client
        .get("https://api.ipify.org?format=text")
        .send()
        .await?;

    Ok(response.text().await?)
}

/// Sends a heartbeat to the server
pub async fn send_heartbeat() -> Result<HeartbeatResponse, Box<dyn std::error::Error>> {
    let settings = get_settings().await?;

    // Check if device is registered
    if settings.device_id.is_none() {
        return Err("Device not registered, skipping heartbeat".into());
    }

    let device_id = settings.device_id.as_ref().unwrap();
    let site_id = &settings.site_id;

    // Gather system info
    let request = gather_system_info().await?;

    let api_url = get_api_endpoint("/v1.0/heartbeat").await?;

    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")
        .header("x-device-id", device_id)
        .header("x-site-id", site_id)
        .json(&request)
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        let response_text = response.text().await?;
        let result: HeartbeatResponse = serde_json::from_str(&response_text)?;

        Ok(result)
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Heartbeat failed ({}): {}", status, error_text).into())
    }
}

/// Starts the heartbeat background task that runs every 60 seconds
pub fn start_heartbeat_task(running: Arc<AtomicBool>) {
    tauri::async_runtime::spawn(async move {
        log_to_file(
            "INFO".to_string(),
            "Starting heartbeat background task".to_string(),
        );

        // Wait 5 seconds before first heartbeat to allow app to fully initialize
        tokio::time::sleep(Duration::from_secs(5)).await;

        let mut heartbeat_interval = interval(Duration::from_secs(60));
        let mut health_check_interval = interval(Duration::from_secs(86400)); // 24 hours

        // Skip first tick for health check to align with actual 24hr intervals
        health_check_interval.tick().await;

        while running.load(Ordering::Relaxed) {
            tokio::select! {
                _ = heartbeat_interval.tick() => {
                    // Send heartbeat silently (no logging unless error)
                    match send_heartbeat().await {
                        Ok(_response) => {
                            // Success - no logging
                        }
                        Err(e) => {
                            log_to_file(
                                "WARN".to_string(),
                                format!("Failed to send heartbeat: {}", e),
                            );
                        }
                    }
                }
                _ = health_check_interval.tick() => {
                    // Daily health check log
                    match gather_system_info().await {
                        Ok(info) => {
                            log_to_file(
                                "INFO".to_string(),
                                format!(
                                    "Daily health check - Hostname: {}, Version: {}, IP: {}, MAC: {}",
                                    info.hostname,
                                    info.version,
                                    info.ip_address.unwrap_or_else(|| "N/A".to_string()),
                                    info.mac_address.unwrap_or_else(|| "N/A".to_string())
                                ),
                            );
                        }
                        Err(e) => {
                            log_to_file(
                                "ERROR".to_string(),
                                format!("Daily health check failed: {}", e),
                            );
                        }
                    }
                }
            }
        }

        log_to_file(
            "INFO".to_string(),
            "Heartbeat background task stopped".to_string(),
        );
    });
}
