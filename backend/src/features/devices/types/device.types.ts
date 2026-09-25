import type { OperatingSystem } from '@prisma/client';

export interface CreateDeviceDTO {
  nombre: string;
  empresaId: string;
  hostname?: string;
  remotelyId?: string;
  so?: OperatingSystem;
  versionSo?: string;
  ipLocal?: string;
  ipPublica?: string;
  cpuCores?: number;
  ramGb?: number;
  discoGb?: number;
}

export type UpdateDeviceDTO = Partial<Omit<CreateDeviceDTO, 'empresaId'>>;

export interface DeviceDrive {
  name: string | null;
  driveFormat: string | null;
  driveType: number;
  freeSpace: number;
  totalSize: number;
  volumeLabel: string | null;
}

// Definido localmente (no importado de features/remotely) para no crear un
// ciclo: remotely ya importa de devices (deviceRepository), así que devices
// no puede importar de remotely. La forma coincide con
// features/remotely/types/remotely.types.ts#DeviceTelemetry por convención,
// no por import compartido.
export interface DeviceTelemetry {
  cpuUtilization: number;
  usedMemoryPercent: number;
  usedStoragePercent: number;
  drives: DeviceDrive[];
  currentUser: string | null;
  updatedAt: string;
}

// Forma coincide con features/remotely/types/remotely.types.ts#RamModuleInfo
// / HardwareScanResult por convención, no por import (mismo motivo que
// DeviceTelemetry arriba: evitar el ciclo remotely -> devices -> remotely).
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

// uuid/serialNumber/storage[].serialNumber son identificadores únicos de
// hardware — DeviceService.saveHardwareInfo los separa a columnas cifradas
// (hwUuid/hwSerialNumber/hwStorageSerials) antes de persistir; el resto queda
// en JSON plano (specs/modelo, no identifica una unidad física).
export interface HardwareScanInput {
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

export interface NetworkScanInput {
  interfaces: NetInterfaceInfo[];
  listening: NetListeningPort[];
  connections: NetConnectionInfo[];
}

export interface InstalledAppInfo {
  name: string;
  version: string | null;
  publisher: string | null;
  installDate: string | null;
}

export interface SoftwareScanInput {
  apps: InstalledAppInfo[];
  totalCount: number;
}
