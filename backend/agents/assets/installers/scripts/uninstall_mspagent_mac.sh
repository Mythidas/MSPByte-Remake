#!/bin/bash

# MSPAgent Silent Uninstaller for macOS - Global Config & All Users
# 
# Usage via RMM:
#   curl -o /tmp/uninstall_mspagent.sh https://your-cdn.com/uninstall_mspagent.sh
#   chmod +x /tmp/uninstall_mspagent.sh
#   sudo /tmp/uninstall_mspagent.sh

set -e

APP_NAME="MSPAgent"
APP_PATH="/Applications/${APP_NAME}.app"

# Global config paths
CONFIG_DIR="/Library/Application Support/${APP_NAME}"
LOG_DIR="${CONFIG_DIR}/logs"

# Check for root privileges
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/uninstall.log"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    echo "[${timestamp}] $1" | tee -a "${LOG_FILE}"
}

log "=== MSPAgent Uninstallation Log (Global Config) ==="
log "Started: $(date '+%Y-%m-%d %H:%M:%S')"
log "Running as: $(whoami)"

# =============================================================================
# STEP 1: Remove Launch Agents for All Users
# =============================================================================
log "=== STEP 1: Removing Auto-Start for All Users ==="

# Find all launch agents
LAUNCH_AGENTS=$(find /Users/*/Library/LaunchAgents -name "com.mspbyte.agent.plist" 2>/dev/null || true)

if [ -n "${LAUNCH_AGENTS}" ]; then
    echo "${LAUNCH_AGENTS}" | while read -r AGENT_PATH; do
        if [ -f "${AGENT_PATH}" ]; then
            # Extract username from path
            USERNAME=$(echo "${AGENT_PATH}" | awk -F'/' '{print $3}')
            log "Found launch agent for user: ${USERNAME}"
            log "  Path: ${AGENT_PATH}"
            
            # Get user UID
            USER_UID=$(id -u "${USERNAME}" 2>/dev/null || echo "")
            
            if [ -n "${USER_UID}" ]; then
                # Try to unload if user is logged in
                if launchctl asuser "${USER_UID}" launchctl list 2>/dev/null | grep -q "com.apple.windowserver"; then
                    log "  Unloading launch agent for ${USERNAME}"
                    launchctl asuser "${USER_UID}" sudo -u "${USERNAME}" launchctl unload -w "${AGENT_PATH}" 2>&1 | tee -a "${LOG_FILE}" || true
                else
                    log "  User not logged in - skipping unload"
                fi
            fi
            
            # Remove the plist file
            rm -f "${AGENT_PATH}"
            log "  ✓ Launch agent removed for ${USERNAME}"
        fi
    done
    
    log "All launch agents removed"
else
    log "No launch agents found"
fi

# Also check for global LaunchDaemon (in case it was used)
if [ -f "/Library/LaunchDaemons/com.mspbyte.agent.plist" ]; then
    log "Found global launch daemon - removing"
    launchctl unload "/Library/LaunchDaemons/com.mspbyte.agent.plist" 2>/dev/null || true
    rm -f "/Library/LaunchDaemons/com.mspbyte.agent.plist"
    log "Global launch daemon removed"
fi

# =============================================================================
# STEP 2: Stop Running Application (All Users)
# =============================================================================
log "=== STEP 2: Stopping Application for All Users ==="

if pgrep -x "${APP_NAME}" > /dev/null; then
    RUNNING_COUNT=$(pgrep -x "${APP_NAME}" | wc -l | tr -d ' ')
    log "Application is running (${RUNNING_COUNT} instances) - stopping"
    
    # Kill all instances
    pkill -9 "${APP_NAME}" || true
    sleep 2
    
    log "Application stopped"
else
    log "Application is not running"
fi

# =============================================================================
# STEP 3: Remove Application Bundle
# =============================================================================
log "=== STEP 3: Removing Application ==="

if [ -d "${APP_PATH}" ]; then
    log "Removing application: ${APP_PATH}"
    rm -rf "${APP_PATH}"
    
    if [ -d "${APP_PATH}" ]; then
        log "✗ Failed to remove application"
    else
        log "✓ Application removed"
    fi
else
    log "Application not found at ${APP_PATH}"
fi

# =============================================================================
# STEP 4: Handle Global Configuration Data
# =============================================================================
log "=== STEP 4: Removing Global Configuration Data ==="

if [ -d "${CONFIG_DIR}" ]; then
    log "Configuration directory exists: ${CONFIG_DIR}"
    
    # List what will be removed
    if [ -f "${CONFIG_DIR}/settings.json" ]; then
        log "  - settings.json"
    fi
    
    if [ -d "${CONFIG_DIR}/logs" ]; then
        LOG_COUNT=$(find "${CONFIG_DIR}/logs" -type f 2>/dev/null | wc -l | tr -d ' ')
        log "  - logs directory (${LOG_COUNT} files)"
    fi
    
    # Save final log message before removing logs
    log "Removing global configuration directory..."
    
    # Give a moment for log to flush
    sleep 1
    
    # Remove config directory
    rm -rf "${CONFIG_DIR}"
    
    if [ -d "${CONFIG_DIR}" ]; then
        echo "WARNING: Some files could not be removed from ${CONFIG_DIR}"
    else
        echo "✓ Global configuration directory removed successfully"
    fi
else
    log "No configuration directory found"
fi

# =============================================================================
# STEP 5: Remove any user-level configs (if they exist)
# =============================================================================
log "=== STEP 5: Checking for User-Level Configs ==="

USER_CONFIGS=$(find /Users/*/Library/Application\ Support/${APP_NAME} -type d 2>/dev/null || true)

if [ -n "${USER_CONFIGS}" ]; then
    echo "${USER_CONFIGS}" | while read -r USER_CONFIG; do
        USERNAME=$(echo "${USER_CONFIG}" | awk -F'/' '{print $3}')
        log "Found user config for: ${USERNAME} at ${USER_CONFIG}"
        rm -rf "${USER_CONFIG}"
        log "  ✓ Removed"
    done
else
    log "No user-level configs found"
fi

# =============================================================================
# Uninstallation Complete
# =============================================================================
echo ""
echo "✓ MSPAgent has been completely uninstalled from all users."
echo ""

exit 0