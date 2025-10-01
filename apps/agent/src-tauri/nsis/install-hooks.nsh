; =============================================================================
; Configuration Variables - Customize these for your application
; =============================================================================
!define APP_NAME "MSPAgent"
!define APP_COMPANY "MSPByte"
!define CONFIG_DIR_NAME "MSPAgent"  ; Folder name in ProgramData
!define APP_VERSION "0.1.3"
!define API_HOST "https://agent.mspbyte.pro"

; =============================================================================
; Tauri NSIS Hook - Pre-Install
; This runs before Tauri's main installation logic
; =============================================================================

!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "StrFunc.nsh"

; Insert function declarations
!insertmacro GetTime
!insertmacro GetParameters
!insertmacro GetOptions
${StrRep}
${StrStr}

; Global variables
Var SiteSecret
Var ApiHost
Var InstallTimestamp
Var LogFile

; PowerShell-based logging function - simple and reliable
Function LogWrite
    ; Input: $R9 = message to log
    Push $R8
    Push $R7

    ; Create a temporary PowerShell script file
    StrCpy $R7 "$TEMP\nsis_log_$$.ps1"
    FileOpen $R8 $R7 w
    FileWrite $R8 '$$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"$\r$\n'
    FileWrite $R8 '$$logPath = "$LogFile"$\r$\n'
    FileWrite $R8 '$$message = "[$timestamp] $R9"$\r$\n'
    FileWrite $R8 'Add-Content -Path $$logPath -Value $$message -Encoding UTF8 -Force$\r$\n'
    FileWrite $R8 'Write-Host "LOGGED: $$message"$\r$\n'
    FileClose $R8

    ; Execute the PowerShell script
    nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$R7"'
    Pop $R8  ; Exit code
    Pop $R8  ; Output

    ; Clean up the temporary script
    Delete $R7

    Pop $R7
    Pop $R8
FunctionEnd

; Uninstaller version of LogWrite function
Function un.LogWrite
    ; Input: $R9 = message to log
    Push $R8
    Push $R7

    ; Create a temporary PowerShell script file
    StrCpy $R7 "$TEMP\nsis_log_$$.ps1"
    FileOpen $R8 $R7 w
    FileWrite $R8 '$$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"$\r$\n'
    FileWrite $R8 '$$logPath = "$LogFile"$\r$\n'
    FileWrite $R8 '$$message = "[$timestamp] $R9"$\r$\n'
    FileWrite $R8 'Add-Content -Path $$logPath -Value $$message -Encoding UTF8 -Force$\r$\n'
    FileWrite $R8 'Write-Host "LOGGED: $$message"$\r$\n'
    FileClose $R8

    ; Execute the PowerShell script
    nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$R7"'
    Pop $R8  ; Exit code
    Pop $R8  ; Output

    ; Clean up the temporary script
    Delete $R7

    Pop $R7
    Pop $R8
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
    ; Initialize log file with unique timestamp in ProgramData
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6

    ; Create logs directory first
    CreateDirectory "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    CreateDirectory "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs"

    StrCpy $LogFile "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs\install_${APP_VERSION}.log"

    ; Initialize log file with header using simple file operations
    FileOpen $9 $LogFile w
    FileWrite $9 "=== MSPAgent Installation Log ===$\r$\n"
    FileClose $9

    ; Log startup information
    StrCpy $R9 "Started: $2-$1-$0 $4:$5:$6"
    Call LogWrite
    StrCpy $R9 "Log file: $LogFile"
    Call LogWrite
    StrCpy $R9 "Install mode: perMachine"
    Call LogWrite

    ; Set local vars
    StrCpy $ApiHost "${API_HOST}"
    StrCpy $R9 "API Host set to: $ApiHost"
    Call LogWrite

    StrCpy $R9 "=== STEP 1: Checking Admin Privileges ==="
    Call LogWrite

    ; Check for admin privileges
    Call CheckAdminPrivileges

    StrCpy $R9 "=== STEP 2: Parsing Install Parameters ==="
    Call LogWrite

    ; Parse and validate parameters
    Call ParseInstallParameters

    StrCpy $R9 "=== STEP 3: Setting up ProgramData Directory ==="
    Call LogWrite

    ; Setup ProgramData directory
    Call SetupProgramDataDirectory

    StrCpy $R9 "=== STEP 4: Creating Site Configuration ==="
    Call LogWrite

    ; Create site configuration
    Call CreateSiteConfig
    
    ; Log completion
    StrCpy $R9 "Pre-install hook completed successfully"
    Call LogWrite
