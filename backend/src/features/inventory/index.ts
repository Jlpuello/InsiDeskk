export { inventoryRoutes } from './inventory.routes.js';
export { InventoryService, inventoryService } from './services/inventory.service.js';
export { InventoryRepository, inventoryRepository } from './repositories/inventory.repository.js';
export type { InventoryEquipment, InventoryEquipmentType, InventoryEquipmentStatus } from '@prisma/client';
export type { CreateInventoryEquipmentDTO, UpdateInventoryEquipmentDTO } from './types/inventory.types.js';
