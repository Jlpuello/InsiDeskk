import { Prisma, type Device, type DeviceStatus } from '@prisma/client';
import { deviceRepository } from '../repositories/device.repository.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CacheKeys, CachePatterns } from '../../../shared/cache/cache-keys.js';
import { hashFilters } from '../../../shared/utils/redis.helpers.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { recordCriticalAction } from '../../../shared/security/critical-action.service.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { inventoryRepository } from '../../inventory/repositories/inventory.repository.js';
import type {
  CreateDeviceDTO,
  DeviceTelemetry,
  HardwareScanInput,
  NetworkScanInput,
  SoftwareScanInput,
  UpdateDeviceDTO,
} from '../types/device.types.js';

export class DeviceService {
  async list(empresaIdInput?: string, estado?: DeviceStatus, skip?: number, take?: number): Promise<Device[]> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    const cacheKey = CacheKeys.devicesList(empresaId ?? 'all', hashFilters({ estado, skip, take }));

    const cached = await cacheService.get<Device[]>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // Sin filtro explícito de estado, los dados de baja (ver remove()) no
    // aparecen en la lista — mismo efecto visible que un borrado real.
    const devices = await deviceRepository.findMany(
      { ...(empresaId && { empresaId }), estado: estado ?? { not: 'inactivo' } },
      skip,
      take,
    );

