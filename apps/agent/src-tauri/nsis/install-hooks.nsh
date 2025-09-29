; =============================================================================
; Configuration Variables - Customize these for your application
; =============================================================================
!define APP_NAME "MSPAgent"
!define APP_COMPANY "MSPByte"
!define CONFIG_DIR_NAME "MSPAgent"  ; Folder name in ProgramData

; =============================================================================
; Tauri NSIS Hook - Pre-Install
; This runs before Tauri's main installation logic
; =============================================================================

!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"

; Insert function declarations
!insertmacro GetTime
!insertmacro GetParameters
!insertmacro GetOptions

; Global variables
Var SiteSecret
Var ApiHost
Var InstallTimestamp
Var LogFile

; Robust logging function - always writes and flushes immediately
Function LogWrite
    ; Input: $R9 = message to log
    ; Uses: $R8 = temp file handle
    Push $R8

    ; Always try to log, ignore errors
    ClearErrors
    FileOpen $R8 $LogFile a
    IfErrors log_skip 0

    ; Get timestamp for each log entry
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $R8 "[$4:$5:$6] $R9$\r$\n"
    FileClose $R8

    log_skip:
    Pop $R8
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
    ; Initialize log file with unique timestamp
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    StrCpy $LogFile "$TEMP\${APP_NAME}_install_$2$1$0_$4$5$6.log"

    ; Create initial log file
    FileOpen $9 $LogFile w
    FileWrite $9 ""
    FileClose $9

    ; Log startup
    StrCpy $R9 "=== ${APP_NAME} Installation Log ==="
    Call LogWrite
    StrCpy $R9 "Started: $2-$1-$0 $4:$5:$6"
    Call LogWrite
    StrCpy $R9 "Log file: $LogFile"
    Call LogWrite
    StrCpy $R9 "Install mode: perMachine"
    Call LogWrite

    ; Set local vars
    StrCpy $ApiHost "https://agent.mspbyte.pro"
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
    ; Log post-install
    FileOpen $9 $LogFile a
    FileWrite $9 "$\r$\n=== Post-Install ===$\r$\n"
    FileWrite $9 "Application installed successfully$\r$\n"
    FileWrite $9 "Installation directory: $INSTDIR$\r$\n"
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $9 "Finished: $2-$1-$0 $4:$5:$6$\r$\n"
    FileClose $9
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    ; Log uninstall start
    StrCpy $LogFile "$TEMP\${APP_NAME}_uninstall.log"
    FileOpen $9 $LogFile w
    FileWrite $9 "=== ${APP_NAME} Uninstallation Log ===$\r$\n"
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $9 "Started: $2-$1-$0 $4:$5:$6$\r$\n$\r$\n"
    FileClose $9
    
    ; Check if we should remove configuration data
    Call un.CheckRemoveConfigData
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
    ; Log uninstall completion
    FileOpen $9 $LogFile a
    FileWrite $9 "$\r$\nUninstallation completed$\r$\n"
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $9 "Finished: $2-$1-$0 $4:$5:$6$\r$\n"
    FileClose $9
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
FunctionEnd

; Function: Create Site Config
Function CreateSiteConfig
    StrCpy $R9 "Creating site configuration file"
    Call LogWrite

    ; Get current timestamp
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    StrCpy $InstallTimestamp "$2-$1-$0T$4:$5:$6Z"
    StrCpy $R9 "Timestamp: $InstallTimestamp"
    Call LogWrite

    ; Expand the path for logging
    StrCpy $R0 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
    StrCpy $R9 "Creating: $R0"
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

; Function: Check Remove Config Data (for uninstall)
Function un.CheckRemoveConfigData
    FileOpen $9 $LogFile a
    FileWrite $9 "Checking for configuration data...$\r$\n"
    
    ; Check if ProgramData directory exists
    ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
        FileWrite $9 "Configuration directory exists$\r$\n"
        FileWrite $9 "Listing files:$\r$\n"
        
        ; List files for logging
        ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
            FileWrite $9 "  - settings.json$\r$\n"
        ${EndIf}
        
        ; Remove all configuration data
        FileWrite $9 "Removing configuration directory...$\r$\n"
        RMDir /r "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}"
        
        ${If} ${FileExists} "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
            FileWrite $9 "WARNING: Some files could not be removed$\r$\n"
        ${Else}
            FileWrite $9 "Configuration directory removed successfully$\r$\n"
        ${EndIf}
    ${Else}
        FileWrite $9 "No configuration directory found$\r$\n"
    ${EndIf}
    
    FileClose $9
FunctionEnd