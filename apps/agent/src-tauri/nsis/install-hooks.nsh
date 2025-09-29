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
!include "AccessControl.nsh"

; Global variables
Var SiteSecret
Var ApiHost
Var InstallTimestamp
Var LogFile

!macro NSIS_HOOK_PREINSTALL
    ; Initialize log file
    StrCpy $LogFile "$TEMP\${APP_NAME}_install.log"
    FileOpen $9 $LogFile w
    FileWrite $9 "=== ${APP_NAME} Installation Log ===$\r$\n"
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $9 "Started: $2-$1-$0 $4:$5:$6$\r$\n$\r$\n"
    FileClose $9
    
    ; Set local vars
    StrCpy $ApiHost "https://agent.mspbyte.pro"

    ; Check for admin privileges
    Call CheckAdminPrivileges
    
    ; Parse and validate parameters
    Call ParseInstallParameters
    
    ; Setup ProgramData directory
    Call SetupProgramDataDirectory
    
    ; Create site configuration
    Call CreateSiteConfig
    
    ; Log completion
    FileOpen $9 $LogFile a
    FileWrite $9 "$\r$\nPre-install hook completed successfully$\r$\n"
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    FileWrite $9 "Completed: $2-$1-$0 $4:$5:$6$\r$\n"
    FileClose $9
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
    FileOpen $9 $LogFile a
    FileWrite $9 "Checking administrator privileges...$\r$\n"
    
    UserInfo::GetAccountType
    Pop $0
    ${If} $0 != "admin"
        FileWrite $9 "ERROR: Administrator privileges required$\r$\n"
        FileWrite $9 "Account type detected: $0$\r$\n"
        FileClose $9
        
        MessageBox MB_ICONSTOP "Administrator privileges required. Please run this installer as Administrator."
        SetErrorLevel 740
        Quit
    ${EndIf}
    
    FileWrite $9 "Administrator privileges confirmed$\r$\n"
    FileClose $9
FunctionEnd

; Function: Parse Install Parameters
Function ParseInstallParameters
    FileOpen $9 $LogFile a
    FileWrite $9 "Parsing command line parameters...$\r$\n"
    
    ${GetParameters} $R0
    FileWrite $9 "Raw parameters: $R0$\r$\n"
    
    ; Parse /secret parameter
    ${GetOptions} $R0 "/secret=" $SiteSecret
    
    ; Validate that secret was provided
    StrCmp $SiteSecret "" secret_missing secret_ok
    
    secret_missing:
        FileWrite $9 "ERROR: Missing required /secret parameter$\r$\n"
        FileWrite $9 "Usage: installer.exe /secret=YOUR_SITE_SECRET /api_host=https://your-api.com$\r$\n"
        FileClose $9
        
        MessageBox MB_ICONSTOP "Installation Error: Missing required /secret parameter.$\n$\nUsage: installer.exe /secret=YOUR_SITE_SECRET /api_host=https://your-api.com"
        SetErrorLevel 1
        Abort
    
    secret_ok:
        FileWrite $9 "Site secret parameter found$\r$\n"
        ; Don't log the actual secret for security
        StrLen $R1 $SiteSecret
        FileWrite $9 "Secret length: $R1 characters$\r$\n"
        
        ; Check if api_host was provided
        StrCmp $ApiHost "" api_host_missing api_host_ok
        
        api_host_missing:
            FileWrite $9 "ERROR: Missing required /api_host parameter$\r$\n"
            FileWrite $9 "Usage: installer.exe /secret=YOUR_SITE_SECRET /api_host=https://your-api.com$\r$\n"
            FileClose $9
            
            MessageBox MB_ICONSTOP "Installation Error: Missing required /api_host parameter.$\n$\nUsage: installer.exe /secret=YOUR_SITE_SECRET /api_host=https://your-api.com"
            SetErrorLevel 1
            Abort
        
        api_host_ok:
            FileWrite $9 "API host parameter found: $ApiHost$\r$\n"
            FileClose $9
FunctionEnd

