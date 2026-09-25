export { deviceRoutes } from './device.routes.js';
export { DeviceService, deviceService } from './services/device.service.js';
export { DeviceRepository, deviceRepository } from './repositories/device.repository.js';
export type { Device, DeviceStatus } from '@prisma/client';
export type { CreateDeviceDTO, UpdateDeviceDTO } from './types/device.types.js';
