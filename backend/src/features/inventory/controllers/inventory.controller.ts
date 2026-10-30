import type { Request, Response } from 'express';
import Joi from 'joi';
import { inventoryService } from '../services/inventory.service.js';
import { resolveEmpresaId } from '../../../shared/security/tenant-scope.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const TIPOS = ['router', 'switch', 'access_point', 'impresora', 'dvr', 'camara_ip', 'control_acceso'] as const;
const ESTADOS = ['activo', 'en_reparacion', 'dado_de_baja'] as const;
// 'pc' solo tiene sentido para list/export (filtrar por "los que tienen
// agente") — nunca para create/update, que siguen usando TIPOS a secas
// (un PC no se carga a mano por acá, lo da de alta el agente de Remotely).
const DEVICE_ESTADOS = ['online', 'offline', 'inactivo'] as const;

const createSchema = Joi.object({
  empresaId: Joi.string().uuid().required(),
  tipo: Joi.string()
    .valid(...TIPOS)
    .required(),
  nombre: Joi.string().min(2).max(150).required(),
  marca: Joi.string().max(100).empty(''),
  modelo: Joi.string().max(100).empty(''),
  numeroSerie: Joi.string().max(150).empty(''),
  ipAddress: Joi.string().ip({ version: ['ipv4', 'ipv6'] }).empty(''),
  macAddress: Joi.string().max(50).empty(''),
  ubicacion: Joi.string().max(200).empty(''),
  proveedor: Joi.string().max(150).empty(''),
  fechaCompra: Joi.date().empty(''),
  garantiaVence: Joi.date().empty(''),
  estado: Joi.string().valid(...ESTADOS),
  credencialUsuario: Joi.string().max(150).empty(''),
  credencialPassword: Joi.string().max(300).empty(''),
  notasConfiguracion: Joi.string().max(4000).empty(''),
  notas: Joi.string().max(2000).empty(''),
  atributos: Joi.object().unknown(true),
  // Árbol de conexión del Mapa — ver InventoryService.update. allow(null)
  // es "desconectar" (vuelve a ser raíz); solo tiene sentido en update, pero
  // se declara acá porque updateSchema se deriva de este con `.fork(...)`.
  conectadoAId: Joi.string().uuid().allow(null),
});

const updateSchema = createSchema.fork(Object.keys(createSchema.describe().keys), (s) => s.optional()).fork(
  ['empresaId'],
  () => Joi.forbidden(),
);

const listQuerySchema = Joi.object({
  empresaId: Joi.string().uuid(),
  tipo: Joi.string().valid(...TIPOS, 'pc'),
  estado: Joi.string().valid(...ESTADOS, ...DEVICE_ESTADOS),
  search: Joi.string().max(150),
});

export const InventoryController = {
  async list(req: Request, res: Response): Promise<void> {
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const items = await inventoryService.list(value);
    res.status(200).json({ data: items });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const item = await inventoryService.getById(req.params.id);
    res.status(200).json({ data: item });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    // Igual que en tickets/devices: create no pasa por el RBAC de Prisma
    // (solo lecturas), así que solo admin puede cargar equipo para otra empresa.
    const empresaId = resolveEmpresaId(value.empresaId);
    if (!empresaId) throw new AppError('El usuario no tiene una empresa asociada', 422);

    const item = await inventoryService.create({ ...value, empresaId });
    res.status(201).json({ data: item });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const item = await inventoryService.update(req.params.id, value);
    res.status(200).json({ data: item });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await inventoryService.remove(req.params.id);
    res.status(204).send();
  },

  // Excel general (sin filtros) o filtrado (mismos query params que list) —
  // nunca incluye credenciales/notas de configuración, ver
  // inventory-export.service.ts.
  async exportExcel(req: Request, res: Response): Promise<void> {
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const buffer = await inventoryService.exportToExcel(value);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario.xlsx"');
    res.status(200).send(buffer);
  },
};
