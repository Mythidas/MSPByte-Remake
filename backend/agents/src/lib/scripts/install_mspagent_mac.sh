#!/bin/bash

# MSPAgent Silent Installer for macOS - Global Config & All Users
# This script handles silent installation of the Tauri DMG with global configuration
# 
# Usage via RMM:
#   curl -o /tmp/install_mspagent.sh https://your-cdn.com/install_mspagent.sh
#   chmod +x /tmp/install_mspagent.sh
#   sudo /tmp/install_mspagent.sh "your-site-secret-here" "https://dmg-url.com/MSPAgent.dmg"
#
# Or with environment variable:
#   export MSPAGENT_SITE_SECRET="your-site-secret"
#   export MSPAGENT_DMG_URL="https://dmg-url.com/MSPAgent.dmg"
#   sudo /tmp/install_mspagent.sh

set -e

# =============================================================================
# Configuration Variables
# =============================================================================
APP_NAME="MSPAgent"
APP_COMPANY="MSPByte"
CONFIG_DIR_NAME="MSPAgent"
APP_VERSION="0.1.14"
API_HOST="https://agent.mspbyte.pro"

# Global paths - accessible by all users
CONFIG_DIR="/Library/Application Support/${CONFIG_DIR_NAME}"
LOG_DIR="${CONFIG_DIR}/logs"
SETTINGS_FILE="${CONFIG_DIR}/settings.json"
LAUNCH_DAEMON_PLIST="/Library/LaunchDaemons/com.mspbyte.agent.plist"

APP_PATH="/Applications/${APP_NAME}.app"
MOUNT_POINT="/Volumes/${APP_NAME}"

# =============================================================================
# Check for root privileges
# =============================================================================
if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)"
    exit 1
fi

# =============================================================================
# Logging Functions
# =============================================================================
mkdir -p "${LOG_DIR}"
chmod 755 "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/install_${APP_VERSION}.log"

log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S.%3N')
    echo "[${timestamp}] $1" | tee -a "${LOG_FILE}"
}

log "=== MSPAgent Silent Installation Log (Global Config) ==="
log "Started: $(date '+%Y-%m-%d %H:%M:%S')"
log "Log file: ${LOG_FILE}"
log "Running as: $(whoami)"
log "Config directory (global): ${CONFIG_DIR}"

# =============================================================================
# STEP 1: Parse Installation Parameters
# =============================================================================
log "=== STEP 1: Parsing Installation Parameters ==="

SITE_SECRET=""
DMG_URL=""

# Method 1: Command line arguments
if [ -n "$1" ]; then
    SITE_SECRET="$1"
    log "Site secret provided as argument 1"
fi

if [ -n "$2" ]; then
    DMG_URL="$2"
    log "DMG URL provided as argument 2"
fi

# Method 2: Environment variables (override command line)
if [ -n "${MSPAGENT_SITE_SECRET}" ]; then
    SITE_SECRET="${MSPAGENT_SITE_SECRET}"
    log "Site secret loaded from environment variable"
fi

if [ -n "${MSPAGENT_DMG_URL}" ]; then
    DMG_URL="${MSPAGENT_DMG_URL}"
    log "DMG URL loaded from environment variable"
fi

# Method 3: Config file
if [ -z "${SITE_SECRET}" ] && [ -f "/tmp/mspagent_config.json" ]; then
    log "Checking for config file: /tmp/mspagent_config.json"
    if command -v python3 &> /dev/null; then
        SITE_SECRET=$(python3 -c "import json; print(json.load(open('/tmp/mspagent_config.json'))['site_secret'])" 2>/dev/null || echo "")
        if [ -n "${SITE_SECRET}" ]; then
            log "Site secret loaded from config file"
        fi
        
        if [ -z "${DMG_URL}" ]; then
            DMG_URL=$(python3 -c "import json; print(json.load(open('/tmp/mspagent_config.json')).get('dmg_url', ''))" 2>/dev/null || echo "")
        fi
    fi
fi

# Validate required parameters
if [ -z "${SITE_SECRET}" ]; then
    log "ERROR: Missing required site secret"
    echo "ERROR: Site secret is required"
    echo "Provide via:"
    echo "  1. Argument: $0 'your-secret' 'dmg-url'"
    echo "  2. Environment: export MSPAGENT_SITE_SECRET='your-secret'"
    echo "  3. Config file: /tmp/mspagent_config.json"
    exit 1
fi