!macroend

!macro NSIS_HOOK_POSTINSTALL
    StrCpy $R9 "=== POST-INSTALL: Installation completed ==="
    Call LogWrite
    
    ; Check if we're in silent mode (RMM deployment)
    ${If} ${Silent}
        StrCpy $R9 "Silent install detected - checking for logged-in users"
        Call LogWrite
        
        ; Check if explorer.exe is running (means user is logged in)
        ClearErrors
        nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq explorer.exe" /NH'
        Pop $0 ; return code
        Pop $1 ; output
        
        ; Simple check: if return code is 0, explorer was found
        ${If} $0 == 0
            StrCpy $R9 "User detected - creating scheduled task to launch app"
            Call LogWrite
            
            ; Create a one-time scheduled task that runs immediately as the interactive user
            ; /RU INTERACTIVE runs as the logged-in user
            ; /IT allows interaction with desktop
            ; /V1 uses old task scheduler format for better compatibility
            nsExec::ExecToLog 'schtasks /Create /F /TN "Launch_${APP_NAME}_Once" /TR "\"$INSTDIR\${APP_NAME}.exe\"" /SC ONCE /ST 00:00 /RU INTERACTIVE /IT /V1'
            Pop $0
            
            ${If} $0 == 0
                StrCpy $R9 "Task created successfully, running now..."
                Call LogWrite
                
                ; Run the task immediately
                nsExec::ExecToLog 'schtasks /Run /TN "Launch_${APP_NAME}_Once"'
                Pop $0
                
                ; Wait a moment for the app to launch
                Sleep 2000
                
                ; Delete the task
                nsExec::ExecToLog 'schtasks /Delete /TN "Launch_${APP_NAME}_Once" /F'
                
                StrCpy $R9 "Application launched via scheduled task"
                Call LogWrite
            ${Else}
                StrCpy $R9 "WARNING: Failed to create scheduled task"
                Call LogWrite
            ${EndIf}
        ${Else}
            StrCpy $R9 "No user logged in - skipping auto-launch"
            Call LogWrite
        ${EndIf}
    ${Else}
        ; Interactive install - launch normally
        StrCpy $R9 "Interactive install - launching application directly"
        Call LogWrite
        
        ${If} ${FileExists} "$INSTDIR\${APP_NAME}.exe"
            ClearErrors
            Exec '"$INSTDIR\${APP_NAME}.exe"'
            
            ${If} ${Errors}
                StrCpy $R9 "WARNING: Failed to launch application"
                Call LogWrite
            ${Else}
                StrCpy $R9 "Application launched successfully"
                Call LogWrite
            ${EndIf}
        ${Else}
            StrCpy $R9 "WARNING: Application executable not found"
            Call LogWrite
        ${EndIf}
    ${EndIf}

    StrCpy $R9 "Post-install hook completed"
    Call LogWrite
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    ; Initialize uninstall log file with unique timestamp in ProgramData
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6

    ; Ensure logs directory exists (it should from install, but just in case)
    CreateDirectory "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    CreateDirectory "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs"

    StrCpy $LogFile "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs\uninstall_${APP_VERSION}.log"

    ; Initialize log file with header using simple file operations
    FileOpen $9 $LogFile w
    FileWrite $9 "=== ${APP_NAME} Uninstallation Log ===$\r$\n"
    FileClose $9

    ; Log startup information
    StrCpy $R9 "Started: $2-$1-$0 $4:$5:$6"
    Call un.LogWrite
    StrCpy $R9 "Log file: $LogFile"
    Call un.LogWrite
    StrCpy $R9 "Uninstall mode: perMachine"
    Call un.LogWrite

    StrCpy $R9 "=== STEP 1: Checking Configuration Data ==="
    Call un.LogWrite

    ; Check if we should remove configuration data
    Call un.CheckRemoveConfigData

    ; Log completion
    StrCpy $R9 "Pre-uninstall hook completed successfully"
    Call un.LogWrite
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
!macroend

