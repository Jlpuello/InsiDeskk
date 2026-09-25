import type { InventoryEquipmentStatus, Prisma } from '@prisma/client';
import { inventoryRepository } from '../repositories/inventory.repository.js';
import { deviceRepository, type DeviceStatus } from '../../devices/index.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';
import { buildInventoryWorkbook } from './inventory-export.service.js';
import type {
  CreateInventoryEquipmentDTO,
  InventoryEquipmentFilters,
  InventoryListFilters,
  InventoryListItem,
  UpdateInventoryEquipmentDTO,
} from '../types/inventory.types.js';

const INVENTORY_ESTADOS = new Set(['activo', 'en_reparacion', 'dado_de_baja']);
const DEVICE_ESTADOS = new Set(['online', 'offline', 'inactivo']);


// Traduce un InventoryListFilters (que puede pedir tipo='pc') a lo que cada
// repositorio real entiende. El `estado` es ambiguo entre los dos mundos
// (activo/en_reparacion/dado_de_baja vs online/offline/inactivo) — se aplica
// solo al lado cuyo vocabulario lo reconoce, así que un valor que no le
// corresponde a un lado simplemente no lo filtra en ese lado (en la práctica
// nunca pasa: el frontend solo ofrece el selector de estado que corresponde
// al tipo elegido).
function buildDeviceWhere(filters: InventoryListFilters, empresaId?: string): Prisma.DeviceWhereInput {
  const { estado, search } = filters;
  return {
    ...(empresaId && { empresaId }),
    ...(estado && DEVICE_ESTADOS.has(estado) && { estado: estado as DeviceStatus }),
    ...(search && {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' } },
        { hostname: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
}

function buildManualFilters(filters: InventoryListFilters, empresaId?: string): InventoryEquipmentFilters {
  const { estado, search, tipo } = filters;
  return {
    empresaId,
    search,
    tipo: tipo === 'pc' ? undefined : tipo,
    estado: estado && INVENTORY_ESTADOS.has(estado) ? (estado as InventoryEquipmentStatus) : undefined,
  };
}

// Sin anotar los tipos de retorno a mano en los métodos que devuelven el
// equipo (con `empresa` incluido) — ver el comentario en
// inventory.repository.ts, mismo motivo.
export class InventoryService {
  // Lista combinada: equipo cargado a mano (InventoryEquipment) + PCs con
  // agente (Device) — ver InventoryListItem. Sin cache: es una pantalla de
  // bajo tráfico (admin/técnico revisando inventario, no el flujo caliente
  // de tickets), y cachear un merge de dos tablas independientes obligaría a
  // invalidarlo desde AMBOS features cada vez que cualquiera cambia — más
  // riesgo de quedar desincronizado que lo que vale ahorrar acá.
  async list(filters: InventoryListFilters): Promise<InventoryListItem[]> {
    const empresaId = resolveEmpresaId(filters.empresaId);
    const includeManual = !filters.tipo || filters.tipo !== 'pc';
    const includeDevices = !filters.tipo || filters.tipo === 'pc';

    const [manual, devices] = await Promise.all([
      includeManual ? inventoryRepository.findMany(buildManualFilters(filters, empresaId)) : Promise.resolve([]),
      includeDevices ? deviceRepository.findMany(buildDeviceWhere(filters, empresaId)) : Promise.resolve([]),
    ]);

    return [
      ...manual.map((equipment): InventoryListItem => ({ origen: 'manual', equipment })),
      ...devices.map((device): InventoryListItem => ({ origen: 'agente', device })),
    ];
  }

  // InventoryEquipment NO pasa por el middleware RBAC de Prisma (a
  // diferencia de Ticket/Device) — sin este chequeo explícito, un
  // admin/tecnico de OTRA empresa podía ver/editar/borrar equipo ajeno
  // (incluidas sus credenciales cifradas) solo con saber o adivinar el id.
  async getById(id: string) {
    const item = await inventoryRepository.findById(id);
    if (!item) throw new NotFoundError('Equipo de inventario');
    assertOwnCompanyOrAdmin(item.empresaId);
    return item;
  }

  async create(data: CreateInventoryEquipmentDTO) {
    const { empresaId, atributos, ...rest } = data;
    return inventoryRepository.create({
      ...rest,
      atributos: atributos as never,
      empresa: { connect: { id: empresaId } },
    });
  }

  async update(id: string, data: UpdateInventoryEquipmentDTO) {
    await this.getById(id); // 404 antes que Prisma tire P2025 como 500

    const { atributos, ...rest } = data;
    return inventoryRepository.update(id, {
      ...rest,
      ...(atributos !== undefined && { atributos: atributos as never }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await inventoryRepository.delete(id);
  }

  // Excel general/filtrado — dos hojas (equipo manual + PCs con agente),
  // solo incluye la hoja que corresponde al `tipo` pedido (o ambas si no se
  // filtró por tipo). Nunca incluye credenciales/notas de configuración, ver
  // inventory-export.service.ts.
  async exportToExcel(filters: InventoryListFilters): Promise<Buffer> {
    const empresaId = resolveEmpresaId(filters.empresaId);
    const includeManual = !filters.tipo || filters.tipo !== 'pc';
    const includeDevices = !filters.tipo || filters.tipo === 'pc';

    const [equipment, devices] = await Promise.all([
      includeManual ? inventoryRepository.findMany(buildManualFilters(filters, empresaId)) : Promise.resolve([]),
      includeDevices ? deviceRepository.findMany(buildDeviceWhere(filters, empresaId)) : Promise.resolve([]),
    ]);

    return buildInventoryWorkbook({
      equipment: includeManual ? equipment : null,
      devices: includeDevices ? devices : null,
    });
  }
}

export const inventoryService = new InventoryService();
