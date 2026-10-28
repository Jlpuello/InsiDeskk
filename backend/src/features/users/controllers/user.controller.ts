import type { Request, Response } from 'express';
import Joi from 'joi';
import { userService } from '../services/user.service.js';
import { PERMISSIONS } from '../../../shared/security/permissions.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const createSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  apellido: Joi.string().max(150),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  rol: Joi.string().valid('admin', 'tecnico', 'cliente').required(),
  // Requerida salvo que se cree otro admin (un admin no pertenece a ninguna
  // empresa, ver UserRepository/schema.prisma) — mismo criterio que ticket/
  // device create.
  empresaId: Joi.string().uuid().when('rol', { is: Joi.valid('tecnico', 'cliente'), then: Joi.required() }),
  nivel: Joi.number().integer().min(1).max(3).allow(null),
  permisos: Joi.array().items(Joi.string().valid(...PERMISSIONS)),
});

const updateSchema = Joi.object({
  nombre: Joi.string().min(2).max(150),
  apellido: Joi.string().max(150).allow(null),
  rol: Joi.string().valid('admin', 'tecnico', 'cliente'),
  activo: Joi.boolean(),
  nivel: Joi.number().integer().min(1).max(3).allow(null),
  // Capacidades puntuales además del rol (ver Configuración → Usuarios y
  // shared/security/permissions.ts) — reemplaza al viejo esAprobador booleano.
  permisos: Joi.array().items(Joi.string().valid(...PERMISSIONS)),
  // Formato nomás acá (min/max) — que sea OBLIGATORIO cuando se toca `rol` o
  // `permisos` se valida a mano en el controller (ver abajo): encadenar dos
  // `.when()` en Joi para una condición "rol O permisos" no compone como OR de
  // forma confiable, mejor un chequeo explícito que no dependa de esa magia.
  motivo: Joi.string().min(5).max(500),
});

const removeSchema = Joi.object({
  motivo: Joi.string().min(5).max(500).required(),
});

const resetTwoFactorSchema = Joi.object({
  motivo: Joi.string().min(5).max(500).required(),
});

export const UserController = {
  async list(req: Request, res: Response): Promise<void> {
    const empresaId = req.query.empresaId as string | undefined;
    const users = await userService.list(empresaId);
    res.status(200).json({ data: users });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const user = await userService.create(value);
    res.status(201).json({ data: user });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    // Tocar `rol` o `permisos` es acción crítica — motivo obligatorio (ver
    // UserService.update, que solo lo exige de verdad si el valor realmente
    // cambia respecto al actual).
    if ((value.rol !== undefined || value.permisos !== undefined) && !value.motivo) {
      throw new AppError('Esta acción requiere indicar un motivo', 422);
    }

    const user = await userService.update(req.params.id, value);
    res.status(200).json({ data: user });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { error, value } = removeSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    await userService.remove(req.params.id, value.motivo);
    res.status(204).send();
  },

  async resetTwoFactor(req: Request, res: Response): Promise<void> {
    const { error, value } = resetTwoFactorSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const user = await userService.resetTwoFactor(req.params.id, value.motivo);
    res.status(200).json({ data: user });
  },
};
