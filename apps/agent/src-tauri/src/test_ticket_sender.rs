use crate::device_manager::{get_api_endpoint, get_rmm_device_id, get_settings};
use crate::logger::log_to_file;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::Duration;


#[derive(Serialize, Debug)]
pub struct TestTicketRequest {
    pub summary: String,
    pub description: String,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub impact: String,
    pub urgency: String,
    pub rmm_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct TicketResponse {
    pub data: String, // Ticket ID
}

/// Sends a test ticket to the server
async fn send_test_ticket() -> Result<TicketResponse, Box<dyn std::error::Error>> {
    let settings = get_settings().await?;

    // Check if device is registered
    if settings.device_id.is_none() {
        return Err("Device not registered, skipping test ticket".into());
    }

    let device_id = settings.device_id.as_ref().unwrap();
    let site_id = &settings.site_id;

    // Generate test ticket data
    let timestamp = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC");
    let hostname = settings
        .hostname
        .clone()
        .unwrap_or_else(|| "unknown".to_string());

    // Get RMM Device ID from CentraStage if available
    let rmm_id = get_rmm_device_id();

    let request = TestTicketRequest {
        summary: format!(
            "[TEST] Automated Test Ticket from {}",
            hostname
        ),
        description: format!(
            "This is an automated test ticket to verify the ticketing system.\n\n\
            Generated at: {}\n\
            Device ID: {}\n\
            Site ID: {}\n\
            Hostname: {}\n\
            Version: {}\n\
            RMM Device ID: {}\n\n\
            This ticket can be safely closed.",
            timestamp,
            device_id,
            site_id,
            hostname,
            env!("CARGO_PKG_VERSION"),
            rmm_id.as_deref().unwrap_or("N/A")
        ),
        name: "Test User".to_string(),
        email: "test@example.com".to_string(),
        phone: "555-0100".to_string(),
        impact: "Low".to_string(),
        urgency: "Low".to_string(),
        rmm_id,
    };

    let api_url = get_api_endpoint("/v1.0/ticket/create").await?;

    log_to_file(
        "INFO".to_string(),
        format!("Sending test ticket to: {}", api_url),
    );

    // Create multipart form data (matching frontend format)
    let mut form = reqwest::multipart::Form::new()
        .text("summary", request.summary)
        .text("description", request.description)
        .text("name", request.name)
        .text("email", request.email)
        .text("phone", request.phone)
        .text("impact", request.impact)
        .text("urgency", request.urgency);

    // Add rmm_id if available
    if let Some(rmm_id) = request.rmm_id {
        form = form.text("rmm_id", rmm_id);
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header("X-Device-ID", device_id)
        .header("X-Site-ID", site_id)
        .multipart(form)
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        let response_text = response.text().await?;
        let result: TicketResponse = serde_json::from_str(&response_text)?;

        log_to_file(
            "INFO".to_string(),
            format!("Test ticket created successfully, Ticket ID: {}", result.data),
        );

        Ok(result)
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Test ticket creation failed ({}): {}", status, error_text).into())
    }
}

/// Starts the test ticket sender background task that runs every 5-10 minutes (random)
pub fn start_test_ticket_sender(running: Arc<AtomicBool>) {
    tauri::async_runtime::spawn(async move {
        log_to_file(
            "INFO".to_string(),
            "Starting test ticket sender background task".to_string(),
        );

        // Wait 30 seconds before first test ticket to allow app to fully initialize
        tokio::time::sleep(Duration::from_secs(30)).await;

        while running.load(Ordering::Relaxed) {
            // Generate random interval between 5-10 minutes (300-600 seconds)
            // Create RNG inside the loop to avoid Send issues
            let random_seconds = {
                let mut rng = rand::thread_rng();
                rng.gen_range(300..=600)
            };
            let wait_duration = Duration::from_secs(random_seconds);

            log_to_file(
                "INFO".to_string(),
                format!(
                    "Next test ticket will be sent in {} seconds ({:.1} minutes)",
                    random_seconds,
                    random_seconds as f64 / 60.0
                ),
            );

            // Wait for the random interval
            tokio::time::sleep(wait_duration).await;

            // Check if still running after sleep
            if !running.load(Ordering::Relaxed) {
                break;
            }

            log_to_file("INFO".to_string(), "Sending test ticket...".to_string());

            match send_test_ticket().await {
                Ok(response) => {
                    log_to_file(
                        "INFO".to_string(),
                        format!(
                            "Test ticket sent successfully, Ticket ID: {}",
                            response.data
                        ),
                    );
                }
                Err(e) => {
                    log_to_file(
                        "ERROR".to_string(),
                        format!("Failed to send test ticket: {}", e),
                    );
                }
            }
        }

        log_to_file(
            "INFO".to_string(),
            "Test ticket sender background task stopped".to_string(),
        );
    });
}