; Function: Check Admin Privileges
Function CheckAdminPrivileges
    StrCpy $R9 "Starting admin privileges check"
    Call LogWrite

    ; Try to write to a system directory to test admin privileges
    ClearErrors
    CreateDirectory "$WINDIR\temp\nsis_admin_test"
    ${If} ${Errors}
        StrCpy $R9 "System directory write test: FAILED"
        Call LogWrite

        ; Also test ProgramData access directly
        ClearErrors
        CreateDirectory "$COMMONPROGRAMDATA\nsis_test"
        ${If} ${Errors}
            StrCpy $R9 "ProgramData write test: FAILED"
            Call LogWrite
        ${Else}
            RMDir "$COMMONPROGRAMDATA\nsis_test"
            StrCpy $R9 "ProgramData write test: SUCCESS (but WINDIR failed)"
            Call LogWrite
        ${EndIf}

        ; Try UserInfo plugin
        UserInfo::GetAccountType
        Pop $0
        StrCpy $R9 "UserInfo::GetAccountType returned: '$0'"
        Call LogWrite

        ; Check for various admin account types
        ${If} $0 != "Admin"
        ${AndIf} $0 != "admin"
        ${AndIf} $0 != "Administrator"
            StrCpy $R9 "ERROR: Administrator privileges required - Account: '$0'"
            Call LogWrite

            SetErrorLevel 740
            Quit
        ${Else}
            StrCpy $R9 "UserInfo indicates admin privileges available"
            Call LogWrite
        ${EndIf}
    ${Else}
        ; Clean up test directory
        RMDir "$WINDIR\temp\nsis_admin_test"
        StrCpy $R9 "System directory write test: SUCCESS"
        Call LogWrite
    ${EndIf}

    StrCpy $R9 "Administrator privileges confirmed"
    Call LogWrite
FunctionEnd

; Function: Parse Install Parameters
Function ParseInstallParameters
    StrCpy $R9 "Parsing command line parameters"
    Call LogWrite

    ${GetParameters} $R0
    StrCpy $R9 "Raw parameters: $R0"
    Call LogWrite

    ; Parse /secret parameter
    ${GetOptions} $R0 "/secret=" $SiteSecret

    ; Validate that secret was provided
    ${If} $SiteSecret == ""
        StrCpy $R9 "ERROR: Missing required /secret parameter"
        Call LogWrite

        SetErrorLevel 1
        Abort
    ${EndIf}

    StrCpy $R9 "Site secret parameter found"
    Call LogWrite

    ; Don't log the actual secret for security
    StrLen $R1 $SiteSecret
    StrCpy $R9 "Secret length: $R1 characters"
    Call LogWrite
    StrCpy $R9 "API host: $ApiHost"
    Call LogWrite
FunctionEnd

