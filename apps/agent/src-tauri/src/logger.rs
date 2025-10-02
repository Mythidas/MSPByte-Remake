use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::device_manager::get_config_dir;

const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_LOG_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10MB
const MAX_ROTATED_FILES: usize = 5;

// Global mutex to ensure thread-safe log rotation
static LOG_MUTEX: Mutex<()> = Mutex::new(());

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

fn get_logs_dir() -> PathBuf {
    let config_dir = get_config_dir();
    config_dir.join("logs")
}

fn get_log_filename() -> String {
    format!("runtime_{}.log", VERSION)
}

fn get_log_path() -> PathBuf {
    get_logs_dir().join(get_log_filename())
}

// Rotate log file if it exceeds size limit
fn check_and_rotate_log() -> Result<(), Box<dyn std::error::Error>> {
    let log_path = get_log_path();

    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() > MAX_LOG_SIZE_BYTES {
            // Rotate existing logs (shift .4 -> .5, .3 -> .4, etc.)
            for i in (1..MAX_ROTATED_FILES).rev() {
                let old_file = get_logs_dir().join(format!("{}.{}", get_log_filename(), i));
                let new_file = get_logs_dir().join(format!("{}.{}", get_log_filename(), i + 1));

                if old_file.exists() {
                    let _ = fs::rename(old_file, new_file);
                }
            }

            // Move current log to .1
            let rotated = get_logs_dir().join(format!("{}.1", get_log_filename()));
            fs::rename(&log_path, rotated)?;
        }
    }

    Ok(())
}

pub fn log_message(level: LogLevel, message: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Acquire mutex to ensure thread-safe rotation and writing
    let _lock = LOG_MUTEX.lock().unwrap();

    let log_path = get_log_path();

    // Ensure logs directory exists
    if let Some(parent) = log_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Check and rotate before writing
    check_and_rotate_log()?;

    // Format log entry: [timestamp][LEVEL] message
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    let log_entry = format!("[{}][{}] {}\n", timestamp, level.as_str(), message);

    // Write to file
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;

    file.write_all(log_entry.as_bytes())?;

    Ok(())
}

#[tauri::command]
pub fn log_to_file(level: String, message: String) {
    let log_level = LogLevel::from(level);
    log_message(log_level, &message).expect("File could not be written to")
}
