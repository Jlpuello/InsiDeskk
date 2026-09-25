// Remotely (GET /api/remotecontrol/{deviceId}) devuelve la URL de sesión
// directamente, no un sessionId separado.
export interface StartSessionResult {
  joinUrl: string;
}

// GET /api/OrganizationManagement/DeviceGroup — alimenta el selector de
// "grupo de Remotely" en la gestión de empresas (features/companies).
export interface RemotelyDeviceGroup {
  id: string;
  name: string;
}

// Forma real de Remotely.Shared.Entities.ScriptResult (confirmada contra el
// código fuente) — no tiene exitCode/stdout/stderr como se asumía antes.
export interface ExecuteScriptResult {
  id: string;
  deviceID: string;
  scriptInput: string;
  standardOutput: string[] | null;
  errorOutput: string[] | null;
  hadErrors: boolean;
  runTime: string;
  timeStamp: string;
  senderUserName?: string | null;
}

export interface RemoteSessionHistoryEntry {
  id: string;
  dispositivoId: string;
  usuarioId: string;
  remotelySessionId: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  duracionMinutos: number | null;
  usuario?: { id: string; nombre: string; email: string };
}

export interface ScriptExecutionEntry {
  id: string;
  shell: string | null;
  estado: 'completed' | 'failed';
  output: string | null;
  errorMessage: string | null;
  duracionSegundos: number | null;
  createdAt: string;
  usuario?: { id: string; nombre: string; email: string };
}

// Remotely no expone tipo/velocidad/slots de RAM vía API — se obtiene
// corriendo un script (WMI/CIM) contra el equipo, vía POST /hardware-scan/:id.
export interface RamModuleInfo {
  slot: string | null;
  capacityGb: number;
  speedMhz: number | null;
  type: string | null;
  manufacturer: string | null;
}

export interface HwBoardInfo {
  motherboardManufacturer: string | null;
  motherboardProduct: string | null;
  motherboardVersion: string | null;
  biosManufacturer: string | null;
  biosVersion: string | null;
  biosReleaseDate: string | null;
}

export interface HwBattery {
  designCapacityMwh: number | null;
  fullChargeCapacityMwh: number | null;
  healthPercent: number | null;
}

export interface HwCpu {
  name: string | null;
  cores: number | null;
  logicalProcessors: number | null;
  maxClockMhz: number | null;
  currentClockMhz: number | null;
  virtualizationFirmwareEnabled: boolean | null;
}

export interface HwStorageDrive {
  model: string | null;
  serialNumber: string | null;
  interfaceType: string | null;
  mediaType: string | null;
  sizeGb: number | null;
  healthStatus: string | null;
  temperatureC: number | null;
  wearPercent: number | null;
  reallocatedSectors: number | null;
  powerOnHours: number | null;
}

export interface HwGpu {
  name: string | null;
  vramGb: number | null;
  driverVersion: string | null;
  currentResolution: string | null;
  refreshRateHz: number | null;
}

export interface HwMonitor {
  name: string | null;
}

export interface HwUsbDevice {
  name: string | null;
  pnpDeviceId: string | null;
}

export interface HardwareScanResult {
  uuid: string | null;
  serialNumber: string | null;
  board: HwBoardInfo | null;
  battery: HwBattery | null;
  cpu: HwCpu | null;
  ramModules: RamModuleInfo[];
  ramSlotsUsed: number;
  ramSlotsTotal: number | null;
  storage: HwStorageDrive[];
  gpus: HwGpu[];
  monitors: HwMonitor[];
  usbDevices: HwUsbDevice[];
  hwScannedAt?: string | null;
}

export interface NetInterfaceInfo {
  name: string | null;
  mac: string | null;
  status: string | null;
  speedMbps: number | null;
  ipv4: string | null;
  ipv6: string | null;
  subnetMask: string | null;
  gateway: string | null;
  dhcpServer: string | null;
  dnsServers: string[];
}

export interface NetListeningPort {
  protocol: string;
  localPort: number;
  process: string | null;
}

export interface NetConnectionInfo {
  protocol: string;
  localPort: number;
  remoteAddress: string | null;
  remotePort: number;
  state: string | null;
  process: string | null;
}

export interface NetworkScanResult {
  interfaces: NetInterfaceInfo[];
  listening: NetListeningPort[];
  connections: NetConnectionInfo[];
  netScannedAt?: string | null;
}

export interface InstalledAppInfo {
  name: string;
  version: string | null;
  publisher: string | null;
  installDate: string | null;
}

export interface SoftwareScanResult {
  apps: InstalledAppInfo[];
  totalCount: number;
  swScannedAt?: string | null;
}
