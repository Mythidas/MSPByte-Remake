use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub site_id: String,
    pub device_id: Option<String>,
    pub guid: Option<String>,
    pub api_host: String,
    pub hostname: Option<String>,
    pub installed_at: String,
    pub registered_at: Option<String>,
}

pub fn get_config_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        PathBuf::from("C:\\ProgramData\\MSPAgent")
    }
    #[cfg(target_os = "macos")]
    {
        PathBuf::from("/Library/Application Support/MSPAgent")
    }
    #[cfg(target_os = "linux")]
    {
        PathBuf::from("/etc/mspagent")
    }
}

pub fn get_settings_path() -> PathBuf {
    get_config_dir().join("settings.json")
}

pub async fn get_settings() -> Result<Settings, Box<dyn std::error::Error>> {
    let settings_path = get_settings_path();

    if !settings_path.exists() {
        return Err("No settings found. Please reinstall the application.".into());
    }

    let content = tokio::fs::read_to_string(&settings_path).await?;
    let settings: Settings = serde_json::from_str(&content)?;

    Ok(settings)
}

pub async fn save_settings(settings: &Settings) -> Result<(), Box<dyn std::error::Error>> {
    let settings_path = get_settings_path();

    // Ensure directory exists
    if let Some(parent) = settings_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let content = serde_json::to_string_pretty(settings)?;
    tokio::fs::write(&settings_path, content).await?;

    Ok(())
}

pub async fn complete_settings() -> Result<Settings, Box<dyn std::error::Error>> {
    let mut settings = get_settings().await?;

    // If already complete, return as-is
    if settings.guid.is_some() && settings.hostname.is_some() {
        return Ok(settings);
    }

    // Complete missing fields
    if settings.guid.is_none() {
        settings.guid = Some(get_machine_id()?);
    }

    if settings.hostname.is_none() {
        settings.hostname = Some(hostname::get()?.to_string_lossy().to_string());
    }

    save_settings(&settings).await?;

    Ok(settings)
}

pub async fn update_from_registration(
    settings: &mut Settings,
    device_id: String,
    guid: String,
) -> Result<(), Box<dyn std::error::Error>> {
    settings.device_id = Some(device_id);
    settings.guid = Some(guid);
    settings.registered_at = Some(chrono::Utc::now().to_rfc3339());
    save_settings(settings).await?;
    Ok(())
}

pub async fn is_device_registered() -> bool {
    if let Ok(settings) = get_settings().await {
        settings.registered_at.is_some()
    } else {
        false
    }
}

pub fn get_machine_id() -> Result<String, Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("reg")
            .args(&[
                "query",
                "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography",
                "/v",
                "MachineGuid",
            ])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        for line in output_str.lines() {
            if line.contains("MachineGuid") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    return Ok(parts[2].to_string());
                }
            }
        }

        Err("Could not find MachineGuid".into())
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("ioreg")
            .args(&["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        for line in output_str.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(uuid) = line.split('"').nth(3) {
                    return Ok(uuid.to_string());
                }
            }
        }

        Err("Could not find IOPlatformUUID".into())
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            return Ok(id.trim().to_string());
        }

        if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
            return Ok(id.trim().to_string());
        }

        Err("Could not find machine-id".into())
    }
}

pub fn get_serial_number() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("wmic")
            .args(&["bios", "get", "serialnumber"])
            .output()
            .ok()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        for line in output_str.lines().skip(1) {
            let trimmed = line.trim();
            if !trimmed.is_empty() && trimmed != "SerialNumber" {
                return Some(trimmed.to_string());
            }
        }

        None
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("system_profiler")
            .args(&["SPHardwareDataType"])
            .output()
            .ok()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        for line in output_str.lines() {
            if line.contains("Serial Number") {
                if let Some(serial) = line.split(':').nth(1) {
                    return Some(serial.trim().to_string());
                }
            }
        }

        None
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(serial) = std::fs::read_to_string("/sys/class/dmi/id/product_serial") {
            let trimmed = serial.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }

        None
    }
}

pub fn get_primary_mac() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("getmac")
            .args(&["/fo", "csv", "/nh"])
            .output()
            .ok()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        // Get first MAC address
        if let Some(first_line) = output_str.lines().next() {
            // Parse CSV format: "MAC","Transport Name"
            if let Some(mac) = first_line.split(',').next() {
                return Some(mac.trim_matches('"').to_string());
            }
        }

        None
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("ifconfig").arg("en0").output().ok()?;

        let output_str = String::from_utf8_lossy(&output.stdout);

        for line in output_str.lines() {
            if line.contains("ether") {
                if let Some(mac) = line.split_whitespace().nth(1) {
                    return Some(mac.to_string());
                }
            }
        }

        None
    }

    #[cfg(target_os = "linux")]
    {
        // Try to read from /sys/class/net
        let net_dir = std::path::Path::new("/sys/class/net");
        if let Ok(entries) = std::fs::read_dir(net_dir) {
            for entry in entries.flatten() {
                let interface = entry.file_name();
                let interface_str = interface.to_string_lossy();

                // Skip loopback
                if interface_str.starts_with("lo") {
                    continue;
                }

                let mac_path = net_dir.join(&interface).join("address");
                if let Ok(mac) = std::fs::read_to_string(&mac_path) {
                    let trimmed = mac.trim();
                    if !trimmed.is_empty() && trimmed != "00:00:00:00:00:00" {
                        return Some(trimmed.to_string());
                    }
                }
            }
        }

        None
    }
}

// Helper to get API endpoint
pub async fn get_api_endpoint(path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let settings = get_settings().await?;
    Ok(format!("{}{}", settings.api_host, path))
}
