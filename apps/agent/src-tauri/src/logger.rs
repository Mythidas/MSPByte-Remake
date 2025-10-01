use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

use crate::device_manager::get_config_dir;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(&self) -> &str {
        match self {
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

impl From<String> for LogLevel {
    fn from(s: String) -> Self {
        match s.to_uppercase().as_str() {
            "WARN" => LogLevel::Warn,
            "ERROR" => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }
}

fn get_log_path() -> PathBuf {
    let config_dir = get_config_dir();
    let logs_dir = config_dir.join("logs");
    logs_dir.join(format!("runtime_{}.log", VERSION))
}

pub fn log_message(level: LogLevel, message: &str) -> Result<(), Box<dyn std::error::Error>> {
    let log_path = get_log_path();

    // Ensure logs directory exists
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    let log_entry = format!("[{}][{}] {}\n", timestamp, level.as_str(), message);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;

    file.write_all(log_entry.as_bytes())?;

    // Console output removed to prevent CMD window flashing on Windows GUI apps
    // All logs are written to file only

    Ok(())
}

#[tauri::command]
pub fn log_to_file(level: String, message: String) {
    let log_level = LogLevel::from(level);
    log_message(log_level, &message).expect("File could not be written to")
}
