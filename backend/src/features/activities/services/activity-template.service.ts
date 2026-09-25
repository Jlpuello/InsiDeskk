import { NotFoundError } from '../../../shared/utils/error.handler.js';
import { activityTemplateRepository } from '../repositories/activity-template.repository.js';
import type { CreateActivityTemplateDTO, UpdateActivityTemplateDTO } from '../types/activity.types.js';

export class ActivityTemplateService {
  async create(data: CreateActivityTemplateDTO) {
    return activityTemplateRepository.create({
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo: data.tipo ?? 'otro',
      empresa: { connect: { id: data.empresaId } },
      ...(data.usuarioAsignadoId && { usuarioAsignado: { connect: { id: data.usuarioAsignadoId } } }),
      ...(data.dispositivoId && { dispositivo: { connect: { id: data.dispositivoId } } }),
      recurrenciaTipo: data.recurrenciaTipo,
      ...(data.recurrenciaDia !== undefined && { recurrenciaDia: data.recurrenciaDia }),
    });
  }

  async list(empresaId?: string) {
    return activityTemplateRepository.findMany(empresaId ? { empresaId } : undefined);
  }

  async update(id: string, data: UpdateActivityTemplateDTO) {
    const existing = await activityTemplateRepository.findById(id);
    if (!existing) throw new NotFoundError('Plantilla de actividad');

    return activityTemplateRepository.update(id, {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(data.usuarioAsignadoId !== undefined && {
        usuarioAsignado: data.usuarioAsignadoId ? { connect: { id: data.usuarioAsignadoId } } : { disconnect: true },
      }),
      ...(data.dispositivoId !== undefined && {
        dispositivo: data.dispositivoId ? { connect: { id: data.dispositivoId } } : { disconnect: true },
      }),
      ...(data.recurrenciaTipo && { recurrenciaTipo: data.recurrenciaTipo }),
      ...(data.recurrenciaDia !== undefined && { recurrenciaDia: data.recurrenciaDia }),
      ...(data.activo !== undefined && { activo: data.activo }),
    });
  }
}

export const activityTemplateService = new ActivityTemplateService();
