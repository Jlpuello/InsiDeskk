// Construye los comandos de instalación del agente de Remotely, pre-cargados
// con el grupo de la empresa correspondiente. Confirmado contra el código
// fuente real de Remotely (Server/Components/Pages/Deploy.razor +
// Server/Content/Install-Remotely.ps1 + ClientDownloadsController.cs):
//
// - La ruta GET /api/ClientDownloads/{platformId}/{organizationId} es
//   PÚBLICA (sin auth) — no hace falta X-Api-Key para generar/descargar el
//   instalador, solo el organizationId real.
// - El instalador de Windows (Install-Remotely.ps1) acepta -DeviceGroup como
//   parámetro y, si viene seteado, hace un POST a /api/devices (también sin
//   auth, corre desde la máquina recién instalada) para asignar el device a
//   ese grupo por NOMBRE — así el equipo cae directo en el grupo/empresa
//   correcta sin pasos manuales.
// - Los instaladores de Linux (.sh) NO tienen ese parámetro — un equipo Linux
//   instalado así queda sin grupo, hay que asignarlo a mano en Remotely
//   después. No es algo que podamos evitar desde acá.
//
// No se probó una instalación real end-to-end (instalaría un agente de
// verdad en una máquina y consumiría un cupo en el Remotely del usuario) —
// la sintaxis sigue exactamente lo confirmado en el código fuente, pero
// conviene probarla una vez en un equipo de prueba antes de repartirla.

import { buildHardenAgentScript } from './harden-agent.script.js';

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// -EncodedCommand espera el script en UTF-16LE, codificado en base64 — así
// evitamos meter un bloque de PowerShell multilínea (con comillas, %, etc.)
// dentro del .bat, donde el escapeo sería mucho más frágil.
function toPowerShellEncodedCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

// groupName es opcional: -DeviceGroup en el instalador de Remotely solo
// existe para asignar el equipo a un grupo apenas se instala — si no hay
// grupo (empresa sin mapear, o soporte a un usuario particular sin empresa
// de por medio), el instalador funciona igual, el equipo queda sin grupo
// asignado en Remotely hasta que alguien lo organice a mano.
export function buildWindowsInstallCommand(serverUrl: string, organizationId: string, groupName?: string): string {
  const base = stripTrailingSlash(serverUrl);
  // [scriptblock]::Create + invocación con & (no un simple `iex`): así el
  // script descargado recibe -DeviceGroup como parámetro real de su propio
  // param() block, en vez de intentar pegarlo como texto suelto después del
  // pipe a iex (que rompería el parseo).
  const deviceGroupArg = groupName ? ` -DeviceGroup '${escapePowerShellSingleQuoted(groupName)}'` : '';
  return `& ([scriptblock]::Create((irm '${base}/api/ClientDownloads/WindowsInstaller/${organizationId}')))${deviceGroupArg}`;
}

// Vuelca el script de endurecimiento como comentarios REM, línea por línea,
// justo antes de la línea -EncodedCommand que lo ejecuta — así cualquiera
// que abra el .bat en el Bloc de notas puede auditar exactamente qué corre
// sin tener que decodificar el Base64 a mano. El propio harden-agent.script.ts
// (versionado en el repo) sigue siendo la fuente real; esto es solo una
// copia de solo lectura para quien recibe el .bat sin acceso al repo.
// PowerShell no usa "%", pero se escapa igual por las dudas — un "%" suelto
// en una línea REM puede interpretarse como variable de entorno en cmd.exe.
function toRemComments(script: string): string {
  return script
    .split('\n')
    .map((line) => 'REM ' + line.replace(/%/g, '%%').replace(/\r$/, ''))
    .join('\r\n');
}

