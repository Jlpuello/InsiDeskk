import { logger } from '../../../shared/utils/logger.js';
import type { ExecuteScriptResult, NetworkScanResult } from '../types/remotely.types.js';
import { extractJsonLine } from './script-output.util.js';

// Categoría "Red" de la hoja de vida — mismo mecanismo que
// hardware-scan.script.ts (una sola línea, ';' como separador, try/catch por
// sección — ver el comentario largo ahí para el porqué). Listening/
// connections se limitan a 50 filas para no generar una línea de salida
// gigante en un canal ya de por sí frágil (consola interactiva de Remotely).
export const NETWORK_SCAN_SCRIPT =
  "$netStatusMap = @{ 0='Desconectado'; 1='Conectando'; 2='Conectado'; 3='Desconectando'; 4='Hardware ausente'; 5='Hardware deshabilitado'; 6='Falla de hardware'; 7='Medio desconectado'; 8='Autenticando'; 9='Autenticacion exitosa'; 10='Autenticacion fallida'; 11='Direccion invalida'; 12='Credenciales requeridas' }; " +
  'try { $interfaces = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=TRUE" | ForEach-Object { ' +
  '$cfg = $_; $adapter = Get-CimInstance Win32_NetworkAdapter -Filter ("Index=" + $cfg.Index); ' +
  "$statusCode = [int]$adapter.NetConnectionStatus; $statusName = if ($netStatusMap.ContainsKey($statusCode)) { $netStatusMap[$statusCode] } else { 'Desconocido' }; " +
  "$ipv4 = ($cfg.IPAddress | Where-Object { $_ -notlike '*:*' } | Select-Object -First 1); " +
  "$ipv6 = ($cfg.IPAddress | Where-Object { $_ -like '*:*' } | Select-Object -First 1); " +
  '$mask = ($cfg.IPSubnet | Select-Object -First 1); $gw = ($cfg.DefaultIPGateway | Select-Object -First 1); ' +
  '[PSCustomObject]@{ name = $adapter.Name; mac = $cfg.MACAddress; status = $statusName; speedMbps = if ($adapter.Speed) { [math]::Round($adapter.Speed / 1000000, 0) } else { $null }; ' +
  'ipv4 = $ipv4; ipv6 = $ipv6; subnetMask = $mask; gateway = $gw; dhcpServer = $cfg.DHCPServer; dnsServers = @($cfg.DNSServerSearchOrder) } ' +
  '}) } catch { $interfaces = @() }; ' +
  'try { $procMap = @{}; Get-Process | ForEach-Object { $procMap[$_.Id] = $_.ProcessName } } catch { $procMap = @{} }; ' +
  'try { $listening = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object -First 50 | ForEach-Object { ' +
  "[PSCustomObject]@{ protocol = 'TCP'; localPort = $_.LocalPort; process = $procMap[[int]$_.OwningProcess] } " +
  '}) } catch { $listening = @() }; ' +
  'try { $connections = @(Get-NetTCPConnection -State Established -ErrorAction Stop | Select-Object -First 50 | ForEach-Object { ' +
  "[PSCustomObject]@{ protocol = 'TCP'; localPort = $_.LocalPort; remoteAddress = $_.RemoteAddress; remotePort = $_.RemotePort; state = 'Established'; process = $procMap[[int]$_.OwningProcess] } " +
  '}) } catch { $connections = @() }; ' +
  '[PSCustomObject]@{ interfaces = $interfaces; listening = $listening; connections = $connections } ' +
  '| ConvertTo-Json -Depth 6 -Compress';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseNetworkScanResult(result: ExecuteScriptResult): NetworkScanResult | null {
  const stdout = extractJsonLine(result);
  if (!stdout) {
    logger.warn('parseNetworkScanResult: no se encontró una línea JSON en standardOutput', { result });
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return {
      interfaces: asArray(parsed.interfaces),
      listening: asArray(parsed.listening),
      connections: asArray(parsed.connections),
    };
  } catch (err) {
    logger.warn('parseNetworkScanResult: la línea encontrada no es JSON válido', {
      stdout,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
