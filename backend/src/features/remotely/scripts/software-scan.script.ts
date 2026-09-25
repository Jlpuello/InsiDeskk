import { logger } from '../../../shared/utils/logger.js';
import type { ExecuteScriptResult, InstalledAppInfo, SoftwareScanResult } from '../types/remotely.types.js';
import { extractJsonLine } from './script-output.util.js';

// Categoría "Software instalado" — separada de hardware-scan/network-scan por
// tamaño (puede haber cientos de programas). Misma fuente que "Programas y
// características" de Windows: las claves Uninstall del registro (64-bit,
// WOW6432Node para 32-bit sobre un OS de 64-bit, y HKCU para instalaciones
// por usuario). Se excluyen entradas sin DisplayName, componentes de sistema
// (SystemComponent) y parches (ParentKeyName) — mismo filtro que usa el
// propio Panel de Control. Limitado a 300 para no generar una línea de salida
// desmedida en un canal ya de por sí frágil (consola interactiva de Remotely
// — ver el comentario largo en hardware-scan.script.ts).
//
// Deliberadamente NO se intenta enumerar WinGet/Chocolatey por separado: la
// gran mayoría de esos paquetes también registran una entrada Uninstall
// (por eso "Programas y características" los muestra), así que el registro
// ya cubre el caso común sin depender de que esas herramientas estén
// instaladas en el equipo.
export const SOFTWARE_SCAN_SCRIPT =
  "$uninstallPaths = @('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); " +
  'try { $apps = @(Get-ItemProperty -Path $uninstallPaths -ErrorAction SilentlyContinue | ' +
  'Where-Object { $_.DisplayName -and -not $_.SystemComponent -and -not $_.ParentKeyName } | ' +
  'Select-Object DisplayName, DisplayVersion, Publisher, InstallDate | Sort-Object DisplayName -Unique | Select-Object -First 300 | ForEach-Object { ' +
  '[PSCustomObject]@{ name = $_.DisplayName; version = $_.DisplayVersion; publisher = $_.Publisher; installDate = $_.InstallDate } ' +
  '}) } catch { $apps = @() }; ' +
  '[PSCustomObject]@{ apps = $apps; totalCount = $apps.Count } | ConvertTo-Json -Depth 4 -Compress';

const REGISTRY_DATE_RE = /^(\d{4})(\d{2})(\d{2})$/;

// InstallDate en el registro es un string "YYYYMMDD" plano, no una fecha real
// — se normaliza a "YYYY-MM-DD" para que el frontend la pueda parsear con
// `new Date(...)` sin lógica especial.
function normalizeInstallDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const match = REGISTRY_DATE_RE.exec(value);
  if (!match) return value;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseSoftwareScanResult(result: ExecuteScriptResult): SoftwareScanResult | null {
  const stdout = extractJsonLine(result);
  if (!stdout) {
    logger.warn('parseSoftwareScanResult: no se encontró una línea JSON en standardOutput', { result });
    return null;
  }

  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const appsRaw = Array.isArray(parsed.apps) ? (parsed.apps as Record<string, unknown>[]) : [];

    const apps: InstalledAppInfo[] = appsRaw
      .filter((a) => typeof a.name === 'string' && a.name.trim().length > 0)
      .map((a) => ({
        name: a.name as string,
        version: typeof a.version === 'string' ? a.version : null,
        publisher: typeof a.publisher === 'string' ? a.publisher : null,
        installDate: normalizeInstallDate(a.installDate),
      }));

    return {
      apps,
      totalCount: typeof parsed.totalCount === 'number' ? parsed.totalCount : apps.length,
    };
  } catch (err) {
    logger.warn('parseSoftwareScanResult: la línea encontrada no es JSON válido', {
      stdout,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  }
}
