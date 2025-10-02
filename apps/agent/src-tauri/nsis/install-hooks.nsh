; =============================================================================
; Configuration Variables - Customize these for your application
; =============================================================================
!define APP_NAME "MSPAgent"
!define APP_COMPANY "MSPByte"
!define CONFIG_DIR_NAME "MSPAgent"  ; Folder name in ProgramData
!define APP_VERSION "0.1.7"
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

    ; Log startup information (LogWrite will create the file)
    StrCpy $R9 "=== MSPAgent Installation Log ==="
    Call LogWrite
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
        StrCpy $R9 "Silent install detected - attempting to launch for logged-in users"
        Call LogWrite

        ; Create PowerShell script to launch app for all active user sessions
        StrCpy $R7 "$TEMP\launch_${APP_NAME}_$$.ps1"
        FileOpen $R8 $R7 w
        FileWrite $R8 '# Launch application for all active user sessions$\r$\n'
        FileWrite $R8 'Add-Type -TypeDefinition @"$\r$\n'
        FileWrite $R8 'using System;$\r$\n'
        FileWrite $R8 'using System.Runtime.InteropServices;$\r$\n'
        FileWrite $R8 'public class ProcessStarter {$\r$\n'
        FileWrite $R8 '    [DllImport("wtsapi32.dll", SetLastError = true)]$\r$\n'
        FileWrite $R8 '    public static extern bool WTSQueryUserToken(int sessionId, out IntPtr token);$\r$\n'
        FileWrite $R8 '    [DllImport("advapi32.dll", SetLastError = true)]$\r$\n'
        FileWrite $R8 '    public static extern bool DuplicateTokenEx(IntPtr hExistingToken, uint dwDesiredAccess,$\r$\n'
        FileWrite $R8 '        IntPtr lpTokenAttributes, int ImpersonationLevel, int TokenType, out IntPtr phNewToken);$\r$\n'
        FileWrite $R8 '    [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Auto)]$\r$\n'
        FileWrite $R8 '    public static extern bool CreateProcessAsUser(IntPtr hToken, string lpApplicationName,$\r$\n'
        FileWrite $R8 '        string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes,$\r$\n'
        FileWrite $R8 '        bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment,$\r$\n'
        FileWrite $R8 '        string lpCurrentDirectory, ref STARTUPINFO lpStartupInfo,$\r$\n'
        FileWrite $R8 '        out PROCESS_INFORMATION lpProcessInformation);$\r$\n'
        FileWrite $R8 '    [DllImport("userenv.dll", SetLastError = true)]$\r$\n'
        FileWrite $R8 '    public static extern bool CreateEnvironmentBlock(out IntPtr lpEnvironment, IntPtr hToken, bool bInherit);$\r$\n'
        FileWrite $R8 '    [DllImport("userenv.dll", SetLastError = true)]$\r$\n'
        FileWrite $R8 '    public static extern bool DestroyEnvironmentBlock(IntPtr lpEnvironment);$\r$\n'
        FileWrite $R8 '    [DllImport("kernel32.dll", SetLastError = true)]$\r$\n'
        FileWrite $R8 '    public static extern bool CloseHandle(IntPtr hObject);$\r$\n'
        FileWrite $R8 '    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]$\r$\n'
        FileWrite $R8 '    public struct STARTUPINFO {$\r$\n'
        FileWrite $R8 '        public int cb; public IntPtr lpReserved; public IntPtr lpDesktop;$\r$\n'
        FileWrite $R8 '        public IntPtr lpTitle; public int dwX; public int dwY;$\r$\n'
        FileWrite $R8 '        public int dwXSize; public int dwYSize; public int dwXCountChars;$\r$\n'
        FileWrite $R8 '        public int dwYCountChars; public int dwFillAttribute; public int dwFlags;$\r$\n'
        FileWrite $R8 '        public short wShowWindow; public short cbReserved2;$\r$\n'
        FileWrite $R8 '        public IntPtr lpReserved2; public IntPtr hStdInput;$\r$\n'
        FileWrite $R8 '        public IntPtr hStdOutput; public IntPtr hStdError;$\r$\n'
        FileWrite $R8 '    }$\r$\n'
        FileWrite $R8 '    [StructLayout(LayoutKind.Sequential)]$\r$\n'
        FileWrite $R8 '    public struct PROCESS_INFORMATION {$\r$\n'
        FileWrite $R8 '        public IntPtr hProcess; public IntPtr hThread;$\r$\n'
        FileWrite $R8 '        public int dwProcessId; public int dwThreadId;$\r$\n'
        FileWrite $R8 '    }$\r$\n'
        FileWrite $R8 '}$\r$\n'
        FileWrite $R8 '"@$\r$\n'
        FileWrite $R8 '$\r$\n'
        FileWrite $R8 '$$launchedAny = $$false$\r$\n'
        FileWrite $R8 'try {$\r$\n'
        FileWrite $R8 '    $$sessions = Get-Process -Name explorer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty SessionId -Unique$\r$\n'
        FileWrite $R8 '    $\r$\n'
        FileWrite $R8 '    if ($$sessions) {$\r$\n'
        FileWrite $R8 '        Write-Host "Found $$($$sessions.Count) active session(s): $$sessions"$\r$\n'
        FileWrite $R8 '        foreach ($$sessionId in $$sessions) {$\r$\n'
        FileWrite $R8 '            Write-Host "Launching for session $$sessionId..."$\r$\n'
        FileWrite $R8 '            $$userToken = [IntPtr]::Zero$\r$\n'
        FileWrite $R8 '            $$dupToken = [IntPtr]::Zero$\r$\n'
        FileWrite $R8 '            $$envBlock = [IntPtr]::Zero$\r$\n'
        FileWrite $R8 '            try {$\r$\n'
        FileWrite $R8 '                if (![ProcessStarter]::WTSQueryUserToken($$sessionId, [ref]$$userToken)) {$\r$\n'
        FileWrite $R8 '                    $$errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()$\r$\n'
        FileWrite $R8 '                    Write-Host "Failed to get user token (Error: $$errorCode)"$\r$\n'
        FileWrite $R8 '                    if ($$errorCode -eq 1314) {$\r$\n'
        FileWrite $R8 '                        Write-Host "Error 1314: SE_TCB_NAME privilege required (only SYSTEM has this)"$\r$\n'
        FileWrite $R8 '                    }$\r$\n'
        FileWrite $R8 '                    continue$\r$\n'
        FileWrite $R8 '                }$\r$\n'
        FileWrite $R8 '                # TOKEN_DUPLICATE=2, TOKEN_QUERY=8, TOKEN_ASSIGN_PRIMARY=1, TOKEN_ADJUST_PRIVILEGES=32$\r$\n'
        FileWrite $R8 '                $$TOKEN_ALL_ACCESS = 0xF01FF$\r$\n'
        FileWrite $R8 '                if (![ProcessStarter]::DuplicateTokenEx($$userToken, $$TOKEN_ALL_ACCESS, [IntPtr]::Zero, 2, 1, [ref]$$dupToken)) {$\r$\n'
        FileWrite $R8 '                    Write-Host "Failed to duplicate token (Error: $$([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"$\r$\n'
        FileWrite $R8 '                    continue$\r$\n'
        FileWrite $R8 '                }$\r$\n'
        FileWrite $R8 '                if (![ProcessStarter]::CreateEnvironmentBlock([ref]$$envBlock, $$dupToken, $$false)) {$\r$\n'
        FileWrite $R8 '                    Write-Host "Failed to create environment block (Error: $$([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"$\r$\n'
        FileWrite $R8 '                    continue$\r$\n'
        FileWrite $R8 '                }$\r$\n'
        FileWrite $R8 '                $$si = New-Object ProcessStarter+STARTUPINFO$\r$\n'
        FileWrite $R8 '                $$si.cb = [Runtime.InteropServices.Marshal]::SizeOf($$si)$\r$\n'
        FileWrite $R8 '                $$si.lpDesktop = [Runtime.InteropServices.Marshal]::StringToHGlobalUni("winsta0\default")$\r$\n'
        FileWrite $R8 '                $$pi = New-Object ProcessStarter+PROCESS_INFORMATION$\r$\n'
        FileWrite $R8 '                # CREATE_UNICODE_ENVIRONMENT=0x400, CREATE_NO_WINDOW=0x08000000, NORMAL_PRIORITY_CLASS=0x20$\r$\n'
        FileWrite $R8 '                $$flags = 0x400$\r$\n'
        FileWrite $R8 '                $$result = [ProcessStarter]::CreateProcessAsUser($$dupToken, "$INSTDIR\${APP_NAME}.exe",$\r$\n'
        FileWrite $R8 '                    $$null, [IntPtr]::Zero, [IntPtr]::Zero, $$false, $$flags, $$envBlock,$\r$\n'
        FileWrite $R8 '                    "$INSTDIR", [ref]$$si, [ref]$$pi)$\r$\n'
        FileWrite $R8 '                if ($$result) {$\r$\n'
        FileWrite $R8 '                    Write-Host "Successfully launched for session $$sessionId (PID: $$($$pi.dwProcessId))"$\r$\n'
        FileWrite $R8 '                    $$launchedAny = $$true$\r$\n'
        FileWrite $R8 '                    [ProcessStarter]::CloseHandle($$pi.hProcess)$\r$\n'
        FileWrite $R8 '                    [ProcessStarter]::CloseHandle($$pi.hThread)$\r$\n'
        FileWrite $R8 '                } else {$\r$\n'
        FileWrite $R8 '                    Write-Host "Failed to launch (Error: $$([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"$\r$\n'
        FileWrite $R8 '                }$\r$\n'
        FileWrite $R8 '            } finally {$\r$\n'
        FileWrite $R8 '                if ($$envBlock -ne [IntPtr]::Zero) { [ProcessStarter]::DestroyEnvironmentBlock($$envBlock) }$\r$\n'
        FileWrite $R8 '                if ($$dupToken -ne [IntPtr]::Zero) { [ProcessStarter]::CloseHandle($$dupToken) }$\r$\n'
        FileWrite $R8 '                if ($$userToken -ne [IntPtr]::Zero) { [ProcessStarter]::CloseHandle($$userToken) }$\r$\n'
        FileWrite $R8 '            }$\r$\n'
        FileWrite $R8 '        }$\r$\n'
        FileWrite $R8 '        if ($$launchedAny) {$\r$\n'
        FileWrite $R8 '            exit 0$\r$\n'
        FileWrite $R8 '        }$\r$\n'
        FileWrite $R8 '    } else {$\r$\n'
        FileWrite $R8 '        Write-Host "No active user sessions found"$\r$\n'
        FileWrite $R8 '    }$\r$\n'
        FileWrite $R8 '    # Fallback: If no sessions launched (e.g., Error 1314 from non-SYSTEM admin), try simple launch$\r$\n'
        FileWrite $R8 '    if (!$$launchedAny) {$\r$\n'
        FileWrite $R8 '        Write-Host "Falling back to simple process launch for current user"$\r$\n'
        FileWrite $R8 '        Start-Process -FilePath "$INSTDIR\${APP_NAME}.exe" -WorkingDirectory "$INSTDIR"$\r$\n'
        FileWrite $R8 '        Write-Host "Launched via Start-Process"$\r$\n'
        FileWrite $R8 '        exit 0$\r$\n'
        FileWrite $R8 '    }$\r$\n'
        FileWrite $R8 '} catch {$\r$\n'
        FileWrite $R8 '    Write-Host "Error: $$($$_.Exception.Message)"$\r$\n'
        FileWrite $R8 '    Write-Host "Stack: $$($$_.ScriptStackTrace)"$\r$\n'
        FileWrite $R8 '    exit 2$\r$\n'
        FileWrite $R8 '}$\r$\n'
        FileClose $R8

        StrCpy $R9 "Created PowerShell launch script: $R7"
        Call LogWrite

        ; Execute the PowerShell script (with hidden window to prevent console flash)
        nsExec::ExecToStack 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$R7"'
        Pop $0 ; exit code
        Pop $1 ; output

        StrCpy $R9 "PowerShell exit code: $0"
        Call LogWrite
        StrCpy $R9 "PowerShell output: $1"
        Call LogWrite

        ${If} $0 == 0
            StrCpy $R9 "Application launched successfully for user sessions"
            Call LogWrite
        ${ElseIf} $0 == 1
            StrCpy $R9 "No active user sessions found - app will launch on next login"
            Call LogWrite
        ${Else}
            StrCpy $R9 "WARNING: Failed to launch application (error code: $0)"
            Call LogWrite
        ${EndIf}

        ; Clean up the temporary script
        Delete $R7
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

    ; Log startup information (LogWrite will create the file)
    StrCpy $R9 "=== ${APP_NAME} Uninstallation Log ==="
    Call un.LogWrite
    StrCpy $R9 "Started: $2-$1-$0 $4:$5:$6"
    Call un.LogWrite
    StrCpy $R9 "Log file: $LogFile"
    Call un.LogWrite
    StrCpy $R9 "Uninstall mode: perMachine"
    Call un.LogWrite

    StrCpy $R9 "=== STEP 1: Removing Auto-Start Registry Key ==="
    Call un.LogWrite

    ; Remove auto-start registry key
    DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_NAME}"
    StrCpy $R9 "Auto-start registry key removed"
    Call un.LogWrite

    StrCpy $R9 "=== STEP 2: Checking Configuration Data ==="
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

    ; Create runtime log file with open permissions
    StrCpy $R9 "Creating runtime log file with open permissions"
    Call LogWrite

    ; Create empty file (application will write its own header)
    FileOpen $8 "$COMMONPROGRAMDATA\${CONFIG_DIR_NAME}\logs\runtime_${APP_VERSION}.log" w
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
