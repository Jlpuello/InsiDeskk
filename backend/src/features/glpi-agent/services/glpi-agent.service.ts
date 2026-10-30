import type { OperatingSystem, Prisma } from '@prisma/client';
import { deviceRepository } from '../../devices/index.js';
import { companyRepository } from '../../companies/index.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CacheKeys } from '../../../shared/cache/cache-keys.js';
import { logger } from '../../../shared/utils/logger.js';
import type {
  GlpiContactRequest,
  GlpiInventoryContent,
  GlpiInventoryRequest,
  GlpiProtocolResponse,
} from '../types/glpi-agent.types.js';

// Intervalo que le decimos al agente que espere antes de volver a contactar
// (unidad: horas, mismo orden de magnitud que los ejemplos de la doc oficial
// — ver glpi-json-protocol.readthedocs.io/en/latest/contact.html).
const EXPIRATION_HOURS = 24;
// Mismo TTL que companiesByRemotelyGroup (remotely.service.ts) — el admin lo
// administra a mano, no cambia cada pocos segundos.
const COMPANY_TAG_MAP_CACHE_TTL = 300;
// Más que el ciclo de recontacto (24h) para tolerar que el agente se demore
// o que el CONTACT y el INVENTORY lleguen en requests separadas.
const CONTACT_CORRELATION_TTL = 3600 * 36;

interface ContactCorrelation {
  empresaId: string;
  tag: string;
}

// Subconjunto plano de campos de Device que mapContent() llena — evita los
// tipos "operation input" de Prisma (StringFieldUpdateOperationsInput, etc.,
// que solo aplican a UpdateInput) para poder reusar el mismo objeto tanto en
// create() como en update() sin que TS se queje de la unión.
interface MappedDeviceFields {
  nombre?: string;
  hostname?: string;
  so?: OperatingSystem;
  versionSo?: string;
  ipLocal?: string;
  macAddresses?: string[];
  cpuCores?: number;
  ramGb?: number;
  discoGb?: number;
  hwUuid?: string;
  hwSerialNumber?: string;
  hwBoardInfo?: Prisma.InputJsonValue;
  hwCpu?: Prisma.InputJsonValue;
  hwStorage?: Prisma.InputJsonValue;
  hwStorageSerials?: string[];
  hwGraphics?: Prisma.InputJsonValue;
  hwUsbDevices?: Prisma.InputJsonValue;
  hwScannedAt?: Date;
  netInterfaces?: Prisma.InputJsonValue;
  netScannedAt?: Date;
  swApps?: Prisma.InputJsonValue;
  swTotalCount?: number;
  swScannedAt?: Date;
}

function mapOsName(name?: string): OperatingSystem | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  if (n.includes('windows')) return 'Windows';
  if (n.includes('mac') || n.includes('darwin') || n.includes('os x')) return 'MacOS';
  return 'Linux';
}

// MB -> GB, redondeado — mismo criterio que remotely.service.ts con
// totalMemory/totalStorage (ver updateDeviceStatusCache).
function mbToGb(mb?: number): number | undefined {
  if (!mb) return undefined;
  return Math.round(mb / 1024);
}

export class GlpiAgentService {
  // Mismo patrón que RemotelyService.getCompanyByGroupMap, para la segunda
  // fuente de inventario.
  private async getCompanyByTagMap(): Promise<Map<string, string>> {
    const cached = await cacheService.get<Record<string, string>>(CacheKeys.companiesByGlpiTag);
    if (cached) return new Map(Object.entries(cached));

    const companies = await companyRepository.findAllMappedToGlpiTag();
    const asRecord = Object.fromEntries(
      companies.filter((c) => c.glpiAgentTag).map((c) => [c.glpiAgentTag as string, c.id]),
    );
    await cacheService.set(CacheKeys.companiesByGlpiTag, asRecord, COMPANY_TAG_MAP_CACHE_TTL);
    return new Map(Object.entries(asRecord));
  }

  // Primer paso del protocolo: el agente se presenta con su deviceid y
  // (opcionalmente) el tag configurado. Acá solo resolvemos y cacheamos a qué
  // empresa pertenece — el alta/actualización real del equipo pasa en
  // inventory(), que siempre llega después de un contact() exitoso.
  async contact(body: GlpiContactRequest): Promise<GlpiProtocolResponse> {
    if (!body.deviceid) {
      return { status: 'error', expiration: EXPIRATION_HOURS, message: 'bad-format' };
    }

    if (body.tag) {
      const tagMap = await this.getCompanyByTagMap();
      const empresaId = tagMap.get(body.tag);
      if (empresaId) {
        const correlation: ContactCorrelation = { empresaId, tag: body.tag };
        await cacheService.set(CacheKeys.glpiDeviceContact(body.deviceid), correlation, CONTACT_CORRELATION_TTL);
      } else {
        logger.warn(`GLPI Agent: tag "${body.tag}" no mapea a ninguna empresa (deviceid ${body.deviceid})`);
      }
    }

    return { status: 'ok', expiration: EXPIRATION_HOURS };
  }