; Function: Setup ProgramData Directory
Function SetupProgramDataDirectory
    StrCpy $R9 "Setting up ProgramData directory"
    Call LogWrite

    ; Expand the path for logging
    StrCpy $R0 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    StrCpy $R9 "Target directory: $R0"
    Call LogWrite

    ; Create directory
    ClearErrors
    CreateDirectory "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    ${If} ${Errors}
        StrCpy $R9 "ERROR: Failed to create directory - insufficient privileges"
        Call LogWrite

        SetErrorLevel 5
        Abort
    ${EndIf}

    StrCpy $R9 "Directory created successfully"
    Call LogWrite
    
    ; Set permissions using icacls (built-in Windows command)
    StrCpy $R9 "Setting permissions using icacls"
    Call LogWrite

    ; Grant Users full control
    StrCpy $R0 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    StrCpy $R9 "Attempting to set Users permissions on: $R0"
    Call LogWrite

    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}" /grant Users:(OI)(CI)F /T'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "Users permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "Users permissions: FAILED (exit code: $0)"
        Call LogWrite
        ; icacls exit code 3 = access denied, 1 = general error
        ${If} $0 == 3
            StrCpy $R9 "  - Access denied (code 3) - insufficient privileges"
            Call LogWrite
        ${ElseIf} $0 == 1
            StrCpy $R9 "  - General error (code 1) - invalid path or syntax"
            Call LogWrite
        ${EndIf}
    ${EndIf}

    ; Grant Administrators full control
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}" /grant Administrators:(OI)(CI)F /T'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "Administrators permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "Administrators permissions: FAILED (exit code: $0)"
        Call LogWrite
    ${EndIf}

    ; Grant SYSTEM full control
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}" /grant SYSTEM:(OI)(CI)F /T'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "SYSTEM permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "SYSTEM permissions: FAILED (exit code: $0)"
        Call LogWrite
    ${EndIf}

    ; Set specific permissions for logs directory - make it fully writable by all users
    StrCpy $R9 "Setting permissions for logs directory"
    Call LogWrite

    ; Grant Users full control to logs directory specifically for runtime logging
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs" /grant Users:(OI)(CI)F /T'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "Logs directory Users permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "Logs directory Users permissions: FAILED (exit code: $0)"
        Call LogWrite
    ${EndIf}

    ; Grant Administrators full control to logs directory
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs" /grant Administrators:(OI)(CI)F /T'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "Logs directory Administrators permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "Logs directory Administrators permissions: FAILED (exit code: $0)"
        Call LogWrite
    ${EndIf}

    ; Create runtime log files with open permissions
    StrCpy $R9 "Creating runtime log files with open permissions"
    Call LogWrite

    FileOpen $8 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs\runtime_${APP_VERSION}.log" w
    FileWrite $8 "=== MSPAgent Runtime Log ===$\r$\n"
    FileClose $8

    ; Set permissions on runtime log file to allow Users to write
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs\runtime_${APP_VERSION}.log" /grant Users:(M)'
    Pop $0
    ${If} $0 == 0
        StrCpy $R9 "Runtime log file Users permissions: SUCCESS"
        Call LogWrite
    ${Else}
        StrCpy $R9 "Runtime log file Users permissions: FAILED (exit code: $0)"
        Call LogWrite
    ${EndIf}
FunctionEnd

