// Forma real de Remotely.Shared.Entities.Device (confirmada contra el código
// fuente de github.com/immense/Remotely), serializada en camelCase por
// ASP.NET Core. Solo se listan los campos que consumimos.
export interface RemotelyDrive {
  name: string | null;
  driveFormat: string | null;
  driveType: number;
  freeSpace: number;
  totalSize: number;
  volumeLabel: string | null;
}

export interface RemotelyDevice {
  id: string;
  deviceName: string | null;
  alias: string | null;
  platform: string | null;
  osDescription: string | null;
  isOnline: boolean;
  lastOnline: string;
  currentUser: string | null;
  publicIP: string | null;
  agentVersion: string | null;
  totalMemory: number;
  usedMemory: number;
  usedMemoryPercent: number;
  totalStorage: number;
  usedStorage: number;
  usedStoragePercent: number;
  cpuUtilization: number;
  processorCount: number;
  drives: RemotelyDrive[] | null;
  macAddresses: string[] | null;
  tags: string | null;
  notes: string | null;
  deviceGroupID: string | null;
  // Confirmado en vivo (no documentado arriba porque no se usaba hasta ahora):
  // Remotely sí lo manda, se usa para derivar el organizationId sin que el
  // admin lo tenga que cargar a mano — ver remotelyService.getOrganizationId().
  organizationID?: string;
}

// GET /api/OrganizationManagement/DeviceGroup (confirmado contra
// OrganizationManagementController) — mismo filtro X-Api-Key que /api/devices.
// El listado de devices trae deviceGroupID pero el objeto anidado deviceGroup
// siempre viene null (Remotely no lo incluye ahí), así que el nombre del
// grupo hay que resolverlo aparte con este endpoint.
export interface RemotelyDeviceGroup {
  id: string;
  name: string;
  organizationID?: string;
}

// Comandos de instalación del agente para una empresa — ver
// scripts/agent-deploy.util.ts. Windows lleva -DeviceGroup embebido (la
// instalación de Remotely SÍ lo soporta); Linux no lo soporta a nivel
// instalador, hay que asignar el grupo a mano después (confirmado contra el
// código fuente de Remotely — no es una limitación nuestra).
export interface AgentScriptInfo {
  companyId: string;
  companyName: string;
  // null = sin grupo de Remotely mapeado (empresa autogenerada, o soporte a
  // un usuario particular) — el instalador funciona igual, ver
  // buildWindowsInstallCommand.
  groupName: string | null;
  windows: {
    command: string;
    batContent: string;
  };
  linux: {
    ubuntu: string;
    manjaro: string;
  };
}

// Telemetría "en vivo" cacheada en Redis (TTL 60s, junto con el poll de
// estado) — no se persiste en Postgres porque cambia cada pocos segundos.
export interface DeviceTelemetry {
  cpuUtilization: number;
  usedMemoryPercent: number;
  usedStoragePercent: number;
  drives: RemotelyDrive[];
  currentUser: string | null;
  updatedAt: string;
}

export interface StartSessionInput {
  deviceId: string;
  ticketId?: string;
}

// GET /api/remotecontrol/{deviceId} de Remotely devuelve directamente la URL
// de la sesión (string), no un objeto {sessionId, joinUrl} — no hay un
// "sessionId" separado que Remotely nos entregue.
export interface StartSessionResult {
  joinUrl: string;
}

// Los shells reales de Remotely son PSCore | WinPS | Bash | CMD (ver
// ScriptingController). 'powershell' se mapea a WinPS (PowerShell de
// Windows clásico) — si tu agente corre PowerShell Core, hay que ajustar
// ese mapeo en remotely.service.ts.
export type ScriptShell = 'powershell' | 'bash' | 'cmd';

export interface ExecuteScriptInput {
  deviceId: string;
  shell: ScriptShell;
  script: string;
  timeoutSeconds?: number;
}