  async inventory(body: GlpiInventoryRequest): Promise<GlpiProtocolResponse> {
    if (!body.deviceid || !body.content) {
      return { status: 'error', expiration: EXPIRATION_HOURS, message: 'bad-format' };
    }

    const existing = await deviceRepository.findByGlpiDeviceId(body.deviceid);
    const correlation = existing
      ? null
      : await cacheService.get<ContactCorrelation>(CacheKeys.glpiDeviceContact(body.deviceid));

    // Un equipo nuevo necesita que el contact() previo haya resuelto una
    // empresa — si no, no hay dónde darlo de alta (mismo criterio que el
    // poller de Remotely: "sin empresa mapeada para su grupo, no se da de
    // alta todavía", ver remotely.service.ts#updateDeviceStatusCache).
    if (!existing && !correlation) {
      logger.warn(`GLPI Agent: inventario de ${body.deviceid} sin empresa resuelta (falta un contact() con tag válido)`);
      return { status: 'error', expiration: EXPIRATION_HOURS, message: 'unknown-tag' };
    }

    const mapped = this.mapContent(body.content);

    const now = new Date();

    if (existing) {
      await deviceRepository.update(existing.id, {
        ...mapped,
        ultimoContacto: now,
        ultimoInventarioGlpi: now,
        estado: 'online',
      });
    } else {
      await deviceRepository.create({
        ...mapped,
        nombre: mapped.nombre ?? body.content.hardware?.name ?? 'Equipo sin nombre',
        empresa: { connect: { id: correlation!.empresaId } },
        glpiDeviceId: body.deviceid,
        glpiTag: correlation!.tag,
        ultimoContacto: now,
        ultimoInventarioGlpi: now,
        estado: 'online',
      });
    }

    return { status: 'ok', expiration: EXPIRATION_HOURS };
  }

  // Traduce el "content" del inventario (schema glpi-project/inventory_format,
  // campos en minúscula) a los mismos campos que ya llenamos para equipos de
  // Remotely (ver remotely.service.ts y los scripts de hardware/red/software
  // en features/remotely/scripts) — mismo molde, otra fuente.
  private mapContent(content: GlpiInventoryContent): MappedDeviceFields {
    const cpu = content.cpus?.[0];
    const networks = content.networks ?? [];
    const firstIp = networks.find((n) => n.ipaddress && n.ipaddress !== '127.0.0.1')?.ipaddress;
    const totalStorageMb = content.storages?.reduce((sum, s) => sum + (s.disksize ?? 0), 0);
    const totalMemoryMb = content.memories?.reduce((sum, m) => sum + (m.capacity ?? 0), 0) ?? content.hardware?.memory;

    return {
      nombre: content.hardware?.name,
      hostname: content.hardware?.name,
      so: mapOsName(content.operatingsystem?.name),
      versionSo: content.operatingsystem?.full_name ?? content.operatingsystem?.version,
      ipLocal: firstIp,
      macAddresses: networks.map((n) => n.mac).filter((mac): mac is string => Boolean(mac)),
      cpuCores: content.cpus?.reduce((sum, c) => sum + (c.corecount ?? c.core ?? 0), 0) || undefined,
      ramGb: mbToGb(totalMemoryMb),
      discoGb: mbToGb(totalStorageMb),
      hwUuid: content.hardware?.uuid,
      hwSerialNumber: content.bios?.ssn,
      hwBoardInfo: content.bios
        ? { motherboardManufacturer: content.bios.smanufacturer, motherboardModel: content.bios.smodel }
        : undefined,
      hwCpu: cpu
        ? { name: cpu.name, manufacturer: cpu.manufacturer, speedMhz: cpu.speed, cores: cpu.corecount ?? cpu.core, threads: cpu.thread }
        : undefined,
      hwStorage: content.storages?.map((s) => ({
        model: s.model ?? s.name,
        interfaceType: s.interface,
        mediaType: s.type,
        sizeGb: mbToGb(s.disksize),
      })),
      hwStorageSerials: content.storages?.map((s) => s.serial ?? ''),
      hwGraphics: content.videos || content.monitors
        ? {
            gpus: content.videos?.map((v) => ({ name: v.name, chipset: v.chipset, memoryMb: v.memory })) ?? [],
            monitors: content.monitors?.map((m) => ({ name: m.caption ?? m.manufacturer })) ?? [],
          }
        : undefined,
      hwUsbDevices: content.usbdevices?.map((u) => ({ name: u.name, manufacturer: u.manufacturer })),
      hwScannedAt: new Date(),
      netInterfaces: networks.map((n) => ({
        name: n.description,
        status: n.status,
        ipv4: n.ipaddress,
      })),
      netScannedAt: new Date(),
      swApps: content.softwares?.map((s) => ({
        name: s.name,
        version: s.version,
        publisher: s.publisher,
        installDate: s.install_date,
      })),
      swTotalCount: content.softwares?.length,
      swScannedAt: content.softwares ? new Date() : undefined,
    };
  }
}

export const glpiAgentService = new GlpiAgentService();
