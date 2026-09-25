import { logger } from '../../../shared/utils/logger.js';
import type { ExecuteScriptResult, HardwareScanResult, RamModuleInfo } from '../types/remotely.types.js';
import { extractJsonLine } from './script-output.util.js';

// "Hoja de vida" de hardware: todo lo que Remotely NO expone por API sale de
// este único script WMI/CIM (así se paga UNA sola vez el "impuesto" de 30s
// del bug de Remotely — ver remotely.service.ts#executeScript — en vez de uno
// por categoría). Va en UNA sola línea (';' como separador de sentencias):
// confirmado en vivo que el modo WinPS de Remotely alimenta el comando a una
// consola interactiva línea por línea, y un script multilínea con llaves
// `{...}` se queda esperando el cierre sin devolver resultado dentro de la
// ventana de captura. Cada sección va en su propio try/catch para que una
// clase WMI ausente (ej. batería en un equipo de escritorio) no tumbe el
// resto — el campo correspondiente queda null/vacío.
export const HARDWARE_SCAN_SCRIPT =
  'try { $sysProduct = Get-CimInstance Win32_ComputerSystemProduct; $biosRaw = Get-CimInstance Win32_BIOS; $boardRaw = Get-CimInstance Win32_BaseBoard; ' +
  '$hwUuid = $sysProduct.UUID; $hwSerial = $biosRaw.SerialNumber; ' +
  '$board = [PSCustomObject]@{ motherboardManufacturer = $boardRaw.Manufacturer; motherboardProduct = $boardRaw.Product; motherboardVersion = $boardRaw.Version; biosManufacturer = $biosRaw.Manufacturer; biosVersion = $biosRaw.SMBIOSBIOSVersion; biosReleaseDate = $biosRaw.ReleaseDate } ' +
  '} catch { $hwUuid = $null; $hwSerial = $null; $board = $null }; ' +
  'try { $battStatic = Get-CimInstance -Namespace root\\wmi -ClassName BatteryStaticData -ErrorAction Stop | Select-Object -First 1; ' +
  '$battFull = Get-CimInstance -Namespace root\\wmi -ClassName BatteryFullChargedCapacity -ErrorAction Stop | Select-Object -First 1; ' +
  '$designCap = $battStatic.DesignedCapacity; $fullCap = $battFull.FullChargedCapacity; ' +
  '$healthPct = if ($designCap -gt 0) { [math]::Round(($fullCap / $designCap) * 100, 1) } else { $null }; ' +
  '$battery = [PSCustomObject]@{ designCapacityMwh = $designCap; fullChargeCapacityMwh = $fullCap; healthPercent = $healthPct } ' +
  '} catch { $battery = $null }; ' +
  'try { $cpuRaw = Get-CimInstance Win32_Processor | Select-Object -First 1; ' +
  '$cpu = [PSCustomObject]@{ name = $cpuRaw.Name; cores = $cpuRaw.NumberOfCores; logicalProcessors = $cpuRaw.NumberOfLogicalProcessors; maxClockMhz = $cpuRaw.MaxClockSpeed; currentClockMhz = $cpuRaw.CurrentClockSpeed; virtualizationFirmwareEnabled = $cpuRaw.VirtualizationFirmwareEnabled } ' +
  '} catch { $cpu = $null }; ' +
  "$memTypeMap = @{ 20='DDR'; 21='DDR2'; 22='DDR2 FB-DIMM'; 24='DDR3'; 26='DDR4'; 34='DDR5' }; " +
  'try { $modules = @(Get-CimInstance -ClassName Win32_PhysicalMemory | ForEach-Object { ' +
  '$typeCode = [int]$_.SMBIOSMemoryType; if (-not $typeCode) { $typeCode = [int]$_.MemoryType }; ' +
  "$typeName = if ($memTypeMap.ContainsKey($typeCode)) { $memTypeMap[$typeCode] } else { 'Desconocido' }; " +
  '[PSCustomObject]@{ slot = $_.DeviceLocator; capacityGb = [math]::Round($_.Capacity / 1GB, 2); ' +
  'speedMhz = $_.Speed; type = $typeName; manufacturer = ("$($_.Manufacturer)").Trim() } }); ' +
  '$totalSlots = (Get-CimInstance -ClassName Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum ' +
  '} catch { $modules = @(); $totalSlots = $null }; ' +
  'try { $storage = @(Get-PhysicalDisk | ForEach-Object { $pd = $_; $tempC = $null; $wearPct = $null; $realloc = $null; $poh = $null; ' +
  'try { $rel = $pd | Get-StorageReliabilityCounter -ErrorAction Stop; $tempC = $rel.Temperature; $realloc = $rel.ReallocatedSectors; $poh = $rel.PowerOnHours; $wearPct = $rel.Wear } catch {}; ' +
  '[PSCustomObject]@{ model = $pd.FriendlyName; serialNumber = $pd.SerialNumber; interfaceType = ("$($pd.BusType)"); mediaType = ("$($pd.MediaType)"); ' +
  'sizeGb = [math]::Round($pd.Size / 1GB, 1); healthStatus = ("$($pd.HealthStatus)"); temperatureC = $tempC; wearPercent = $wearPct; reallocatedSectors = $realloc; powerOnHours = $poh } ' +
  '}) } catch { $storage = @() }; ' +
  'try { $gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object { ' +
  '[PSCustomObject]@{ name = $_.Name; vramGb = if ($_.AdapterRAM) { [math]::Round($_.AdapterRAM / 1GB, 2) } else { $null }; driverVersion = $_.DriverVersion; ' +
  'currentResolution = if ($_.CurrentHorizontalResolution) { "$($_.CurrentHorizontalResolution)x$($_.CurrentVerticalResolution)" } else { $null }; refreshRateHz = $_.CurrentRefreshRate } ' +
  '}) } catch { $gpus = @() }; ' +
  'try { $monitors = @(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -ErrorAction Stop | ForEach-Object { ' +
  '$name = if ($_.UserFriendlyName) { -join ($_.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) } else { $null }; ' +
  '[PSCustomObject]@{ name = $name } ' +
  '}) } catch { $monitors = @() }; ' +
  "try { $usbDevices = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPDeviceID -like 'USB*' -and $_.Name } | Select-Object -First 30 | ForEach-Object { " +
  '[PSCustomObject]@{ name = $_.Name; pnpDeviceId = $_.PNPDeviceID } ' +
  "}) } catch { $usbDevices = @() }; " +
  '[PSCustomObject]@{ uuid = $hwUuid; serialNumber = $hwSerial; board = $board; battery = $battery; cpu = $cpu; ' +
  'ramModules = $modules; ramSlotsUsed = $modules.Count; ramSlotsTotal = $totalSlots; storage = $storage; gpus = $gpus; monitors = $monitors; usbDevices = $usbDevices } ' +
  '| ConvertTo-Json -Depth 6 -Compress';

