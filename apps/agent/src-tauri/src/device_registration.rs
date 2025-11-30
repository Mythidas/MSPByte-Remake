use crate::device_manager::{
    complete_settings, get_api_endpoint, get_machine_id, get_primary_mac, get_serial_number,
    get_username, update_from_registration,
};
use crate::heartbeat::{get_external_ip, get_local_ip};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug)] // Added Debug trait
pub struct RegistrationRequest {
    pub guid: Option<String>,
    pub site_id: String,
    pub hostname: String,
    pub version: String,
    pub platform: String,
    pub serial: Option<String>,
    pub mac: Option<String>,
    pub ip_address: Option<String>,
    pub ext_address: Option<String>,
    pub username: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct RegistrationResponse {
    pub data: RegistrationData,
}

#[derive(Deserialize, Debug)]
pub struct RegistrationData {
    pub device_id: String,
    pub guid: String,
}

pub async fn register_device_with_server(
) -> Result<RegistrationResponse, Box<dyn std::error::Error>> {
    // Complete settings with local machine info
    let mut settings = complete_settings().await?;
    let api_url = get_api_endpoint("/v1.0/register").await?;

    // Try to get machine GUID, but allow None if not available
    let guid = get_machine_id().ok();
    let serial = get_serial_number();
    let mac = get_primary_mac();

    // Gather additional system info (previously collected by heartbeat)
    let ip_address = get_local_ip();
    let ext_address = get_external_ip().await.ok();
    let username = get_username().await;

    let request = RegistrationRequest {
        guid: guid.clone(),
        site_id: settings.site_id.clone(),
        hostname: settings
            .hostname
            .clone()
            .unwrap_or_else(|| "unknown".to_string()),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        serial: serial.clone(),
        mac: mac.clone(),
        ip_address,
        ext_address,
        username,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json") // Explicitly set content type
        .json(&request)
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        let response_text = response.text().await?;

        let result: RegistrationResponse = serde_json::from_str(&response_text)?;

        // Update settings with server-provided device_id and guid
        update_from_registration(
            &mut settings,
            result.data.device_id.clone(),
            result.data.guid.clone(),
        )
        .await?;

        Ok(result)
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Registration failed ({}): {}", status, error_text).into())
    }
}
