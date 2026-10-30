// Antes esto enmascaraba IP/seriales/MAC en tránsito hacia el frontend. Se
// quitó a pedido explícito: esta es una herramienta interna (solo
// admin/tecnico ven estos datos) y ocultar valores informativos no aporta
// seguridad real, solo le resta valor diagnóstico a la "hoja de vida" del
// equipo. La ENCRIPTACIÓN EN REPOSO (shared/prisma/middleware/encryption.middleware.ts
// — ipLocal/ipPublica/remotelyId/hwUuid/hwSerialNumber/macAddresses/
// hwStorageSerials siguen cifrados en Postgres) no cambia: esto solo afecta
// qué se muestra en pantalla, no cómo se guarda.

// Enmascara un identificador genérico dejando ver solo los extremos
// (p.ej. "rc-0012345" -> "rc-***345") — sigue en uso para remotelySessionId,
// que es un valor operativo de sesión (más parecido a un token que a un dato
// informativo), no para IPs/seriales/MAC.
export function maskId(value?: string | null): string | null {
  if (!value) return value ?? null;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

interface SanitizableDevice {
  remotelyIdHash?: string | null;
  glpiDeviceIdHash?: string | null;
  hwStorage?: unknown;
  hwStorageSerials?: string[] | null;
  [key: string]: unknown;
}

// hwStorage vive sin seriales (JSON plano) y hwStorageSerials aparte (cifrado
// en reposo) — se recombinan acá, en la salida, para que el frontend reciba
// un solo array `storage` con el serial real ya en su lugar.
function attachStorageSerials(storage: unknown, serials?: string[] | null): unknown {
  if (!Array.isArray(storage)) return storage;
  return storage.map((drive, i) => {
    if (!drive || typeof drive !== 'object') return drive;
    return { ...drive, serialNumber: serials?.[i] ?? null };
  });
}

// Prepara un Device para salir por la API: quita campos internos que nunca
// deben llegar al cliente (remotelyIdHash es el blind index para búsquedas,
// hwStorageSerials se recombina dentro de hwStorage) — ya no enmascara IPs
// ni identificadores, ver comentario arriba.
export function sanitizeDevice<T extends SanitizableDevice>(
  device: T,
): Omit<T, 'remotelyIdHash' | 'glpiDeviceIdHash' | 'hwStorageSerials'> {
  const { remotelyIdHash: _remotelyIdHash, glpiDeviceIdHash: _glpiDeviceIdHash, hwStorageSerials, ...rest } = device;
  return {
    ...rest,
    ...('hwStorage' in device && { hwStorage: attachStorageSerials(device.hwStorage, hwStorageSerials) }),
  };
}

interface SanitizableConversation {
  tokenHash?: string;
  [key: string]: unknown;
}

// tokenHash es el blind index del token de acceso anónimo (ver
// ConversationTokenService) — mismo criterio que remotelyIdHash en Device,
// nunca debería salir por la API ni al widget público ni al staff.
export function sanitizeConversation<T extends SanitizableConversation>(conversation: T): Omit<T, 'tokenHash'> {
  const { tokenHash: _tokenHash, ...rest } = conversation;
  return rest;
}

interface MaskableSession {
  remotelySessionId?: string | null;
  dispositivo?: SanitizableDevice;
  [key: string]: unknown;
}

export function maskRemotelySession<T extends MaskableSession>(session: T): T {
  return {
    ...session,
    remotelySessionId: maskId(session.remotelySessionId),
    ...(session.dispositivo ? { dispositivo: sanitizeDevice(session.dispositivo) } : {}),
  };
}

interface HwScanDevice extends SanitizableDevice {
  hwUuid?: string | null;
  hwSerialNumber?: string | null;
  hwBoardInfo?: unknown;
  hwBattery?: unknown;
  hwCpu?: unknown;
  ramModules?: unknown;
  ramSlotsUsed?: number | null;
  ramSlotsTotal?: number | null;
  hwGraphics?: unknown;
  hwUsbDevices?: unknown;
  hwScannedAt?: Date | string | null;
}

// Reforma el Device (ya pasado por sanitizeDevice, que recombina hwStorage)
// a la forma plana que espera el frontend para el resultado de "análisis de
// hardware".
export function formatHardwareScan(device: HwScanDevice) {
  const clean = sanitizeDevice(device);
  const graphics = clean.hwGraphics && typeof clean.hwGraphics === 'object' ? (clean.hwGraphics as object) : {};

  return {
    uuid: clean.hwUuid ?? null,
    serialNumber: clean.hwSerialNumber ?? null,
    board: clean.hwBoardInfo ?? null,
    battery: clean.hwBattery ?? null,
    cpu: clean.hwCpu ?? null,
    ramModules: clean.ramModules ?? [],
    ramSlotsUsed: clean.ramSlotsUsed ?? 0,
    ramSlotsTotal: clean.ramSlotsTotal ?? null,
    storage: clean.hwStorage ?? [],
    gpus: [],
    monitors: [],
    ...graphics,
    usbDevices: clean.hwUsbDevices ?? [],
    hwScannedAt: clean.hwScannedAt ?? null,
  };
}

interface NetScanDevice extends SanitizableDevice {
  netInterfaces?: unknown;
  netListening?: unknown;
  netConnections?: unknown;
  netScannedAt?: Date | string | null;
}

// Mismo patrón que formatHardwareScan: solo reforma la respuesta.
export function formatNetworkScan(device: NetScanDevice) {
  const clean = sanitizeDevice(device);
  return {
    interfaces: clean.netInterfaces ?? [],
    listening: clean.netListening ?? [],
    connections: clean.netConnections ?? [],
    netScannedAt: clean.netScannedAt ?? null,
  };
}

// Para un Ticket (u otro objeto) que trae un `dispositivo` anidado via include.
// Sin `extends { dispositivo?: ... }`: ese constraint sería un "weak type" (todo
// opcional) y TS rechaza los tipos de Ticket que ni siquiera declaran esa
// propiedad (create/update no incluyen dispositivo) por no compartir ninguna
// key en común — así que se castea puertas adentro en vez de constrainear T.
export function sanitizeNestedDevice<T>(obj: T): T {
  const record = obj as T & { dispositivo?: SanitizableDevice | null };
  if (!record.dispositivo) return obj;
  return { ...obj, dispositivo: sanitizeDevice(record.dispositivo) };
}