function isRamModuleInfo(value: unknown): value is RamModuleInfo {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.capacityGb === 'number';
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const DOTNET_DATE_RE = /^\/Date\((\d+)\)\/$/;

// ConvertTo-Json serializa un [DateTime] real (a diferencia de un string) en
// el formato clásico "/Date(msEpoch)/" — confirmado en vivo con
// board.biosReleaseDate. Se normaliza a ISO acá para no pasarle ese formato
// crudo al frontend.
function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = DOTNET_DATE_RE.exec(value);
  if (!match) return value;
  return new Date(Number(match[1])).toISOString();
}

export function parseHardwareScanResult(result: ExecuteScriptResult): HardwareScanResult | null {
  const stdout = extractJsonLine(result);
  if (!stdout) {
    logger.warn('parseHardwareScanResult: no se encontró una línea JSON en standardOutput', { result });
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const ramModulesRaw = asArray<unknown>(parsed.ramModules);
    const ramModules = ramModulesRaw.filter(isRamModuleInfo);

    if (ramModules.length !== ramModulesRaw.length) {
      logger.warn('parseHardwareScanResult: algunos elementos de ramModules no tenían la forma esperada', {
        ramModulesRaw,
      });
    }

    const board = (parsed.board as HardwareScanResult['board']) ?? null;
    if (board) {
      board.biosReleaseDate = normalizeDate(board.biosReleaseDate);
    }

    return {
      uuid: typeof parsed.uuid === 'string' ? parsed.uuid : null,
      serialNumber: typeof parsed.serialNumber === 'string' ? parsed.serialNumber : null,
      board,
      battery: (parsed.battery as HardwareScanResult['battery']) ?? null,
      cpu: (parsed.cpu as HardwareScanResult['cpu']) ?? null,
      ramModules,
      ramSlotsUsed: typeof parsed.ramSlotsUsed === 'number' ? parsed.ramSlotsUsed : ramModules.length,
      ramSlotsTotal: typeof parsed.ramSlotsTotal === 'number' ? parsed.ramSlotsTotal : null,
      storage: asArray(parsed.storage),
      gpus: asArray(parsed.gpus),
      monitors: asArray(parsed.monitors),
      usbDevices: asArray(parsed.usbDevices),
    };
  } catch (err) {
    logger.warn('parseHardwareScanResult: la línea encontrada no es JSON válido', {
      stdout,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
