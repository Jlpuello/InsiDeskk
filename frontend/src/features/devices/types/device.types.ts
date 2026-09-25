import type {
  HwBattery,
  HwBoardInfo,
  HwCpu,
  HwGpu,
  HwMonitor,
  HwStorageDrive,
  HwUsbDevice,
  InstalledAppInfo,
  NetConnectionInfo,
  NetInterfaceInfo,
  NetListeningPort,
} from '../../remotely/types/remotely.types.ts';

export type DeviceStatus = 'online' | 'offline' | 'inactivo';
export type OperatingSystem = 'Windows' | 'Linux' | 'MacOS';

export interface Device {
  id: string;
  nombre: string;
  hostname?: string;
  ipLocal?: string;
  ipPublica?: string;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  remotelyId?: string;
  so?: OperatingSystem;
  versionSo?: string;
  cpuCores?: number;
  ramGb?: number;
  discoGb?: number;
  agentVersion?: string;
  // Metadata organizativa sincronizada desde Remotely (grupos/tags/notas que
  // ya se administran allá) — de solo lectura de nuestro lado.
  remotelyAlias?: string | null;
  remotelyTags?: string | null;
  remotelyNotes?: string | null;
  remotelyGroupId?: string | null;
  remotelyGroupName?: string | null;
  // Detalle de RAM obtenido vía script (Remotely no lo expone por API) — ver
  // remotelyApi.hardwareScan(). null hasta que se corra el análisis al menos
  // una vez.
  ramModules?: RamModuleInfo[] | null;
  ramSlotsUsed?: number | null;
  ramSlotsTotal?: number | null;
  ramHardwareScannedAt?: string | null;
  // "Hoja de vida" — persistido por remotelyApi.hardwareScan()/networkScan(),
  // null hasta que se corra el análisis correspondiente al menos una vez.
  hwUuid?: string | null;
  hwSerialNumber?: string | null;
  hwBoardInfo?: HwBoardInfo | null;
  hwBattery?: HwBattery | null;
  hwCpu?: HwCpu | null;
  hwStorage?: HwStorageDrive[] | null;
  hwGraphics?: { gpus: HwGpu[]; monitors: HwMonitor[] } | null;
  hwUsbDevices?: HwUsbDevice[] | null;
  hwScannedAt?: string | null;
  netInterfaces?: NetInterfaceInfo[] | null;
  netListening?: NetListeningPort[] | null;
  netConnections?: NetConnectionInfo[] | null;
  netScannedAt?: string | null;
  swApps?: InstalledAppInfo[] | null;
  swTotalCount?: number | null;
  swScannedAt?: string | null;
  ultimoContacto?: string;
  estado: DeviceStatus;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  // Reportado por el .bat que genera Agentes al terminar de aplicar el
  // endurecimiento de permisos del agente — null si se instaló sin ese .bat,
  // o si el paso de endurecimiento falló.
  agentHardenedAt?: string | null;
}

// Forma coincide con features/remotely/types/remotely.types.ts#RamModuleInfo
// por convención (mismo patrón que DeviceTelemetry más abajo).
export interface RamModuleInfo {
  slot: string | null;
  capacityGb: number;
  speedMhz: number | null;
  type: string | null;
  manufacturer: string | null;
}

export interface DeviceDrive {
  name: string | null;
  driveFormat: string | null;
  driveType: number;
  freeSpace: number;
  totalSize: number;
  volumeLabel: string | null;
}

// Cacheada en Redis por el poller (TTL 60s) — puede ser null si el device
// recién se registró y todavía no corrió un ciclo de polling.
export interface DeviceTelemetry {
  cpuUtilization: number;
  usedMemoryPercent: number;
  usedStoragePercent: number;
  drives: DeviceDrive[];
  currentUser: string | null;
  updatedAt: string;
}