; Function: Setup ProgramData Directory
Function SetupProgramDataDirectory
    FileOpen $9 $LogFile a
    FileWrite $9 "$\r$\nSetting up ProgramData directory...$\r$\n"
    FileWrite $9 "Target directory: $PROGRAMDATA\${CONFIG_DIR_NAME}$\r$\n"
    
    ; Create directory
    CreateDirectory "$PROGRAMDATA\${CONFIG_DIR_NAME}"
    FileWrite $9 "Directory created$\r$\n"
    
    ; Grant Users group full access
    FileWrite $9 "Setting permissions for Users (BU)...$\r$\n"
    AccessControl::GrantOnFile "$PROGRAMDATA\${CONFIG_DIR_NAME}" "(BU)" "FullAccess"
    Pop $0
    ${If} $0 == "ok"
        FileWrite $9 "Users permissions: SUCCESS$\r$\n"
    ${Else}
        FileWrite $9 "Users permissions: FAILED - $0$\r$\n"
        FileWrite $9 "WARNING: Non-admin users may not be able to write to configuration directory$\r$\n"
    ${EndIf}
    
    ; Grant Administrators full access
    FileWrite $9 "Setting permissions for Administrators (BA)...$\r$\n"
    AccessControl::GrantOnFile "$PROGRAMDATA\${CONFIG_DIR_NAME}" "(BA)" "FullAccess"
    Pop $0
    ${If} $0 == "ok"
        FileWrite $9 "Administrators permissions: SUCCESS$\r$\n"
    ${Else}
        FileWrite $9 "Administrators permissions: FAILED - $0$\r$\n"
    ${EndIf}
    
    ; Grant SYSTEM full access
    FileWrite $9 "Setting permissions for SYSTEM (SY)...$\r$\n"
    AccessControl::GrantOnFile "$PROGRAMDATA\${CONFIG_DIR_NAME}" "(SY)" "FullAccess"
    Pop $0
    ${If} $0 == "ok"
        FileWrite $9 "SYSTEM permissions: SUCCESS$\r$\n"
    ${Else}
        FileWrite $9 "SYSTEM permissions: FAILED - $0$\r$\n"
    ${EndIf}
    
    FileClose $9
FunctionEnd

; Function: Create Site Config
Function CreateSiteConfig
    FileOpen $9 $LogFile a
    FileWrite $9 "$\r$\nCreating site configuration file...$\r$\n"
    
    ; Get current timestamp
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
    StrCpy $InstallTimestamp "$2-$1-$0T$4:$5:$6Z"
    
    FileWrite $9 "Timestamp: $InstallTimestamp$\r$\n"
    FileWrite $9 "Creating: $PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json$\r$\n"
    FileClose $9
    
    ; Create settings.json with site_id and api_host
    FileOpen $8 "$PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" w
    FileWrite $8 '{$\r$\n'
    FileWrite $8 '  "site_id": "$SiteSecret",$\r$\n'
    FileWrite $8 '  "api_host": "$ApiHost",$\r$\n'
    FileWrite $8 '  "installed_at": "$InstallTimestamp"$\r$\n'
    FileWrite $8 '}'
    FileClose $8
    
    FileOpen $9 $LogFile a
    FileWrite $9 "settings.json created successfully$\r$\n"
    
    ; Set permissions on settings.json
    ; Users can read, only admins can write
    FileWrite $9 "Setting permissions on settings.json...$\r$\n"
    
    AccessControl::GrantOnFile "$PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" "(BU)" "GenericRead + GenericExecute"
    Pop $0
    FileWrite $9 "Users read permissions: $0$\r$\n"
    
    AccessControl::GrantOnFile "$PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" "(BA)" "FullAccess"
    Pop $0
    FileWrite $9 "Administrators full permissions: $0$\r$\n"
    
    ; Test if file is readable
    FileOpen $8 "$PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json" r
    IfErrors config_read_fail config_read_ok
    
    config_read_fail:
        FileWrite $9 "WARNING: Could not verify settings.json is readable$\r$\n"
        Goto config_test_done
    
    config_read_ok:
        FileClose $8
        FileWrite $9 "Verified settings.json is readable$\r$\n"
    
    config_test_done:
        FileClose $9
FunctionEnd

; Function: Check Remove Config Data (for uninstall)
Function un.CheckRemoveConfigData
    FileOpen $9 $LogFile a
    FileWrite $9 "Checking for configuration data...$\r$\n"
    
    ; Check if ProgramData directory exists
    ${If} ${FileExists} "$PROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
        FileWrite $9 "Configuration directory exists$\r$\n"
        FileWrite $9 "Listing files:$\r$\n"
        
        ; List files for logging
        ${If} ${FileExists} "$PROGRAMDATA\${CONFIG_DIR_NAME}\settings.json"
            FileWrite $9 "  - settings.json$\r$\n"
        ${EndIf}
        
        ; Remove all configuration data
        FileWrite $9 "Removing configuration directory...$\r$\n"
        RMDir /r "$PROGRAMDATA\${CONFIG_DIR_NAME}"
        
        ${If} ${FileExists} "$PROGRAMDATA\${CONFIG_DIR_NAME}\*.*"
            FileWrite $9 "WARNING: Some files could not be removed$\r$\n"
        ${Else}
            FileWrite $9 "Configuration directory removed successfully$\r$\n"
        ${EndIf}
    ${Else}
        FileWrite $9 "No configuration directory found$\r$\n"
    ${EndIf}
    
    FileClose $9
FunctionEnd