// Forma real de Remotely.Shared.Entities.ScriptResult / ScriptResultBase
// (confirmada contra el código fuente Y en vivo contra el servidor real) —
// NO tiene exitCode/stdout/stderr como se asumía antes. Esta es la forma
// camelCase que devuelve la respuesta SÍNCRONA de
// POST /api/scripting/executecommand (pasa por el pipeline normal de MVC,
// mismo formatter que /api/devices). OJO: GET /api/scriptresults serializa
// la MISMA entidad pero en PascalCase (ver RemotelyScriptResultRaw abajo) —
// no son intercambiables pese a ser el mismo tipo de dato en Remotely.
export interface ExecuteScriptResult {
  id: string;
  deviceID: string;
  organizationID?: string;
  shell: unknown;
  scriptInput: string;
  standardOutput: string[] | null;
  errorOutput: string[] | null;
  hadErrors: boolean;
  runTime: string; // TimeSpan serializado, ej "00:00:00.8630535"
  timeStamp: string;
  senderUserName?: string | null;
}

// GET /api/scriptresults (confirmado EN VIVO contra el servidor real) trae la
// misma entidad que ExecuteScriptResult pero en PascalCase — ese endpoint es
// un File() con serialización manual (System.Text.Json con opciones default),
// no pasa por el formatter camelCase que sí usa el resto de la API. No
// unificar con ExecuteScriptResult: son dos formas distintas del mismo dato.
export interface RemotelyScriptResultRaw {
  ID: string;
  OrganizationID: string;
  DeviceID: string;
  ErrorOutput: string[] | null;
  HadErrors: boolean;
  InputType: number;
  RunTime: string;
  ScriptInput: string;
  SenderConnectionID?: string | null;
  SenderUserName: string | null;
  Shell: number;
  StandardOutput: string[] | null;
  TimeStamp: string;
}

// Remotely no expone tipo/velocidad/slots de RAM vía API — se obtiene
// ejecutando scripts/hardware-scan.script.ts contra el equipo (WMI/CIM).
export interface RamModuleInfo {
  slot: string | null;
  capacityGb: number;
  speedMhz: number | null;
  type: string | null;
  manufacturer: string | null;
}

// "Hoja de vida" de hardware — todo lo que Remotely NO expone por API y sale
// de un único script WMI/CIM (ver scripts/hardware-scan.script.ts). uuid,
// serialNumber y storage[].serialNumber son identificadores únicos de
// hardware — se separan del resto porque en Postgres viajan cifrados
// (Device.hwUuid/hwSerialNumber/hwStorageSerials), a diferencia del resto de
// estos campos que son specs/modelo (no identifican una unidad física entre
// reinstalaciones).
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

// serialNumber viaja aparte (hwStorageSerials, cifrado) — no es parte de este
// tipo para que no se filtre sin querer a un lugar sin enmascarar.
export interface HwStorageDrive {
  model: string | null;
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
  vramGb: number | null; // en GPUs con >4GB, AdapterRAM (WMI) suele overflowear (bug conocido de Windows) — puede venir incorrecto
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

// Salida cruda del script (lo que devuelve parseHardwareScanResult): incluye
// uuid/serialNumber/storage[].serialNumber en texto plano porque en este punto
// todavía no pasó por el device.service — se separan recién al persistir
// (ver DeviceService.saveHardwareInfo).
export interface HardwareScanResult {
  uuid: string | null;
  serialNumber: string | null;
  board: HwBoardInfo | null;
  battery: HwBattery | null;
  cpu: HwCpu | null;
  ramModules: RamModuleInfo[];
  ramSlotsUsed: number;
  ramSlotsTotal: number | null;
  storage: (HwStorageDrive & { serialNumber: string | null })[];
  gpus: HwGpu[];
  monitors: HwMonitor[];
  usbDevices: HwUsbDevice[];
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
}

// Inventario de software — sale del registro (claves Uninstall), mismo lugar
// que usa "Programas y características" de Windows. installDate viene del
// registro como "YYYYMMDD" (no una fecha real) — se normaliza a ISO en el
// parser (ver scripts/software-scan.script.ts).
export interface InstalledAppInfo {
  name: string;
  version: string | null;
  publisher: string | null;
  installDate: string | null;
}

export interface SoftwareScanResult {
  apps: InstalledAppInfo[];
  totalCount: number;
}

export interface RemoteSessionHistoryEntry {
  sessionId: string;
  deviceId: string;
  startedAt: string;
  endedAt?: string;
  initiatedBy: string;
}
