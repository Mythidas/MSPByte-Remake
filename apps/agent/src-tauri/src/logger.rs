use chrono::Local;
use std::fs;
use std::path::PathBuf;
use std::sync::Once;
use tracing::{error, info, warn};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt};

use crate::device_manager::get_config_dir;

const VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_LOG_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10MB

static INIT: Once = Once::new();

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

fn init_logger() {
    INIT.call_once(|| {
        let logs_dir = get_logs_dir();

        // Ensure logs directory exists
        let _ = fs::create_dir_all(&logs_dir);

        // Create rolling file appender with size-based rotation
        let file_appender = RollingFileAppender::builder()
            .rotation(Rotation::NEVER) // We'll handle rotation manually by size
            .filename_prefix(format!("runtime_{}", VERSION))
            .filename_suffix("log")
            .max_log_files(5) // Keep last 5 rotated files
            .build(logs_dir)
            .expect("Failed to create file appender");

        // Create custom formatter that matches the original format
        let format = fmt::format()
            .with_level(true)
            .with_target(false)
            .with_thread_ids(false)
            .with_thread_names(false)
            .with_ansi(false)
            .with_timer(fmt::time::LocalTime::rfc_3339());

        tracing_subscriber::registry()
            .with(fmt::layer().with_writer(file_appender).event_format(format))
            .init();
    });
}

// Rotate log file if it exceeds size limit
fn check_and_rotate_log() {
    let log_path = get_logs_dir().join(get_log_filename());

    if let Ok(metadata) = fs::metadata(&log_path) {
        if metadata.len() > MAX_LOG_SIZE_BYTES {
            // Rotate existing logs
            for i in (1..5).rev() {
                let old_file = get_logs_dir().join(format!("{}.{}", get_log_filename(), i));
                let new_file = get_logs_dir().join(format!("{}.{}", get_log_filename(), i + 1));
                let _ = fs::rename(old_file, new_file);
            }

            // Move current log to .1
            let rotated = get_logs_dir().join(format!("{}.1", get_log_filename()));
            let _ = fs::rename(&log_path, rotated);
        }
    }
}

pub fn log_message(level: LogLevel, message: &str) -> Result<(), Box<dyn std::error::Error>> {
    init_logger();
    check_and_rotate_log();

    // Format message to match original: [timestamp][LEVEL] message
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S");
    let formatted_msg = format!("[{}][{}] {}", timestamp, level.as_str(), message);

    match level {
        LogLevel::Info => info!("{}", formatted_msg),
        LogLevel::Warn => warn!("{}", formatted_msg),
        LogLevel::Error => error!("{}", formatted_msg),
    }

    Ok(())
}

#[tauri::command]
pub fn log_to_file(level: String, message: String) {
    let log_level = LogLevel::from(level);
    log_message(log_level, &message).expect("File could not be written to")
}