SECRET_LENGTH=${#SITE_SECRET}
log "Site secret validated (length: ${SECRET_LENGTH} characters)"
log "API host: ${API_HOST}"

# DMG URL is optional if DMG is already present
if [ -z "${DMG_URL}" ]; then
    log "No DMG URL provided - checking for local DMG"
    if [ ! -f "/tmp/${APP_NAME}.dmg" ]; then
        log "ERROR: No DMG found and no URL provided"
        echo "ERROR: Either provide DMG URL or place ${APP_NAME}.dmg in /tmp/"
        exit 1
    fi
    DMG_PATH="/tmp/${APP_NAME}.dmg"
    log "Using local DMG: ${DMG_PATH}"
else
    log "DMG URL: ${DMG_URL}"
    DMG_PATH="/tmp/${APP_NAME}.dmg"
fi

# =============================================================================
# STEP 2: Download DMG (if URL provided)
# =============================================================================
if [ -n "${DMG_URL}" ]; then
    log "=== STEP 2: Downloading DMG ==="
    log "Downloading from: ${DMG_URL}"
    log "Destination: ${DMG_PATH}"
    
    # Remove existing DMG if present
    if [ -f "${DMG_PATH}" ]; then
        rm -f "${DMG_PATH}"
        log "Removed existing DMG"
    fi
    
    # Download with curl
    if curl -L -o "${DMG_PATH}" "${DMG_URL}" 2>&1 | tee -a "${LOG_FILE}"; then
        log "Download completed successfully"
        
        # Verify file exists and has size
        if [ -f "${DMG_PATH}" ]; then
            FILE_SIZE=$(stat -f%z "${DMG_PATH}" 2>/dev/null || echo "0")
            log "DMG file size: ${FILE_SIZE} bytes"
            
            if [ "${FILE_SIZE}" -lt 1000000 ]; then
                log "ERROR: Downloaded file is too small (< 1MB), possibly corrupt"
                exit 1
            fi
        else
            log "ERROR: DMG file not found after download"
            exit 1
        fi
    else
        log "ERROR: Download failed"
        exit 1
    fi
else
    log "=== STEP 2: Using Local DMG ==="
fi

# =============================================================================
# STEP 3: Stop Running Application (All Users)
# =============================================================================
log "=== STEP 3: Stopping Running Application ==="

# Check if app is running for any user
if pgrep -x "${APP_NAME}" > /dev/null; then
    log "Application is running - stopping for all users"
    
    # Kill all instances
    pkill -9 "${APP_NAME}" || true
    sleep 2
    
    log "Application stopped"
else
    log "Application is not currently running"
fi

# Unload launch daemon if it exists
if [ -f "${LAUNCH_DAEMON_PLIST}" ]; then
    log "Unloading existing launch daemon"
    launchctl unload "${LAUNCH_DAEMON_PLIST}" 2>/dev/null || true
fi

# =============================================================================
# STEP 4: Mount DMG and Install Application
# =============================================================================
log "=== STEP 4: Installing Application ==="

# Unmount if already mounted
if [ -d "${MOUNT_POINT}" ]; then
    log "Unmounting existing volume"
    hdiutil detach "${MOUNT_POINT}" -force 2>&1 | tee -a "${LOG_FILE}" || true
fi

log "Mounting DMG: ${DMG_PATH}"
MOUNT_OUTPUT=$(hdiutil attach "${DMG_PATH}" -nobrowse -quiet 2>&1 | tee -a "${LOG_FILE}")

# Wait for mount
sleep 2

if [ ! -d "${MOUNT_POINT}" ]; then
    log "ERROR: DMG mount failed"
    echo "${MOUNT_OUTPUT}"
    exit 1
fi

log "DMG mounted successfully at: ${MOUNT_POINT}"

# Find the .app bundle in the mounted DMG
APP_IN_DMG=$(find "${MOUNT_POINT}" -maxdepth 2 -name "*.app" -type d | head -n 1)

if [ -z "${APP_IN_DMG}" ]; then
    log "ERROR: No .app bundle found in DMG"
    hdiutil detach "${MOUNT_POINT}" -force || true
    exit 1
fi

log "Found application: ${APP_IN_DMG}"

# Remove existing installation
if [ -d "${APP_PATH}" ]; then
    log "Removing existing installation"
    rm -rf "${APP_PATH}"
fi

# Copy application to /Applications
log "Copying application to /Applications"
cp -R "${APP_IN_DMG}" "${APP_PATH}"

if [ ! -d "${APP_PATH}" ]; then
    log "ERROR: Failed to copy application"
    hdiutil detach "${MOUNT_POINT}" -force || true
    exit 1
fi

log "Application installed successfully: ${APP_PATH}"

# Unmount DMG
log "Unmounting DMG"
hdiutil detach "${MOUNT_POINT}" -quiet 2>&1 | tee -a "${LOG_FILE}" || true

# Clean up downloaded DMG
if [ -f "${DMG_PATH}" ] && [ -n "${DMG_URL}" ]; then
    rm -f "${DMG_PATH}"
    log "Cleaned up downloaded DMG"
fi

# =============================================================================
# STEP 5: Setup Global Configuration Directory
# =============================================================================
log "=== STEP 5: Setting up Global Configuration Directory ==="
log "Target directory: ${CONFIG_DIR}"

# Create directory structure
mkdir -p "${CONFIG_DIR}"
mkdir -p "${LOG_DIR}"

# Set permissions - readable by all, writable by admin
chmod 755 "${CONFIG_DIR}"
chmod 755 "${LOG_DIR}"

log "Directory created successfully"

# Set extended permissions to ensure all users can read
# This makes the config globally accessible
log "Setting global read permissions"
chmod -R a+r "${CONFIG_DIR}"

# Ensure logs are writable by all (for runtime logging)
chmod 777 "${LOG_DIR}"
log "Logs directory made globally writable"

# =============================================================================
# STEP 6: Create Site Configuration
# =============================================================================
log "=== STEP 6: Creating Site Configuration ==="

SHOULD_CREATE_SETTINGS=true

# Check if settings.json already exists and has matching site_id
if [ -f "${SETTINGS_FILE}" ]; then
    log "Existing settings.json found - checking site_id"
    
    if command -v python3 &> /dev/null; then
        EXISTING_SITE_ID=$(python3 -c "import json; print(json.load(open('${SETTINGS_FILE}')).get('site_id', ''))" 2>/dev/null || echo "")
        
        if [ "${EXISTING_SITE_ID}" = "${SITE_SECRET}" ]; then
            log "site_id matches provided secret - keeping existing file"
            SHOULD_CREATE_SETTINGS=false
        else
            log "site_id differs from provided secret - will overwrite"
        fi
    else
        # Fallback to grep
        if grep -q "\"site_id\": \"${SITE_SECRET}\"" "${SETTINGS_FILE}"; then
            log "site_id matches provided secret - keeping existing file"
            SHOULD_CREATE_SETTINGS=false
        else
            log "site_id differs from provided secret - will overwrite"
        fi
    fi
fi

if [ "${SHOULD_CREATE_SETTINGS}" = true ]; then
    log "Creating new settings.json"
    
    INSTALL_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    log "Timestamp: ${INSTALL_TIMESTAMP}"
    
    # Create settings.json
    cat > "${SETTINGS_FILE}" << EOF
{
  "site_id": "${SITE_SECRET}",
  "api_host": "${API_HOST}",
  "show_tray": false,
  "installed_at": "${INSTALL_TIMESTAMP}"
}
EOF

    # Set permissions - readable by all users
    chmod 644 "${SETTINGS_FILE}"
    
    log "settings.json created successfully"
    
    # Verify file is readable
    if [ -r "${SETTINGS_FILE}" ]; then
        log "Verified settings.json is readable by all users"
    else
        log "WARNING: Could not verify settings.json is readable"
    fi
else
    log "Keeping existing settings.json"
fi

# Create runtime log file with global write permissions
RUNTIME_LOG="${LOG_DIR}/runtime_${APP_VERSION}.log"
touch "${RUNTIME_LOG}"
chmod 666 "${RUNTIME_LOG}"
log "Runtime log created with global write access: ${RUNTIME_LOG}"

# =============================================================================
# STEP 7: Configure Auto-Start for All Users (Launch Agent per user)
# =============================================================================
log "=== STEP 7: Configuring Auto-Start for All Users ==="

# Get list of all real users (UID >= 500, has home directory)
USERS=$(dscl . list /Users UniqueID | awk '$2 >= 500 {print $1}')

log "Found users: $(echo ${USERS} | tr '\n' ', ')"

for USERNAME in ${USERS}; do
    # Skip system users
    if [ "${USERNAME}" = "_" ] || [ "${USERNAME}" = "nobody" ]; then
        continue
    fi
    
    # Get user's home directory
    USER_HOME=$(dscl . read /Users/${USERNAME} NFSHomeDirectory | awk '{print $2}')
    
    if [ -z "${USER_HOME}" ] || [ ! -d "${USER_HOME}" ]; then
        log "Skipping ${USERNAME} - no valid home directory"
        continue
    fi
    
    LAUNCH_AGENT_DIR="${USER_HOME}/Library/LaunchAgents"
    LAUNCH_AGENT_PLIST="${LAUNCH_AGENT_DIR}/com.mspbyte.agent.plist"
    
    log "Setting up launch agent for user: ${USERNAME}"
    log "  Home: ${USER_HOME}"
    log "  LaunchAgent: ${LAUNCH_AGENT_PLIST}"
    
    # Create LaunchAgents directory if it doesn't exist
    mkdir -p "${LAUNCH_AGENT_DIR}"
    
    # Create LaunchAgent plist
    cat > "${LAUNCH_AGENT_PLIST}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mspbyte.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${APP_PATH}/Contents/MacOS/${APP_NAME}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchagent_${USERNAME}.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchagent_${USERNAME}.error.log</string>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
EOF

    # Set proper ownership and permissions
    chown "${USERNAME}:staff" "${LAUNCH_AGENT_PLIST}"
    chmod 644 "${LAUNCH_AGENT_PLIST}"
    
    # Fix ownership of LaunchAgents directory
    chown "${USERNAME}:staff" "${LAUNCH_AGENT_DIR}"
    
    log "  ✓ Launch agent created for ${USERNAME}"
    
    # Try to load the launch agent if user is logged in
    USER_UID=$(id -u "${USERNAME}" 2>/dev/null || echo "")
    if [ -n "${USER_UID}" ]; then
        # Check if user has an active GUI session
        if launchctl asuser "${USER_UID}" launchctl list 2>/dev/null | grep -q "com.apple.windowserver"; then
            log "  User ${USERNAME} is logged in - loading launch agent"
            launchctl asuser "${USER_UID}" sudo -u "${USERNAME}" launchctl load -w "${LAUNCH_AGENT_PLIST}" 2>&1 | tee -a "${LOG_FILE}" || {
                log "  Note: Launch agent will load on next login"
            }
        else
            log "  User ${USERNAME} not logged in - launch agent will load on next login"
        fi
    fi
done

log "Auto-start configured for all users"

# =============================================================================
# STEP 8: Verify Installation
# =============================================================================
log "=== STEP 8: Verifying Installation ==="

# Check if app exists
if [ -d "${APP_PATH}" ]; then
    log "✓ Application installed: ${APP_PATH}"
else
    log "✗ Application NOT found: ${APP_PATH}"
fi

# Check if config exists
if [ -f "${SETTINGS_FILE}" ]; then
    log "✓ Global configuration created: ${SETTINGS_FILE}"
    
    # Verify it's readable by checking permissions
    PERMS=$(ls -l "${SETTINGS_FILE}" | awk '{print $1}')
    log "  Permissions: ${PERMS}"
else
    log "✗ Configuration NOT found: ${SETTINGS_FILE}"
fi

# Check config directory permissions
CONFIG_PERMS=$(ls -ld "${CONFIG_DIR}" | awk '{print $1}')
log "Configuration directory permissions: ${CONFIG_PERMS}"

# Count launch agents installed
AGENT_COUNT=$(find /Users/*/Library/LaunchAgents -name "com.mspbyte.agent.plist" 2>/dev/null | wc -l | tr -d ' ')
log "✓ Launch agents installed for ${AGENT_COUNT} users"

# Check if app is running for any user
sleep 2
if pgrep -x "${APP_NAME}" > /dev/null; then
    RUNNING_COUNT=$(pgrep -x "${APP_NAME}" | wc -l | tr -d ' ')
    log "✓ Application is running (${RUNNING_COUNT} instances)"
else
    log "⚠ Application is not running (will start on next user login)"
fi

# =============================================================================
# STEP 9: Cleanup
# =============================================================================
log "=== STEP 9: Cleanup ==="

# Remove temporary config file if it exists
if [ -f "/tmp/mspagent_config.json" ]; then
    rm -f "/tmp/mspagent_config.json"
    log "Removed temporary config file"
fi

# =============================================================================
# Installation Complete
# =============================================================================
log "=== Installation completed successfully ==="
log "Configuration directory (global): ${CONFIG_DIR}"
log "Settings file: ${SETTINGS_FILE}"
log "Log directory: ${LOG_DIR}"
log "Application installed for all users"

echo ""
echo "✓ MSPAgent installed successfully for ALL USERS!"
echo ""
echo "Global Configuration: ${CONFIG_DIR}"
echo "Logs: ${LOG_DIR}"
echo "Launch agents installed: ${AGENT_COUNT} users"
echo ""
echo "The application will start automatically on login for all users."
echo "Config is globally accessible at: ${SETTINGS_FILE}"

exit 0