    await cacheService.set(cacheKey, devices, env.cacheDevicesTtl);
    return devices;
  }

  async getStats(empresaIdInput?: string): Promise<{ total: number; byEstado: Record<DeviceStatus, number> }> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    // Mismo prefijo que la lista (`device:list:{empresaId}:`) para invalidarse junto con ella.
    const cacheKey = CacheKeys.devicesList(empresaId ?? 'all', 'stats');

    const cached = await cacheService.get<{ total: number; byEstado: Record<DeviceStatus, number> }>(cacheKey);
    if (cached) return cached;

    const byEstado = await deviceRepository.countByStatus(empresaId);
    const total = Object.values(byEstado).reduce((sum, count) => sum + count, 0);
    const stats = { total, byEstado };

    await cacheService.set(cacheKey, stats, env.cacheDevicesTtl);
    return stats;
  }

  // No se cachea por id: pasa siempre por Prisma (y por lo tanto por el
  // middleware RBAC), que es lo único que garantiza que un dispositivo de otra
  // empresa devuelva "no encontrado" para cliente/tecnico.
  async getById(id: string): Promise<Device> {
    const device = await deviceRepository.findById(id);
    if (!device) throw new NotFoundError('Dispositivo');
    return device;
  }

  // Estado "en vivo" alimentado por RemotelyService.updateDeviceStatusCache()
  // (TTL 60s). getById() primero confirma que el usuario puede ver este
  // dispositivo (vía RBAC); solo entonces se consulta el cache de status —
  // leer Redis directo por id, sin ese paso, dejaría a cualquier usuario
  // autenticado consultar el estado de dispositivos de otras empresas.
  async getDeviceStatus(id: string): Promise<DeviceStatus> {
    const device = await this.getById(id);

    const cached = await cacheService.get<DeviceStatus>(CacheKeys.deviceStatus(device.id));
    return cached ?? device.estado;
  }

  // Mismo patrón que getDeviceStatus: RBAC primero (getById), Redis después.
  // Si el poller nunca corrió para este device (recién registrado, o
  // remotelyId no matchea ninguno real), devuelve null — no hay fallback en
  // Postgres para esto porque nunca se persiste (ver remotely.service.ts).
  async getTelemetry(id: string): Promise<DeviceTelemetry | null> {
    await this.getById(id);
    return cacheService.get<DeviceTelemetry>(CacheKeys.deviceTelemetry(id));
  }

  // Persiste el resultado de un análisis de hardware corrido a demanda (ver
  // features/remotely — script vía WMI/CIM, Remotely no expone esto por API).
  // Igual que getTelemetry: getById primero para RBAC, ya que este método se
  // llama con un id que viene directo de la ruta del controller de remotely.
  // uuid/serialNumber/storage[].serialNumber son identificadores únicos de
  // hardware — se separan a columnas propias (cifradas por el middleware,
  // igual que remotelyId/macAddresses) en vez de viajar dentro del JSON
  // plano de specs.
  async saveHardwareInfo(id: string, info: HardwareScanInput): Promise<Device> {
    const device = await this.getById(id);

    const storageWithoutSerials = info.storage.map(({ serialNumber: _serialNumber, ...rest }) => rest);
    const storageSerials = info.storage.map((d) => d.serialNumber ?? '');

    const updated = await deviceRepository.update(id, {
      hwUuid: info.uuid ?? undefined,
      hwSerialNumber: info.serialNumber ?? undefined,
      hwBoardInfo: info.board as unknown as Prisma.InputJsonValue,
      hwBattery: info.battery as unknown as Prisma.InputJsonValue,
      hwCpu: info.cpu as unknown as Prisma.InputJsonValue,
      ramModules: info.ramModules as unknown as Prisma.InputJsonValue,
      ramSlotsUsed: info.ramSlotsUsed,
      ramSlotsTotal: info.ramSlotsTotal,
      ramHardwareScannedAt: new Date(),
      hwStorage: storageWithoutSerials as unknown as Prisma.InputJsonValue,
      hwStorageSerials: storageSerials,
      hwGraphics: { gpus: info.gpus, monitors: info.monitors } as unknown as Prisma.InputJsonValue,
      hwUsbDevices: info.usbDevices as unknown as Prisma.InputJsonValue,
      hwScannedAt: new Date(),
    });

    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(device.empresaId));
    return updated;
  }

  // Mismo patrón que saveHardwareInfo, para la categoría de red (botón/scan
  // separado). remoteAddress de netConnections NO se cifra acá — es
  // diagnóstico de seguridad (qué habla el equipo hacia afuera), se enmascara
  // recién al salir hacia el frontend (ver shared/utils/mask.ts).
  async saveNetworkInfo(id: string, info: NetworkScanInput): Promise<Device> {
    const device = await this.getById(id);

    const updated = await deviceRepository.update(id, {
      netInterfaces: info.interfaces as unknown as Prisma.InputJsonValue,
      netListening: info.listening as unknown as Prisma.InputJsonValue,
      netConnections: info.connections as unknown as Prisma.InputJsonValue,
      netScannedAt: new Date(),
    });

    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(device.empresaId));
    return updated;
  }

  // Mismo patrón que saveHardwareInfo/saveNetworkInfo, para el inventario de
  // software instalado (botón/scan separado, categoría más pesada).
  async saveSoftwareInfo(id: string, info: SoftwareScanInput): Promise<Device> {
    const device = await this.getById(id);

    const updated = await deviceRepository.update(id, {
      swApps: info.apps as unknown as Prisma.InputJsonValue,
      swTotalCount: info.totalCount,
      swScannedAt: new Date(),
    });

    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(device.empresaId));
    return updated;
  }

  async create(data: CreateDeviceDTO): Promise<Device> {
    // Spread del resto de campos escalares (cpuCores, ramGb, discoGb, etc.) en
    // vez de listarlos uno a uno — listarlos a mano fue justo el bug que hizo
    // que cpuCores/ramGb/discoGb se perdieran en silencio antes de este fix.
    const { empresaId, ...rest } = data;

    const device = await deviceRepository.create({
      ...rest,
      empresa: { connect: { id: empresaId } },
    });

    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(empresaId));
    return device;
  }

  async update(id: string, data: UpdateDeviceDTO): Promise<Device> {
    const existing = await this.getById(id); // 404 antes que Prisma tire P2025 (record not found) como 500
    // Explícito además de lo que ya filtra getById vía RBAC de Prisma — no
    // depender solo de que un futuro refactor siga llamando a getById primero.
    assertOwnCompanyOrAdmin(existing.empresaId);

    const { conectadoAId, ...rest } = data;

    // Árbol de conexión del Mapa de Inventario — a diferencia de
    // InventoryEquipment.conectadoAId (self-relation, puede formar un ciclo),
    // acá el destino SIEMPRE es un InventoryEquipment: un Device nunca puede
    // ser el padre de otra cosa, así que no hay ciclo posible que validar,
    // solo que el destino exista y sea de la misma empresa.
    if (conectadoAId !== undefined && conectadoAId !== null) {
      const parent = await inventoryRepository.findById(conectadoAId);
      if (!parent) throw new NotFoundError('Equipo de inventario (destino de conexión)');
      if (parent.empresaId !== existing.empresaId) {
        throw new AppError('No se puede conectar a un equipo de otra empresa', 422);
      }
    }

    const device = await deviceRepository.update(id, {
      ...rest,
      ...(conectadoAId !== undefined && {
        conectadoA: conectadoAId ? { connect: { id: conectadoAId } } : { disconnect: true },
      }),
    });
    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(device.empresaId));
    return device;
  }

  // Borrado — acción crítica: exige motivo y queda auditado con detalle (ver
  // shared/security/critical-action.service.ts), igual criterio que aprobar/
  // rechazar una cotización.
  //
  // Un equipo con sesiones remotas o scripts ejecutados no se puede borrar
  // físicamente: RemotelySession/RemotelyScriptExecution tienen onDelete:
  // Restrict hacia Device (a propósito, para no perder ese historial) y
  // Postgres tira P2003. En ese caso se da de baja (estado: 'inactivo', ya
  // definido en el enum pero sin ningún flujo que lo usara) en vez de
  // borrarse — mismo criterio que CompanyService.deactivate con activo:false.
  // Un equipo sin historial (nunca tuvo sesión/script) sí se borra físico,
  // como antes.
  async remove(id: string, motivo: string): Promise<void> {
    const device = await this.getById(id);
    assertOwnCompanyOrAdmin(device.empresaId);

    try {
      await deviceRepository.delete(id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        await deviceRepository.update(id, { estado: 'inactivo' });
      } else {
        throw err;
      }
    }

    await cacheService.invalidatePattern(CachePatterns.devicesForCompany(device.empresaId));
    await recordCriticalAction({ accion: 'DEVICE_DELETE', tabla: 'Device', registroId: id, motivo });
  }
}

export const deviceService = new DeviceService();