export function buildWindowsBatContent(command: string, empresaId: string, reportUrl: string | null): string {
  // %% para que un eventual "%" en el nombre de la empresa/grupo no se
  // interprete como variable de entorno dentro del .bat.
  const safe = command.replace(/%/g, '%%').replace(/"/g, '""');
  const hardenScript = buildHardenAgentScript(empresaId, reportUrl);
  const hardenEncoded = toPowerShellEncodedCommand(hardenScript);
  const hardenAudit = toRemComments(hardenScript);

  // Todo el flujo corre secuencialmente en un solo proceso cmd.exe: (1)
  // verificar elevación, (2) instalar el agente, (3) confirmar que el
  // servicio quedó instalado y corriendo, (4) recién ahí endurecer permisos
  // — si (1) o (3) fallan, se corta antes sin tocar ACLs de nada. La
  // limpieza de temporales (:cleanup) se llama desde cualquier punto de
  // salida, haya éxito o no.
  return (
    '@echo off\r\n' +
    'setlocal enabledelayedexpansion\r\n' +
    '\r\n' +
    'REM ==========================================================\r\n' +
    'REM Paso 1: este instalador necesita permisos de administrador.\r\n' +
    'REM Sin elevar, el instalador de Remotely intenta reelevarse solo\r\n' +
    'REM y falla en silencio (usa $MyInvocation.ScriptName, que no\r\n' +
    'REM existe cuando el script corre via irm + scriptblock, no desde\r\n' +
    'REM un archivo .ps1 real).\r\n' +
    'REM ==========================================================\r\n' +
    'net session >nul 2>&1\r\n' +
    'if %ERRORLEVEL% NEQ 0 (\r\n' +
    '    echo.\r\n' +
    '    echo Este instalador necesita permisos de administrador.\r\n' +
    '    echo Haga clic derecho sobre este archivo y elija: Ejecutar como administrador\r\n' +
    '    echo.\r\n' +
    '    call :cleanup\r\n' +
    '    pause\r\n' +
    '    exit /b 1\r\n' +
    ')\r\n' +
    '\r\n' +
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${safe}"\r\n` +
    '\r\n' +
    'REM ==========================================================\r\n' +
    'REM Paso 2: confirmar que el agente quedo instalado y corriendo\r\n' +
    'REM antes de tocar ningun permiso. El servicio puede tardar unos\r\n' +
    'REM segundos en arrancar despues de instalarse, por eso reintenta.\r\n' +
    'REM ==========================================================\r\n' +
    'echo.\r\n' +
    'echo Verificando la instalacion del agente...\r\n' +
    'set REMOTELY_OK=0\r\n' +
    'for /l %%i in (1,1,10) do (\r\n' +
    '    sc query Remotely_Service | find "RUNNING" >nul 2>&1\r\n' +
    '    if !ERRORLEVEL! EQU 0 (\r\n' +
    '        set REMOTELY_OK=1\r\n' +
    '        goto :service_checked\r\n' +
    '    )\r\n' +
    '    timeout /t 2 /nobreak >nul\r\n' +
    ')\r\n' +
    ':service_checked\r\n' +
    'if "!REMOTELY_OK!"=="0" (\r\n' +
    '    echo.\r\n' +
    '    echo La instalacion del agente fallo; no se aplico el endurecimiento.\r\n' +
    '    echo Revise la conexion a internet de este equipo o contacte a soporte.\r\n' +
    '    call :cleanup\r\n' +
    '    pause\r\n' +
    '    exit /b 1\r\n' +
    ')\r\n' +
    'echo Agente instalado y en ejecucion.\r\n' +
    '\r\n' +
    'echo.\r\n' +
    'echo Este instalador aplica protecciones adicionales:\r\n' +
    'echo  1. El archivo de configuracion del agente solo lo pueden leer\r\n' +
    'echo     el servicio (SYSTEM) y los administradores del equipo.\r\n' +
    'echo  2. Los usuarios sin privilegios no pueden escribir en la carpeta\r\n' +
    'echo     de registros del agente, salvo en la subcarpeta que necesita\r\n' +
    'echo     el componente de escritorio.\r\n' +
    'echo  3. El agente no abre puertos de escucha, solo una conexion\r\n' +
    'echo     saliente cifrada al servidor de soporte.\r\n' +
    'echo.\r\n' +
    'echo Aplicando protecciones de seguridad adicionales al agente...\r\n' +
    '\r\n' +
    'REM ==========================================================\r\n' +
    'REM Script de endurecimiento, decodificado, para auditoria -----\r\n' +
    'REM Es EXACTAMENTE lo que corre -EncodedCommand mas abajo, en\r\n' +
    'REM texto plano, para revisar sin decodificar el Base64. No se\r\n' +
    'REM ejecuta desde aca, es solo documentacion.\r\n' +
    hardenAudit + '\r\n' +
    'REM ---- fin del script de endurecimiento decodificado ----------\r\n' +
    '\r\n' +
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${hardenEncoded}\r\n` +
    'set HARDEN_RESULT=%ERRORLEVEL%\r\n' +
    '\r\n' +
    'call :cleanup\r\n' +
    '\r\n' +
    'echo.\r\n' +
    'if %HARDEN_RESULT% NEQ 0 (\r\n' +
    '    echo ADVERTENCIA: la instalacion se completo pero el endurecimiento\r\n' +
    '    echo tuvo problemas. Revise el detalle en C:\\ProgramData\\Harden-RemotelyAgent.log\r\n' +
    ') else (\r\n' +
    '    echo Instalacion y proteccion del agente completadas correctamente.\r\n' +
    ')\r\n' +
    '\r\n' +
    'echo.\r\n' +
    'pause\r\n' +
    'exit /b %HARDEN_RESULT%\r\n' +
    '\r\n' +
    'REM ==========================================================\r\n' +
    'REM Limpieza de temporales del instalador de Remotely. Se llama\r\n' +
    'REM desde cada punto de salida de arriba (con exito o sin exito).\r\n' +
    'REM ==========================================================\r\n' +
    ':cleanup\r\n' +
    'if exist "%TEMP%\\Remotely-Win-x64.zip" del /f /q "%TEMP%\\Remotely-Win-x64.zip" >nul 2>&1\r\n' +
    'if exist "%TEMP%\\Remotely_Install.txt" del /f /q "%TEMP%\\Remotely_Install.txt" >nul 2>&1\r\n' +
    'exit /b 0\r\n'
  );
}

export function buildLinuxInstallCommand(
  serverUrl: string,
  organizationId: string,
  platformId: 'UbuntuInstaller-x64' | 'ManjaroInstaller-x64',
): string {
  const base = stripTrailingSlash(serverUrl);
  const url = `${base}/api/ClientDownloads/${platformId}/${organizationId}`;
  return (
    'sudo rm -f /tmp/Install-Remotely.sh && ' +
    `sudo wget -q -O /tmp/Install-Remotely.sh ${url} && ` +
    'sudo chmod +x /tmp/Install-Remotely.sh && ' +
    'sudo /tmp/Install-Remotely.sh'
  );
}
