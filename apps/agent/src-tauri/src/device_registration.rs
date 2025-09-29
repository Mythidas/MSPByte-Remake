use serde::{Deserialize, Serialize};
use crate::device_manager::{
    complete_settings, update_from_registration, get_api_endpoint,
    get_machine_id, get_serial_number, get_primary_mac
};

#[derive(Serialize, Debug)]  // Added Debug trait
pub struct RegistrationRequest {
    pub guid: Option<String>,
    pub site_id: String,
    pub hostname: String,
    pub version: String,
    pub platform: String,
    pub serial: Option<String>,
    pub mac: Option<String>,
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

pub async fn register_device_with_server() -> Result<RegistrationResponse, Box<dyn std::error::Error>> {
    // Complete settings with local machine info
    let mut settings = complete_settings().await?;
    let api_url = get_api_endpoint("/v1.0/register").await?;
    
    // Try to get machine GUID, but allow None if not available
    let guid = get_machine_id().ok();
    let serial = get_serial_number();
    let mac = get_primary_mac();
    
    let request = RegistrationRequest {
        guid: guid.clone(),
        site_id: settings.site_id.clone(),
        hostname: settings.hostname.clone().unwrap_or_else(|| "unknown".to_string()),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        serial: serial.clone(),
        mac: mac.clone(),
    };

    println!("Sending to: {}", api_url);
    
    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header("Content-Type", "application/json")  // Explicitly set content type
        .json(&request)
        .send()
        .await?;
    
    let status = response.status();
    println!("Response status: {}", status);
    
    if status.is_success() {
        let response_text = response.text().await?;
        println!("Response body: {}", response_text);
        
        let result: RegistrationResponse = serde_json::from_str(&response_text)?;
        
        // Update settings with server-provided device_id and guid
        update_from_registration(
            &mut settings, 
            result.data.device_id.clone(), 
            result.data.guid.clone()
        ).await?;
        
        Ok(result)
    } else {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("Error response: {}", error_text);
        Err(format!("Registration failed ({}): {}", status, error_text).into())
    }
}