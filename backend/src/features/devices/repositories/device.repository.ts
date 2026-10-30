import { Prisma, type Device, type DeviceStatus } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { encryptionService } from '../../../shared/utils/encryption.js';

export class DeviceRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.DeviceCreateInput): Promise<Device> {
    return this.prisma.device.create({
      data,
      include: { empresa: true },
    });
  }

  async findById(id: string) {
    return this.prisma.device.findUnique({
      where: { id },
      include: { empresa: true },
    });
  }

  // remotelyId se guarda cifrado (AES-GCM, no determinístico), así que no se
  // puede buscar por igualdad directa — se busca por su blind index (HMAC).
  async findByRemotelyId(remotelyId: string) {
    return this.prisma.device.findUnique({
      where: { remotelyIdHash: encryptionService.blindIndex(remotelyId) },
      include: { empresa: true },
    });
  }

  // Mismo criterio que findByRemotelyId: glpiDeviceId se guarda cifrado, se
  // busca por su blind index.
  async findByGlpiDeviceId(glpiDeviceId: string) {
    return this.prisma.device.findUnique({
      where: { glpiDeviceIdHash: encryptionService.blindIndex(glpiDeviceId) },
      include: { empresa: true },
    });
  }

  async findMany(where?: Prisma.DeviceWhereInput, skip?: number, take?: number) {
    return this.prisma.device.findMany({
      where,
      skip,
      take,
      include: { empresa: true },
    });
  }

  async update(id: string, data: Prisma.DeviceUpdateInput) {
    return this.prisma.device.update({
      where: { id },
      data,
      include: { empresa: true },
    });
  }

  async delete(id: string) {
    return this.prisma.device.delete({
      where: { id },
    });
  }

  async findByCompanyId(empresaId: string) {
    return this.prisma.device.findMany({
      where: { empresaId },
      include: { empresa: true },
    });
  }

  async findByStatus(estado: DeviceStatus) {
    return this.prisma.device.findMany({
      where: { estado },
    });
  }

  async countOnline(empresaId?: string) {
    return this.prisma.device.count({
      where: {
        estado: 'online',
        ...(empresaId && { empresaId }),
      },
    });
  }

  // Llamado desde un endpoint público (POST /api/remotely/harden-report) por
  // el propio equipo recién instalado, sin sesión — no hay a quién
  // devolverle un 404 útil si no matchea ningún device, así que updateMany
  // en vez de update: 0 filas afectadas es un resultado válido (el poller de
  // Remotely puede no haber sincronizado el dispositivo todavía).
  async markHardened(empresaId: string, hostname: string, hardenedAt: Date): Promise<number> {
    const result = await this.prisma.device.updateMany({
      where: { empresaId, hostname },
      data: { agentHardenedAt: hardenedAt },
    });
    return result.count;
  }

  // Barrido periódico (ver glpi-stale-devices.scheduler.ts): GLPI Agent no
  // tiene poller en vivo como Remotely, así que un equipo apagado se queda
  // "online" para siempre si nadie lo revisa — esto marca "offline" los que
  // reportaron por última vez antes de `before` y no estaban ya offline.
  async markStaleGlpiDevicesOffline(before: Date): Promise<number> {
    const result = await this.prisma.device.updateMany({
      where: { glpiDeviceIdHash: { not: null }, estado: { not: 'offline' }, ultimoContacto: { lt: before } },
      data: { estado: 'offline' },
    });
    return result.count;
  }

  async countByStatus(empresaId?: string): Promise<Record<DeviceStatus, number>> {
    const groups = await this.prisma.device.groupBy({
      by: ['estado'],
      where: empresaId ? { empresaId } : undefined,
      _count: { estado: true },
    });

    const base: Record<DeviceStatus, number> = { online: 0, offline: 0, inactivo: 0 };
    for (const group of groups) {
      base[group.estado] = group._count.estado;
    }

    return base;
  }
}

export const deviceRepository = new DeviceRepository();
