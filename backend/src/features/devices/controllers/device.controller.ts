import type { Request, Response } from 'express';
import Joi from 'joi';
import { deviceService } from '../services/device.service.js';
import { resolveEmpresaId } from '../../../shared/security/tenant-scope.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { sanitizeDevice } from '../../../shared/utils/mask.js';

const createSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  empresaId: Joi.string().uuid().required(),
  hostname: Joi.string(),
  remotelyId: Joi.string(),
  so: Joi.string().valid('Windows', 'Linux', 'MacOS'),
  versionSo: Joi.string(),
  ipLocal: Joi.string().ip(),
  ipPublica: Joi.string().ip(),
  cpuCores: Joi.number().integer().min(1),
  ramGb: Joi.number().integer().min(1),
  discoGb: Joi.number().integer().min(1),
});

const updateSchema = createSchema.fork(Object.keys(createSchema.describe().keys), (s) => s.optional());

const removeSchema = Joi.object({
  motivo: Joi.string().min(5).max(500).required(),
});

export const DeviceController = {
  async list(req: Request, res: Response): Promise<void> {
    const { empresaId, estado } = req.query as { empresaId?: string; estado?: 'online' | 'offline' | 'inactivo' };
    const devices = await deviceService.list(empresaId, estado);
    res.status(200).json({ data: devices.map(sanitizeDevice) });
  },

  async stats(req: Request, res: Response): Promise<void> {
    const { empresaId } = req.query as { empresaId?: string };
    const stats = await deviceService.getStats(empresaId);
    res.status(200).json({ data: stats });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const device = await deviceService.getById(req.params.id);
    res.status(200).json({ data: sanitizeDevice(device) });
  },

  async getStatus(req: Request, res: Response): Promise<void> {
    const status = await deviceService.getDeviceStatus(req.params.id);
    res.status(200).json({ data: { status } });
  },

  // Telemetría no sensible (CPU/RAM/disco/drives) — no necesita enmascarado,
  // a diferencia de IPs/remotelyId.
  async getTelemetry(req: Request, res: Response): Promise<void> {
    const telemetry = await deviceService.getTelemetry(req.params.id);
    res.status(200).json({ data: telemetry });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    // Igual que en tickets: create no pasa por el RBAC de Prisma (solo lecturas
    // lo hacen), así que solo admin puede registrar un device para otra empresa.
    const empresaId = resolveEmpresaId(value.empresaId);
    if (!empresaId) throw new AppError('El usuario no tiene una empresa asociada', 422);

    const device = await deviceService.create({ ...value, empresaId });
    res.status(201).json({ data: sanitizeDevice(device) });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const device = await deviceService.update(req.params.id, value);
    res.status(200).json({ data: sanitizeDevice(device) });
  },

  // Borrado — acción crítica, exige motivo (ver device.service.ts#remove).
  async remove(req: Request, res: Response): Promise<void> {
    const { error, value } = removeSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    await deviceService.remove(req.params.id, value.motivo);
    res.status(204).send();
  },
};
