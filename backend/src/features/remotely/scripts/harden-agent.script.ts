// Script de endurecimiento de permisos NTFS del agente Remotely, embebido en
// el instalador .bat que genera este módulo (ver agent-deploy.util.ts).
// Corre siempre DESPUÉS del instalador de Remotely, que es quien crea
// ConnectionInfo.json y ProgramData\Remotely — si corriera antes no
// encontraría qué endurecer.
//
// Restringe:
// - ConnectionInfo.json (contiene el ServerVerificationToken, la única
//   defensa del agente contra un servidor impostor tras el primer
//   emparejamiento): hoy legible por cualquier usuario local, queda
//   limitado a SYSTEM y Administradores.
// - ProgramData\Remotely: hoy con escritura general para "Usuarios" (permite
//   manipular/inundar logs de un proceso que corre como SYSTEM), queda de
//   solo lectura salvo en Logs\Remotely_Desktop, la única subcarpeta que el
//   componente en sesión de usuario necesita escribir.
//
// Usa SIDs (no nombres de grupo localizados) porque este .bat se distribuye
// a equipos de empresas distintas, algunos con Windows en español y otros en
// inglés ("Usuarios" vs "Users"); S-1-5-18/32-544/32-545 son iguales en
// cualquier idioma. Adaptado de un script verificado sobre un equipo de
// prueba real (auditoría de seguridad del agente, 2026-09-22) — evitar
// reescribirlo desde cero sin volver a probarlo en un equipo real.
//
// No usa `${Var}` de PowerShell en ningún lado (se concatena con `+` en su
// lugar) para poder vivir como un template literal de JS sin que `${` se
// interprete como interpolación.
//
// Al final (marcador __REPORT_BLOCK__) reporta el resultado a InsiDesk vía
// POST /api/public/remotely/harden-report, si buildHardenAgentScript()
// recibió una reportUrl — ver ese endpoint para qué hace con el aviso (marca
// Device.agentHardenedAt para mostrarlo en la lista de Dispositivos).
const HARDEN_AGENT_SCRIPT_BODY = String.raw`
$ErrorActionPreference = 'Stop'

$InstallDir = "C:\Program Files\Remotely"
$DataDir    = "C:\ProgramData\Remotely"

try { Start-Transcript -Path "C:\ProgramData\Harden-RemotelyAgent.log" -Force | Out-Null } catch {}

$current = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($current)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Warning "Este paso debe ejecutarse como Administrador; se omite el endurecimiento del agente."
    try { Stop-Transcript | Out-Null } catch {}
    exit 1
}

$SID_SYSTEM = "*S-1-5-18"
$SID_ADMINS = "*S-1-5-32-544"
$SID_USERS  = "*S-1-5-32-545"

# Autoverificacion por SID, no por nombre de grupo: "*Usuarios*"/"*Users*"
# da un falso OK en un Windows en portugues ("Usuarios" en el ACE real),
# frances, etc. El SID de BUILTIN\Users (S-1-5-32-545) es el mismo en
# cualquier idioma. Translate() puede fallar para una identidad ya
# huerfana/no resoluble (SID suelto sin cuenta) — en ese caso no es el
# grupo Users, se trata como "no es Users" en vez de cortar todo el script.
function Test-IsBuiltinUsersSid {
    param($IdentityReference)
    try {
        return $IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq 'S-1-5-32-545'
    } catch {
        return $false
    }
}

function Invoke-Icacls {
    param([string[]]$IcaclsArgs)
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    Write-Host ("icacls " + ($IcaclsArgs -join ' ')) -ForegroundColor DarkGray
    $out = & icacls @IcaclsArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning ("icacls fallo (exit " + $LASTEXITCODE + "): " + $out)
    }
    $ErrorActionPreference = $prevPref
}

# ConnectionInfo.json: solo SYSTEM y Administradores deben poder leerlo.
$connectionInfo = Join-Path $InstallDir "ConnectionInfo.json"
if (Test-Path $connectionInfo) {
    Write-Host ""
    Write-Host ("== Endureciendo " + $connectionInfo + " ==") -ForegroundColor Cyan
    Invoke-Icacls @($connectionInfo, "/inheritance:r")
    Invoke-Icacls @($connectionInfo, "/remove:g", "*S-1-3-0")
    Invoke-Icacls @($connectionInfo, "/remove:g", "*S-1-15-2-1")
    Invoke-Icacls @($connectionInfo, "/remove:g", "*S-1-15-2-2")
    Invoke-Icacls @($connectionInfo, "/remove:g", $SID_USERS)
    Invoke-Icacls @($connectionInfo, "/grant:r", ($SID_SYSTEM + ":(F)"))
    Invoke-Icacls @($connectionInfo, "/grant:r", ($SID_ADMINS + ":(F)"))
} else {
    Write-Warning ("No se encontro " + $connectionInfo + ", se omite este paso.")
}

# ProgramData\Remotely: quitar el "Write" general para Usuarios en la raiz, y
# re-otorgarlo SOLO en Logs\Remotely_Desktop (el unico proceso que corre en
# sesion del usuario interactivo, no como SYSTEM).
if (Test-Path $DataDir) {
    Write-Host ""
    Write-Host ("== Endureciendo " + $DataDir + " ==") -ForegroundColor Cyan

    $svc = Get-Service -Name "Remotely_Service" -ErrorAction SilentlyContinue
    $wasRunning = $svc -and $svc.Status -eq 'Running'
    if ($wasRunning) {
        Write-Host "Deteniendo Remotely_Service temporalmente..." -ForegroundColor DarkGray
        Stop-Service -Name "Remotely_Service" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    Invoke-Icacls @($DataDir, "/inheritance:r", "/T", "/C")
    Invoke-Icacls @($DataDir, "/remove:g", "*S-1-15-2-1", "/T", "/C")
    Invoke-Icacls @($DataDir, "/remove:g", "*S-1-15-2-2", "/T", "/C")
    Invoke-Icacls @($DataDir, "/grant:r", ($SID_SYSTEM + ":(OI)(CI)(F)"), "/T", "/C")
    Invoke-Icacls @($DataDir, "/grant:r", ($SID_ADMINS + ":(OI)(CI)(F)"), "/T", "/C")
    Invoke-Icacls @($DataDir, "/grant:r", ($SID_USERS + ":(OI)(CI)(RX)"), "/T", "/C")

    $desktopLogs = Join-Path $DataDir "Logs\Remotely_Desktop"
    if (-not (Test-Path $desktopLogs)) {
        New-Item -ItemType Directory -Path $desktopLogs -Force | Out-Null
    }
    Invoke-Icacls @($desktopLogs, "/grant:r", ($SID_USERS + ":(OI)(CI)(M)"), "/T", "/C")

    if ($wasRunning) {
        Write-Host "Reiniciando Remotely_Service..." -ForegroundColor DarkGray
        Start-Service -Name "Remotely_Service" -ErrorAction SilentlyContinue
    }
} else {
    Write-Warning ("No se encontro " + $DataDir + ", se omite este paso.")
}

# Autoverificacion: confirma el resultado real (no solo que los comandos se
# hayan lanzado sin error) y decide el exit code que ve el .bat.
Write-Host ""
Write-Host "== Verificacion ==" -ForegroundColor Cyan
$exitCode = 0

if (Test-Path $connectionInfo) {
    $usersStillHaveAccess = (Get-Acl $connectionInfo).Access |
        Where-Object { Test-IsBuiltinUsersSid $_.IdentityReference }
    if ($usersStillHaveAccess) {
        Write-Warning "ConnectionInfo.json: 'Usuarios' TODAVIA tiene acceso. El endurecimiento NO se aplico correctamente."
        $exitCode = 1
    } else {
        Write-Host "ConnectionInfo.json: OK, 'Usuarios' ya no tiene acceso." -ForegroundColor Green
    }
}

if (Test-Path $DataDir) {
    $rootWrite = (Get-Acl $DataDir).Access |
        Where-Object {
            (Test-IsBuiltinUsersSid $_.IdentityReference) -and
            $_.FileSystemRights -match "Write"
        }
    if ($rootWrite) {
        Write-Warning "ProgramData\Remotely (raiz): 'Usuarios' TODAVIA tiene Write. El endurecimiento NO se aplico correctamente."
        $exitCode = 1
    } else {
        Write-Host "ProgramData\Remotely (raiz): OK, 'Usuarios' ya no tiene Write general." -ForegroundColor Green
    }
}

$svcCheck = Get-Service -Name "Remotely_Service" -ErrorAction SilentlyContinue
Write-Host ("Estado de Remotely_Service: " + $svcCheck.Status)

__REPORT_BLOCK__

try { Stop-Transcript | Out-Null } catch {}
exit $exitCode
`;

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

// empresaId siempre es un UUID (viene de company.id) y reportUrl, si viene,
// de env.apiPublicUrl — ninguno debería traer comillas simples en la
// práctica, pero se escapan igual por las dudas antes de incrustarlos en un
// string de PowerShell.
export function buildHardenAgentScript(empresaId: string, reportUrl: string | null): string {
  const empresaIdLiteral = escapePowerShellSingleQuoted(empresaId);

  const reportBlock = reportUrl
    ? [
        'try {',
        `    $body = @{ empresaId = '${empresaIdLiteral}'; hostname = $env:COMPUTERNAME; success = ($exitCode -eq 0) } | ConvertTo-Json`,
        `    Invoke-RestMethod -Uri '${escapePowerShellSingleQuoted(reportUrl)}' -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10 | Out-Null`,
        '} catch {',
        '    Write-Warning ("No se pudo reportar el estado del endurecimiento a InsiDesk: " + $_.Exception.Message)',
        '}',
      ].join('\n')
    : '# reportUrl no configurada (API_PUBLIC_URL) — se omite el reporte a InsiDesk.';

  return HARDEN_AGENT_SCRIPT_BODY.replace('__REPORT_BLOCK__', reportBlock);
}