; Function: Create Site Config
Function CreateSiteConfig
    StrCpy $R9 "Creating site configuration file"
    Call LogWrite

    ; Expand the path for logging
    StrCpy $R0 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
    StrCpy $R9 "Checking for existing config: $R0"
    Call LogWrite

    ; Check if settings.json already exists
    ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
        StrCpy $R9 "Existing settings.json found - checking site_id"
        Call LogWrite

        ; Read the existing file and check site_id
        ClearErrors
        FileOpen $8 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" r
        ${If} ${Errors}
            StrCpy $R9 "WARNING: Could not read existing settings.json"
            Call LogWrite
        ${Else}
            ; Read file content
            StrCpy $R1 ""
            ${DoUntil} ${Errors}
                FileRead $8 $R2
                ${If} ${Errors}
                    ${ExitDo}
                ${EndIf}
                StrCpy $R1 "$R1$R2"
            ${Loop}
            FileClose $8

            ; Check if the content contains our site_id
            Push $R1
            Push '"site_id": "$SiteSecret"'
            Call StrStrCheck
            Pop $R3

            ${If} $R3 != ""
                StrCpy $R9 "site_id matches provided secret - keeping existing file"
                Call LogWrite
                Return  ; Exit without overwriting
            ${Else}
                StrCpy $R9 "site_id differs from provided secret - will overwrite"
                Call LogWrite
            ${EndIf}
        ${EndIf}
    ${Else}
        StrCpy $R9 "No existing settings.json found"
        Call LogWrite
    ${EndIf}

    ; Get current timestamp
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    StrCpy $InstallTimestamp "$2-$1-$0T$4:$5:$6Z"
    StrCpy $R9 "Timestamp: $InstallTimestamp"
    Call LogWrite

    StrCpy $R9 "Creating new settings.json"
    Call LogWrite

    ; Create settings.json with site_id and api_host
    ClearErrors
    FileOpen $8 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" w
    ${If} ${Errors}
        StrCpy $R9 "ERROR: Could not create settings.json"
        Call LogWrite

        SetErrorLevel 6
        Abort
    ${EndIf}

    FileWrite $8 '{$\r$\n'
    FileWrite $8 '  "site_id": "$SiteSecret",$\r$\n'
    FileWrite $8 '  "api_host": "$ApiHost",$\r$\n'
    FileWrite $8 '  "installed_at": "$InstallTimestamp"$\r$\n'
    FileWrite $8 '}'
    FileClose $8

    StrCpy $R9 "settings.json created successfully"
    Call LogWrite
    
    ; Set permissions on settings.json using icacls
    StrCpy $R9 "Setting permissions on settings.json"
    Call LogWrite

    ; Grant Users read permissions
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" /grant Users:R'
    Pop $0
    StrCpy $R9 "Users read permissions: exit code $0"
    Call LogWrite

    ; Grant Administrators full control
    nsExec::ExecToLog 'icacls "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" /grant Administrators:F'
    Pop $0
    StrCpy $R9 "Administrators full permissions: exit code $0"
    Call LogWrite

    ; Test if file is readable
    ClearErrors
    FileOpen $8 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" r
    ${If} ${Errors}
        StrCpy $R9 "WARNING: Could not verify settings.json is readable"
        Call LogWrite
    ${Else}
        FileClose $8
        StrCpy $R9 "Verified settings.json is readable"
        Call LogWrite
    ${EndIf}
FunctionEnd

; Helper function to check if string contains substring
Function StrStrCheck
    Exch $R0 ; needle
    Exch
    Exch $R1 ; haystack
    Push $R2
    Push $R3
    
    StrCpy $R2 0
    StrLen $R3 $R0
    
    ${DoUntil} $R2 > 10000  ; Safety limit
        StrCpy $R4 $R1 $R3 $R2
        ${If} $R4 == $R0
            StrCpy $R0 "found"
            ${ExitDo}
        ${EndIf}
        ${If} $R4 == ""
            StrCpy $R0 ""
            ${ExitDo}
        ${EndIf}
        IntOp $R2 $R2 + 1
    ${Loop}
    
    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

; Function: Check Remove Config Data (for uninstall)
Function un.CheckRemoveConfigData
    StrCpy $R9 "Checking for configuration data"
    Call un.LogWrite

    ; Expand the path for logging
    StrCpy $R0 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
    StrCpy $R9 "Looking for config directory: $R0"
    Call un.LogWrite

    ; Check if ProgramData directory exists
    ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
        StrCpy $R9 "Configuration directory exists"
        Call un.LogWrite
        StrCpy $R9 "Listing files:"
        Call un.LogWrite

        ; List files for logging
        ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
            StrCpy $R9 "  - settings.json"
            Call un.LogWrite
        ${EndIf}

        ; Remove all configuration data
        StrCpy $R9 "Removing configuration directory..."
        Call un.LogWrite
        RMDir /r "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"

        ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
            StrCpy $R9 "WARNING: Some files could not be removed"
            Call un.LogWrite
        ${Else}
            StrCpy $R9 "Configuration directory removed successfully"
            Call un.LogWrite
        ${EndIf}
    ${Else}
        StrCpy $R9 "No configuration directory found"
        Call un.LogWrite
    ${EndIf}
FunctionEnd