// Formas mínimas del protocolo JSON de GLPI Agent (continuación activa de
// FusionInventory-Agent — ver glpi-json-protocol.readthedocs.io). Solo se
// tipan los campos que realmente usamos; el agente manda bastante más de lo
// que acá se modela, el resto se ignora sin romper nada.

export interface GlpiContactRequest {
  action: 'contact';
  deviceid: string;
  name?: string;
  version?: string;
  // Configurado en el agente con --tag=<valor> — nuestro equivalente a
  // Company.remotelyGroupId, ver Company.glpiAgentTag.
  tag?: string;
}

export interface GlpiNetworkInterface {
  description?: string;
  ipaddress?: string;
  mac?: string;
  type?: string;
  status?: string;
}

export interface GlpiCpu {
  name?: string;
  manufacturer?: string;
  speed?: number;
  core?: number;
  corecount?: number;
  thread?: number;
}

export interface GlpiStorage {
  name?: string;
  model?: string;
  manufacturer?: string;
  serial?: string;
  disksize?: number; // MB
  type?: string;
  interface?: string;
}

export interface GlpiMemory {
  capacity?: number; // MB
  manufacturer?: string;
  serialnumber?: string;
  model?: string;
  type?: string;
  speed?: number;
}

export interface GlpiVideo {
  name?: string;
  chipset?: string;
  memory?: number;
}

export interface GlpiMonitor {
  manufacturer?: string;
  caption?: string;
  serial?: string;
}

export interface GlpiUsbDevice {
  name?: string;
  manufacturer?: string;
  serial?: string;
}

export interface GlpiDrive {
  letter?: string;
  filesystem?: string;
  total?: number; // MB
  free?: number; // MB
}

export interface GlpiSoftware {
  name?: string;
  version?: string;
  publisher?: string;
  install_date?: string;
}

export interface GlpiInventoryContent {
  hardware?: { name?: string; uuid?: string; memory?: number };
  operatingsystem?: { name?: string; version?: string; full_name?: string };
  bios?: { ssn?: string; smanufacturer?: string; smodel?: string };
  cpus?: GlpiCpu[];
  storages?: GlpiStorage[];
  memories?: GlpiMemory[];
  networks?: GlpiNetworkInterface[];
  videos?: GlpiVideo[];
  monitors?: GlpiMonitor[];
  usbdevices?: GlpiUsbDevice[];
  drives?: GlpiDrive[];
  softwares?: GlpiSoftware[];
}

export interface GlpiInventoryRequest {
  action?: 'inventory';
  deviceid: string;
  itemtype?: string;
  content: GlpiInventoryContent;
}

export interface GlpiProtocolResponse {
  status: 'ok' | 'error' | 'pending';
  expiration: number;
  message?: string;
}
